# DocuFlow AI

DocuFlow AI is an AI-powered document analysis and action extraction system that transforms unstructured business documents and contracts into structured action items, deadlines, responsibilities, operating rules, and risks.

---

## Architecture

```text
React / Vercel
      │
      ▼
FastAPI / Render
      │
      ├───> Gemini API
      │
      ├───> SQLite (`docuflow.db`)
      │
      └───> PDF processing (`pypdf`)
```

---

## Features

- **PDF Ingestion & Text Extraction**: Reads and parses text content safely using `pypdf`.
- **AI Synthesis**: Extracts executive summaries, key takeaways, responsibilities, rules, and risks.
- **Action Item Extraction**: Identifies actionable follow-ups with priorities and target dates.
- **Interactive Action Queue**: Real-time status updates (`Pending`, `In Progress`, `Completed`) with completion progress tracking.
- **Secure Architecture**: Server-side Gemini API calls ensure API keys are never exposed in the browser.
- **Deployment-Ready**: Environment-driven CORS and API configuration for Render and Vercel.

---

## Tech Stack

- **Frontend**: React, Vite, JavaScript, Vanilla CSS
- **Backend**: FastAPI, Uvicorn, Python, SQLAlchemy, pypdf, requests, python-dotenv
- **Database**: SQLite (SQLAlchemy ORM)
- **AI Engine**: Google Gemini API (`gemini-2.5-flash` / `gemini-3.5-flash-lite`)

---

## Environment Variables

### Backend (`backend/.env`)

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
FRONTEND_URL=http://localhost:5173
PORT=8000
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://127.0.0.1:8000
```

> [!IMPORTANT]
> The `GEMINI_API_KEY` must remain strictly server-side. Do **NOT** pass `GEMINI_API_KEY` to Vercel or prepend `VITE_` to it.

---

## Local Setup & Development

### 1. Clone & Setup Backend

```bash
# Navigate to backend
cd backend

# Create & activate virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your GEMINI_API_KEY
cp .env.example .env

# Run FastAPI backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be available at `http://localhost:8000`.

### 2. Setup & Run Frontend

```bash
# Open a new terminal and navigate to frontend
cd frontend

# Install dependencies
npm install

# Run Vite dev server
npm run dev
```

The frontend app will be available at `http://localhost:5173`.

---

## Deploying to Render (Backend)

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your repository and set the **Root Directory** to `backend`.
3. Set **Runtime** to `Python 3`.
4. Set **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
5. Set **Start Command**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
6. Add Environment Variables in Render Dashboard:
   - `GEMINI_API_KEY`: *(Your Google AI Studio Key)*
   - `FRONTEND_URL`: `https://YOUR-VERCEL-DOMAIN.vercel.app`
7. Deploy the service and copy your Render service URL (e.g., `https://docuflow-api.onrender.com`).

> [!NOTE]
> **Ephemeral Storage Notice**: Render's free web service filesystem is ephemeral. Local SQLite database files (`docuflow.db`) and uploaded files in `uploads/` will reset when the instance restarts or redeploys. This setup is ideal for portfolio demos. Production environments would utilize managed PostgreSQL and S3/cloud object storage.

---

## Deploying to Vercel (Frontend)

1. Create a new project on [Vercel](https://vercel.com/) and import your repository.
2. Set **Root Directory** to `frontend`.
3. Framework Preset will be automatically detected as **Vite**.
4. Set Environment Variable:
   - `VITE_API_URL`: `https://YOUR-RENDER-BACKEND.onrender.com`
5. Click **Deploy**.

---

## API Endpoints

- `GET /`: API Health Check & service status
- `GET /docs`: Interactive OpenAPI / Swagger Documentation
- `GET /config`: Gemini API configuration status
- `GET /documents`: List all indexed documents
- `POST /documents/upload`: Upload PDF file and extract text
- `POST /documents/{document_id}/analyze`: Trigger AI document analysis
- `GET /documents/{document_id}`: Fetch document details, analysis, and actions
- `GET /documents/{document_id}/actions`: Fetch action items for a document
- `PATCH /actions/{action_id}`: Update action status (`Pending`, `In Progress`, `Completed`)
- `DELETE /documents/{document_id}`: Delete document and cascade delete related data
