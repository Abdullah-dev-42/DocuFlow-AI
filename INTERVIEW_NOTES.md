# DocuFlow AI — Technical & Interview Notes

This document provides concise, clear explanations of key technical choices, architectural decisions, and interview talking points for **DocuFlow AI**.

---

## 1. What problem does DocuFlow AI solve?

Business documents, SLAs, contracts, and proposals hide essential obligations, deadlines, and risks inside long PDF text. DocuFlow AI automatically converts unstructured document text into structured insights and actionable tasks, allowing teams to move immediately from reading to execution.

---

## 2. AI Document Analysis vs. A Normal Chatbot

| Feature | Normal Chatbot | DocuFlow AI Document Analysis |
| :--- | :--- | :--- |
| **Interaction Model** | Open-ended conversational Q&A | Automated extraction pipeline |
| **Input** | User prompt / chat input | PDF document ingestion and text parsing |
| **Output Format** | Unstructured conversational text | Deterministic, structured JSON schema |
| **Persistence** | Chat session history | Relational database storage (SQLite / PostgreSQL) |
| **Primary Goal** | Answer questions interactively | Convert paperwork into trackable action items and risk maps |

> **Key Talking Point**: DocuFlow AI is not a conversational chatbot; it is an automated document-to-action engine that extracts structured operational intelligence from raw PDFs.

---

## 3. Technology Stack Rationale

### Why React for Frontend?
React provides a reactive component model ideal for dynamic dashboards with live workspace stats, document state updates, custom dropdowns, and instant UI state synchronization.

### Why FastAPI for Backend?
FastAPI is lightweight, high-performance, asynchronous, and natively integrates with Python's rich data science and AI ecosystem. It handles file uploads, schema validation via Pydantic, and database ORM transactions cleanly.

### Why Google Gemini API?
Gemini offers fast inference, strong JSON schema adherence, high context windows for large documents, and cost-effective pricing tiers suitable for production AI document analysis.

### Why pypdf for Extraction?
`pypdf` runs natively in Python without requiring external OCR system binaries (like Tesseract) or complex C dependencies, making it lightweight and fast for extracting text from digital PDFs.

---

## 4. Architectural & Security Questions

### Why is Gemini called from the backend instead of React?
1. **Security**: Browser code is public. Placing `GEMINI_API_KEY` in React code would leak the API key to any user inspecting browser network requests.
2. **Data Validation**: Server-side calling allows the backend to validate, clean, and structure the LLM output before returning it to the user.
3. **Resilience**: The backend manages retry logic, model fallback (`gemini-2.5-flash` → `gemini-3.5-flash-lite`), and error sanitization.

### How does PDF text extraction work?
1. User uploads PDF via React FormData.
2. FastAPI validates file extension and non-zero byte size.
3. `pypdf.PdfReader` iterates page-by-page, extracting clean text strings.
4. Combined text is stored in SQLite alongside document metadata.

### How does the LLM generate structured JSON?
The system prompt explicitly commands Gemini to return **only** valid JSON matching a defined schema containing `summary`, `document_type`, `key_points`, `deadlines`, `responsibilities`, `rules`, `risks`, and `actions`. Setting `responseMimeType: "application/json"` and temperature `0.2` ensures deterministic output.

### How are actions and deadlines extracted?
The model scans text for modal verbs ("shall", "must", "will") and date patterns, mapping them to action title, priority, deadline, and description fields. If no deadlines exist, `deadlines: []` is returned rather than hallucinating dates.

### How does the frontend communicate with the backend?
React issues `fetch()` HTTP requests to `VITE_API_URL`. Endpoints support `GET`, `POST`, `PATCH`, and `DELETE`.

### Why Vercel for Frontend and Render for Backend?
- **Vercel**: Optimized for hosting static Vite SPA builds on a global CDN with zero server setup.
- **Render**: Supports Python environments, Uvicorn server processes, environment secret injection, and automatic port binding ($PORT).

---

## 5. Deployment & Production Considerations

### What limitations does the free deployment have?
Render's free tier filesystem is **ephemeral**. Local PDF files in `uploads/` and SQLite databases (`docuflow.db`) reset upon instance restarts.

### What would be improved for production?
1. **Storage**: Replace local `uploads/` with Amazon S3 or Supabase Storage.
2. **Database**: Replace SQLite with managed PostgreSQL (e.g. Render Postgres / Supabase).
3. **Authentication**: Implement JWT user auth and tenant workspace isolation.
4. **Queue Processing**: Use Celery / Redis for processing ultra-large (100+ page) PDF documents asynchronously.
