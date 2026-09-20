import json
import os
import time
from typing import Any, Dict

import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_RETRIES = 2


SYSTEM_PROMPT = """
You are a document analysis assistant. Analyze only the supplied document content.
Extract factual information only. Do not invent missing information. If information is unavailable, return empty arrays or null values.
Return valid JSON only with this exact structure:
{
  "summary": "...",
  "document_type": "...",
  "key_points": [],
  "deadlines": [
    {"title": "...", "date": "...", "description": "..."}
  ],
  "responsibilities": [],
  "rules": [],
  "risks": [
    {"title": "...", "description": "...", "severity": "High|Medium|Low"}
  ],
  "actions": [
    {"title": "...", "description": "...", "priority": "High|Medium|Low", "deadline": "..."}
  ]
}
Rules:
- Analyze only the document provided to you.
- Do not make up dates, obligations, or actions.
- If a date is unclear or ambiguous, keep the original wording exactly as written instead of inventing a date.
- If a deadline is not present, return an empty array.
- Keep summaries concise and factual.
- Return arrays as JSON arrays; do not wrap them in strings.
- Return valid JSON only, no markdown or commentary.
"""


def analyze_document_text(extracted_text: str) -> Dict[str, Any]:
    if not extracted_text or not extracted_text.strip():
        raise ValueError("Document text is empty and cannot be analyzed.")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key in {"your_api_key_here", "your_gemini_api_key_here"}:
        raise ValueError("GEMINI_API_KEY is missing or unconfigured. Please configure a valid GEMINI_API_KEY environment variable.")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{SYSTEM_PROMPT}\n\nDocument text:\n{extracted_text}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
        },
    }

    response = None
    last_error = None
    models_to_try = [GEMINI_MODEL]
    if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL not in models_to_try:
        models_to_try.append(GEMINI_FALLBACK_MODEL)

    for model_index, model in enumerate(models_to_try):
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = requests.post(
                    gemini_url,
                    params={"key": api_key},
                    json=payload,
                    timeout=60,
                )
            except requests.RequestException as exc:
                raise RuntimeError("Gemini API request failed before receiving a response.") from exc

            if response.ok:
                break

            try:
                error_data = response.json()
                error_message = error_data.get("error", {}).get("message")
            except ValueError:
                error_message = None

            detail = error_message or f"Gemini returned HTTP {response.status_code}."
            last_error = (response.status_code, detail)

            if response.status_code not in RETRYABLE_STATUS_CODES:
                raise RuntimeError(f"Gemini API rejected the request: {detail}")

            if attempt < MAX_RETRIES:
                retry_after = response.headers.get("Retry-After")
                try:
                    delay = min(float(retry_after), 8) if retry_after else 2 ** attempt
                except ValueError:
                    delay = 2 ** attempt
                time.sleep(delay)

        if response is not None and response.ok:
            break

        if model_index < len(models_to_try) - 1:
            continue

    if response is None or not response.ok:
        status_code, detail = last_error or (503, "Gemini is temporarily unavailable.")
        if status_code in RETRYABLE_STATUS_CODES:
            raise RuntimeError(
                f"Gemini is temporarily busy after retrying {len(models_to_try)} model(s). "
                "Please try analysis again in a moment."
            )
        raise RuntimeError(f"Gemini API rejected the request: {detail}")

    try:
        data = response.json()
    except ValueError as exc:
        raise RuntimeError("Gemini returned an invalid response format.") from exc

    try:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("Gemini returned an empty or malformed response.")

    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Gemini returned malformed JSON.") from exc

    required_keys = [
        "summary",
        "document_type",
        "key_points",
        "deadlines",
        "responsibilities",
        "rules",
        "risks",
        "actions",
    ]
    for key in required_keys:
        if key not in parsed:
            parsed[key] = [] if key in {"key_points", "deadlines", "responsibilities", "rules", "risks", "actions"} else None

    return parsed
