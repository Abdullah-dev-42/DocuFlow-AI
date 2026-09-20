# DocuFlow AI — Product Requirements Document (PRD)

## 1. Product Overview

**DocuFlow AI** is an intelligent document analysis and action extraction platform designed to transform static, unstructured documents (such as contracts, policies, agreements, and specifications) into structured, trackable, and actionable insights.

---

## 2. Core Value Proposition

- **Eliminate Manual Review Overhead**: Automatically extract high-level summaries, key points, deadlines, responsibilities, rules, and risks without requiring hours of manual document reading.
- **Action Item Extraction**: Identify actionable tasks embedded within legal or business prose and automatically populate an interactive action queue.
- **Structured Output**: Produce deterministic JSON representations of document data stored in SQLite.

---

## 3. Key Target Features

### 3.1 PDF Ingestion & Validation
- Support PDF uploads up to 10 MB.
- Extract readable plain text using `pypdf`.
- Validate file format, corruption, and empty content with user-friendly error feedback.

### 3.2 AI-Powered Analysis
- Send document text to Google Gemini API server-side.
- Extract:
  - **Summary**: Concise executive overview.
  - **Document Type**: Identification (e.g., Service Agreement, Policy, RFP).
  - **Key Points**: Critical information bullet points.
  - **Deadlines**: Specific dates, milestone titles, and descriptions.
  - **Responsibilities**: Accountable parties and obligations.
  - **Rules**: Explicit operational or legal constraints.
  - **Risks**: Flagged concerns with severity levels (`High`, `Medium`, `Low`).
  - **Actions**: Discrete follow-up tasks with priority and optional target date.

### 3.3 Interactive Dashboard
- Workspace sidebar listing all indexed documents with analysis status indicators.
- Executive summary view with live workspace stats (Total Documents, Pending Actions, High Priority Risks, Upcoming Deadlines).
- Dedicated **Action Queue** view with interactive status updating (`Pending` → `In Progress` → `Completed`) and progress metrics.
- Document detail view with clear section cards and confirmation modal for document deletion.

---

## 4. User Personas

1. **Operations Managers**: Require rapid extraction of deliverables and deadlines from vendor contracts.
2. **Project Lead / Compliance Officers**: Need to audit policy rules, obligations, and high-risk clauses quickly.
3. **Executive Stakeholders**: Seek daily briefs and high-level summaries across active operational documentation.

---

## 5. Non-Functional Requirements

- **Security**: Server-side API key handling; no secrets in frontend bundles.
- **Performance**: PDF text extraction and AI synthesis completion within seconds.
- **Reliability**: Graceful fallback handling for API rate limits and model busy responses.
- **Deployment Flexibility**: Decoupled architecture supporting Vercel (frontend) and Render (backend).
