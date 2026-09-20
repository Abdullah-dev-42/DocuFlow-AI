# DocuFlow AI — System Architecture

## 1. System Overview

DocuFlow AI follows a client-server architecture separating presentation, API orchestration, AI processing, and data persistence.

```text
User Browser
    │
    ▼
Vercel React Frontend (Vite)
    │
    │ HTTPS REST API (`VITE_API_URL`)
    ▼
Render FastAPI Backend (Python Uvicorn)
    │
    ├───> Google Gemini API (Server-side LLM Integration)
    │
    ├───> pypdf (Local Text Extraction)
    │
    └───> SQLite / SQLAlchemy (`docuflow.db`)
```

---

## 2. Component Specifications

### 2.1 Frontend Component Layer (React + Vite)
- **App Shell (`src/App.jsx`)**: State container managing active views (`overview`, `documents`, `actions`), selected document state, file selection, and asynchronous operations.
- **API Client (`src/services/api.js`)**: Encapsulates `fetch` calls configured via `VITE_API_URL`.
- **Design System (`src/App.css`)**: Vanilla CSS design system incorporating dark mode glassmorphism, micro-animations, and curated status indicators.

### 2.2 Backend Service Layer (FastAPI)
- **Main API Router (`main.py`)**: Defines REST endpoints, CORS middleware, runtime configuration checks, and transaction boundaries.
- **PDF Service (`services/pdf_service.py`)**: Page-by-page text extraction and validation using `pypdf.PdfReader`.
- **LLM Service (`services/llm_service.py`)**: Formats system prompts, enforces structured JSON output schema, executes requests to Gemini REST API with model fallback retry logic.
- **Database Engine (`database.py`, `models.py`, `schemas.py`)**: SQLAlchemy ORM layer interfacing with SQLite.

---

## 3. Data Schema Diagram

```text
+-------------------+        1 : N        +-------------------+
|     Document      | ------------------< |     Analysis      |
+-------------------+                     +-------------------+
| id (PK)           |                     | id (PK)           |
| original_filename |                     | document_id (FK)  |
| stored_filename   |                     | summary           |
| file_path         |                     | document_type     |
| extracted_text    |                     | key_points (JSON) |
| created_at        |                     | deadlines (JSON)  |
+-------------------+                     | responsibilities  |
          │                               | rules (JSON)      |
          │ 1 : N                         | risks (JSON)      |
          ▼                               +-------------------+
+-------------------+
|      Action       |
+-------------------+
| id (PK)           |
| document_id (FK)  |
| title             |
| description       |
| priority          |
| deadline          |
| status            |
+-------------------+
```

---

## 4. Environment Matrix

| Environment Variable | Service | Purpose | Production Default |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Frontend | Target backend API endpoint | `https://YOUR-RENDER-BACKEND.onrender.com` |
| `GEMINI_API_KEY` | Backend | Google AI Studio API authentication | *(Stored in Render secrets)* |
| `GEMINI_MODEL` | Backend | Primary LLM model | `gemini-2.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Backend | Fallback LLM model on rate limit | `gemini-3.5-flash-lite` |
| `FRONTEND_URL` | Backend | Allowed CORS origin | `https://YOUR-VERCEL-DOMAIN.vercel.app` |
| `PORT` | Backend | Uvicorn binding port | Assigned dynamically by Render ($PORT) |
