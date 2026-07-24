from io import BytesIO

import pdfplumber
from docx import Document


def extract_text_from_pdf(content: bytes) -> str:
    with pdfplumber.open(BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(page.strip() for page in pages if page.strip())


def extract_text_from_docx(content: bytes) -> str:
    document = Document(BytesIO(content))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    return "\n".join(paragraphs)


def extract_text_from_upload(filename: str, content: bytes) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        return extract_text_from_pdf(content)
    if lower_name.endswith(".docx"):
        return extract_text_from_docx(content)
    return content.decode("utf-8", errors="ignore")
