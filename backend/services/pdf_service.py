import os

from pypdf import PdfReader


def extract_text_from_pdf(file_path: str) -> str:
    if not file_path or not os.path.exists(file_path):
        raise ValueError("The PDF file does not exist.")

    try:
        reader = PdfReader(file_path)
    except Exception as exc:  # pragma: no cover - defensive validation
        raise ValueError("Invalid or corrupted PDF file.") from exc

    if not reader.pages:
        raise ValueError("This PDF does not contain any pages.")

    page_texts = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text and text.strip():
            page_texts.append(text.strip())

    combined_text = "\n\n".join(page_texts)
    if not combined_text.strip():
        raise ValueError("No readable text could be extracted from this PDF.")

    return combined_text
