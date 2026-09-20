# DocuFlow AI — Project Memory & Technical Context

## 1. Project Context & Environment

- **Project Name**: DocuFlow AI
- **Repository Root**: `d:\DocuFlow AI`
- **Frontend Stack**: React 19, Vite 6, Vanilla CSS, JS (ES Modules)
- **Backend Stack**: FastAPI, Uvicorn, Python 3.10+, SQLAlchemy, pypdf, requests, python-dotenv
- **Primary AI Provider**: Google Gemini API (`gemini-2.5-flash` with fallback to `gemini-3.5-flash-lite`)

---

## 2. Key Architecture Decisions

1. **Server-Side AI Calling**: Direct browser-to-Gemini API calls are prohibited to prevent API key leakages and enforce response validation.
2. **REST-based Gemini Ingestion**: Uses `requests` with standard HTTP POST calls to Google's REST API endpoints (`https://generativelanguage.googleapis.com/v1beta/models/...`), avoiding heavyweight SDK dependencies while maintaining full model configuration control.
3. **Decoupled Monorepo Structure**: Frontend (`frontend/`) and Backend (`backend/`) remain strictly isolated with independent build scripts and environment specifications.

---

## 3. Deployment Topology

- **Frontend Host**: Vercel (Root: `frontend`, Build Command: `npm run build`, Output Directory: `dist`, Required Env: `VITE_API_URL`)
- **Backend Host**: Render Web Service (Root: `backend`, Build Command: `pip install -r requirements.txt`, Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`, Required Env: `GEMINI_API_KEY`, `FRONTEND_URL`)
