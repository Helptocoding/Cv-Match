from fastapi import APIRouter
from fastapi.responses import HTMLResponse, Response

from app.models.export_schema import ExportDocxRequest, ExportMarkdownRequest, ExportPdfRequest
from app.services.export_service import ExportService


router = APIRouter()
service = ExportService()


@router.post("/export/pdf")
def export_pdf(payload: ExportPdfRequest) -> Response:
    pdf_bytes = service.build_harvard_pdf(payload.adapted_cv, font_key=payload.font)
    headers = {"Content-Disposition": f"attachment; filename={payload.file_name}"}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.post("/export/preview-html")
def export_preview_html(payload: ExportPdfRequest) -> HTMLResponse:
    html = service.build_preview_html(payload.adapted_cv, font_key=payload.font)
    return HTMLResponse(content=html, status_code=200)


@router.post("/export/docx")
def export_docx(payload: ExportDocxRequest) -> Response:
    docx_bytes = service.build_harvard_docx(payload.adapted_cv)
    headers = {"Content-Disposition": f"attachment; filename={payload.file_name}"}
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )


@router.post("/export/markdown")
def export_markdown(payload: ExportMarkdownRequest) -> Response:
    markdown_content = service.build_markdown(payload.adapted_cv)
    headers = {"Content-Disposition": f"attachment; filename={payload.file_name}"}
    return Response(content=markdown_content.encode("utf-8"), media_type="text/markdown; charset=utf-8", headers=headers)
