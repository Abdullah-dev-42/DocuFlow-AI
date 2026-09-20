# DocuFlow AI — Operational & Prompt Engineering Rules

## 1. Safety & Security Rules

1. **Server-Side Key Isolation**: `GEMINI_API_KEY` must **never** be exposed in client-side code, `VITE_` environment variables, or committed repository files.
2. **Sanitized Error Messaging**: API error responses sent to the frontend must contain clean, friendly descriptions (e.g. `"AI analysis is temporarily unavailable"`) and **never** expose stack traces, internal paths, or API keys.
3. **CORS Boundary Enforcement**: Backend CORS policy must restrict cross-origin requests to configured frontend origins (`FRONTEND_URL`) rather than wildcard `*` in production.

---

## 2. LLM Prompting & Analysis Rules

When analyzing document text, the Gemini system prompt enforces the following strict rules:

1. **Strict Factual Grounding**: Analyze **only** the supplied document content. Do not extrapolate or assume external context.
2. **No Hallucinated Obligations**:
   - Never invent deadlines. If a date is not in the text, set `deadline: null` or keep original exact wording.
   - Never invent responsibilities or risks. Return empty arrays (`[]`) when information is missing.
3. **Deterministic Output Structure**: Always return valid JSON adhering strictly to the schema:
   ```json
   {
     "summary": "...",
     "document_type": "...",
     "key_points": [],
     "deadlines": [],
     "responsibilities": [],
     "rules": [],
     "risks": [],
     "actions": []
   }
   ```
4. **No Markdown Wrappers**: Output raw JSON strings (or strip markdown code fences safely server-side before parsing).

---

## 3. Data Integrity & Lifecycle Rules

1. **Cascade Deletion**: When a document is deleted via `DELETE /documents/{id}`, all associated `Analysis` and `Action` records must be removed from SQLite, and the local file system PDF must be cleaned up if present.
2. **Idempotent Re-analysis**: Triggering `/documents/{id}/analyze` updates the existing `Analysis` record and refreshes generated actions without duplicating orphaned tasks.
