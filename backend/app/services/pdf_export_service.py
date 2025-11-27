import logging
from io import BytesIO
from typing import List
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PyPDF2 import PdfReader, PdfWriter
from sqlmodel import Session, select
from app.models.highlights import Highlight
from app.models.comments import Comment

logger = logging.getLogger("app.pdf_export")

# 優先順に探索する日本語フォントパス
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",   # fonts-noto-cjk (Debian/Ubuntu)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.otf",
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",        # macOS (ローカル開発用)
]

FALLBACK_FONT = "Helvetica"  # 文字化けするが最悪のフォールバック

class PDFExportService:
    def __init__(self, db: Session):
        self.db = db
        self.font_name = FALLBACK_FONT
        self._register_japanese_font()

    def _register_japanese_font(self):
        for path in FONT_CANDIDATES:
            try:
                pdfmetrics.registerFont(TTFont("JPFont", path))
                self.font_name = "JPFont"
                logger.info(f"[PDFExportService] Japanese font registered path={path}")
                return
            except Exception as e:
                logger.warning(f"[PDFExportService] Font register failed path={path} err={e}")
        logger.warning(f"[PDFExportService] Using fallback font={FALLBACK_FONT}")

    def export_pdf_with_comments(
        self,
        original_pdf_bytes: bytes,
        project_file_id: int
    ) -> BytesIO:
        logger.info(f"[PDFExportService] Start export. project_file_id={project_file_id} bytes_len={len(original_pdf_bytes)}")
        base_stream = BytesIO(original_pdf_bytes)
        reader = PdfReader(base_stream)
        writer = PdfWriter()

        logger.info(f"[PDFExportService] Original pages={len(reader.pages)}")
        for page in reader.pages:
            writer.add_page(page)

        highlights = self._get_highlights_with_comments(project_file_id)
        logger.info(f"[PDFExportService] Highlights fetched: count={len(highlights)}")

        if highlights:
            comment_pdf = self._create_comment_pages(highlights)
            comment_reader = PdfReader(comment_pdf)
            logger.info(f"[PDFExportService] Comment pages generated: {len(comment_reader.pages)}")
            for page in comment_reader.pages:
                writer.add_page(page)
        else:
            logger.info("[PDFExportService] No highlights. Skipping comment pages.")

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        logger.info(f"[PDFExportService] Output size={output.getbuffer().nbytes}")
        return output

    def _get_highlights_with_comments(self, project_file_id: int) -> List[Highlight]:
        statement = (
            select(Highlight)
            .where(Highlight.project_file_id == project_file_id)
            .order_by(Highlight.created_at)
        )
        highlights = self.db.exec(statement).all()
        for h in highlights:
            stmt_c = (
                select(Comment)
                .where(Comment.highlight_id == h.id)
                .where(Comment.parent_id == None)
                .order_by(Comment.created_at)
            )
            h.comments = list(self.db.exec(stmt_c).all())
        return highlights

    def _create_comment_pages(self, highlights: List[Highlight]) -> BytesIO:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 30 * mm

        # タイトル
        c.setFont(self.font_name, 16)
        c.drawString(20 * mm, y, "コメント一覧")
        y -= 15 * mm

        for idx, h in enumerate(highlights, 1):
            if y < 50 * mm:
                c.showPage()
                y = height - 30 * mm
                c.setFont(self.font_name, 16)
                c.drawString(20 * mm, y, "コメント一覧 (続き)")
                y -= 15 * mm

            c.setFont(self.font_name, 12)
            c.drawString(20 * mm, y, f"#{idx} ハイライト")
            y -= 7 * mm

            c.setFont(self.font_name, 10)
            c.drawString(25 * mm, y, f"作成者: {h.created_by}")
            y -= 5 * mm
            c.drawString(25 * mm, y, f"作成日時: {h.created_at.strftime('%Y-%m-%d %H:%M')}")
            y -= 5 * mm

            if h.memo:
                for line in self._wrap_text(h.memo, 50):
                    c.drawString(25 * mm, y, f"メモ: {line}" if line == self._wrap_text(h.memo, 50)[0] else f"      {line}")
                    y -= 5 * mm

            if h.text:
                lines = self._wrap_text(h.text, 55)
                c.drawString(25 * mm, y, "選択テキスト:")
                y -= 5 * mm
                for line in lines:
                    if y < 30 * mm:
                        c.showPage()
                        y = height - 30 * mm
                    c.drawString(30 * mm, y, line)
                    y -= 5 * mm

            if h.comments:
                y -= 3 * mm
                c.setFont(self.font_name, 11)
                c.drawString(25 * mm, y, "コメント:")
                y -= 6 * mm
                for comment in h.comments:
                    if y < 40 * mm:
                        c.showPage()
                        y = height - 30 * mm
                    c.setFont(self.font_name, 9)
                    c.drawString(30 * mm, y, f"• {comment.author} ({comment.created_at.strftime('%Y-%m-%d %H:%M')})")
                    y -= 5 * mm
                    for line in self._wrap_text(comment.text, 60):
                        if y < 30 * mm:
                            c.showPage()
                            y = height - 30 * mm
                        c.drawString(35 * mm, y, line)
                        y -= 5 * mm
                    if comment.replies:
                        for reply in comment.replies:
                            if y < 35 * mm:
                                c.showPage()
                                y = height - 30 * mm
                            c.drawString(40 * mm, y, f"↳ {reply.author}: {reply.text}")
                            y -= 5 * mm
            y -= 10 * mm

        c.save()
        buffer.seek(0)
        return buffer

    def _wrap_text(self, text: str, max_length: int) -> List[str]:
        words = text.split()
        lines = []
        current = []
        length = 0
        for w in words:
            wl = len(w)
            if length + wl + (1 if current else 0) <= max_length:
                current.append(w)
                length += wl
            else:
                lines.append(" ".join(current))
                current = [w]
                length = wl
        if current:
            lines.append(" ".join(current))
        return lines