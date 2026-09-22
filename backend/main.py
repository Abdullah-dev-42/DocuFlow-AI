import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal, engine
from models import Action, Analysis, Document
from schemas import ActionResponse, ActionStatusUpdate, AnalysisResponse, DocumentDetailResponse, DocumentResponse, UploadResponse
from services.llm_service import analyze_document_text
from services.pdf_service import extract_text_from_pdf

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

try:
    from models import Base
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

app = FastAPI(title="DocuFlow AI API")

frontend_url_env = os.getenv("FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173")
raw_origins = [url.strip().rstrip("/") for url in frontend_url_env.split(",") if url.strip()]
default_locals = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"]
allowed_origins = []
for origin in raw_origins + default_locals:
    if origin and origin not in allowed_origins:
        allowed_origins.append(origin)
        allowed_origins.append(f"{origin}/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "DocuFlow AI API",
        "message": "DocuFlow AI API is running"
    }


@app.get("/config")
def get_runtime_config():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_configured = bool(api_key and api_key not in {"your_api_key_here", "your_gemini_api_key_here"})
    return {
        "gemini_configured": is_configured,
        "model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "message": "Gemini API key is configured." if is_configured else "Gemini API key is missing. Add it to environment variables to enable AI analysis.",
    }



@app.get("/documents")
def get_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).order_by(Document.created_at.desc()).all()
    result = []
    for doc in documents:
        analysis = db.query(Analysis).filter(Analysis.document_id == doc.id).order_by(Analysis.created_at.desc()).first()
        result.append(
            {
                "id": doc.id,
                "original_filename": doc.original_filename,
                "stored_filename": doc.stored_filename,
                "file_path": doc.file_path,
                "extracted_text": doc.extracted_text,
                "created_at": doc.created_at,
                "analysis_status": "complete" if analysis else "pending",
            }
        )
    return result


@app.post("/documents/upload", response_model=UploadResponse)
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file:
        raise HTTPException(status_code=400, detail="No file selected.")

    if file.filename is None or file.filename == "":
        raise HTTPException(status_code=400, detail="No file selected.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    file_content = file.file.read()
    if not file_content or len(file_content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    original_name = file.filename
    safe_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{original_name}"
    file_path = UPLOAD_DIR / safe_name

    try:
        with open(file_path, "wb") as upload_file:
            upload_file.write(file_content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not save the uploaded file.") from exc

    try:
        extracted_text = extract_text_from_pdf(str(file_path))
    except ValueError as exc:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to process the PDF file.") from exc

    document = Document(
        original_filename=original_name,
        stored_filename=safe_name,
        file_path=str(file_path),
        extracted_text=extracted_text,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return UploadResponse(
        message="Document uploaded and text extracted successfully.",
        document=document,
    )


@app.post("/documents/{document_id}/analyze")
def analyze_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not document.extracted_text or not document.extracted_text.strip():
        raise HTTPException(status_code=400, detail="This document has no extractable text for analysis.")

    try:
        result = analyze_document_text(document.extracted_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="AI analysis failed unexpectedly.") from exc

    analysis = db.query(Analysis).filter(Analysis.document_id == document_id).first()
    if analysis:
        analysis.summary = result.get("summary")
        analysis.document_type = result.get("document_type")
        analysis.key_points = result.get("key_points") or []
        analysis.deadlines = result.get("deadlines") or []
        analysis.responsibilities = result.get("responsibilities") or []
        analysis.rules = result.get("rules") or []
        analysis.risks = result.get("risks") or []
    else:
        analysis = Analysis(
            document_id=document.id,
            summary=result.get("summary"),
            document_type=result.get("document_type"),
            key_points=result.get("key_points") or [],
            deadlines=result.get("deadlines") or [],
            responsibilities=result.get("responsibilities") or [],
            rules=result.get("rules") or [],
            risks=result.get("risks") or [],
        )
        db.add(analysis)

    actions = result.get("actions") or []
    existing_actions = db.query(Action).filter(Action.document_id == document_id).all()
    for action in existing_actions:
        db.delete(action)

    for action_data in actions:
        db.add(
            Action(
                document_id=document.id,
                title=action_data.get("title") or "Untitled action",
                description=action_data.get("description") or "",
                priority=(action_data.get("priority") or "Medium").capitalize(),
                deadline=action_data.get("deadline"),
                status="Pending",
            )
        )

    db.commit()
    db.refresh(analysis)

    return {
        "message": "Analysis completed successfully.",
        "analysis": analysis,
        "actions_count": len(actions),
    }


@app.get("/documents/{document_id}")
def get_document_detail(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    analysis = db.query(Analysis).filter(Analysis.document_id == document_id).order_by(Analysis.created_at.desc()).first()
    actions = db.query(Action).filter(Action.document_id == document_id).order_by(Action.created_at.desc()).all()

    return {
        "id": document.id,
        "original_filename": document.original_filename,
        "stored_filename": document.stored_filename,
        "file_path": document.file_path,
        "extracted_text": document.extracted_text,
        "created_at": document.created_at,
        "analysis": {
            "id": analysis.id,
            "document_id": analysis.document_id,
            "summary": analysis.summary,
            "document_type": analysis.document_type,
            "key_points": analysis.key_points or [],
            "deadlines": analysis.deadlines or [],
            "responsibilities": analysis.responsibilities or [],
            "rules": analysis.rules or [],
            "risks": analysis.risks or [],
            "created_at": analysis.created_at,
        } if analysis else None,
        "actions": [
            {
                "id": action.id,
                "document_id": action.document_id,
                "title": action.title,
                "description": action.description,
                "priority": action.priority,
                "deadline": action.deadline,
                "status": action.status,
                "created_at": action.created_at,
            }
            for action in actions
        ],
    }


@app.get("/documents/{document_id}/actions")
def get_document_actions(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    actions = db.query(Action).filter(Action.document_id == document_id).order_by(Action.created_at.desc()).all()
    return actions


@app.patch("/actions/{action_id}")
def update_action_status(action_id: int, payload: ActionStatusUpdate, db: Session = Depends(get_db)):
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found.")

    allowed_statuses = {"Pending", "In Progress", "Completed"}
    status_value = payload.status.strip()
    if status_value not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Status must be Pending, In Progress, or Completed.")

    action.status = status_value
    db.commit()
    db.refresh(action)
    return action


@app.delete("/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    actions = db.query(Action).filter(Action.document_id == document_id).all()
    for item in actions:
        db.delete(item)

    analysis = db.query(Analysis).filter(Analysis.document_id == document_id).all()
    for item in analysis:
        db.delete(item)

    db.delete(document)
    db.commit()

    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except OSError:
            pass

    return {"message": "Document deleted successfully."}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

