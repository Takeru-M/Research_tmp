import logging
import unicodedata
from io import BytesIO
from typing import List
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from PyPDF2 import PdfReader, PdfWriter
from sqlmodel import Session, select
from app.models.highlights import Highlight
from app.models.comments import Comment

logger = logging.getLogger("app.pdf_export")

# 優先順に探索する日本語フォントパス (subfontIndex 指定)
FONT_CANDIDATES = [
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
    ("/usr/share/fonts/truetype/noto/NotoSansJP-Regular.otf", None),
    ("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc", 0),
]

class PDFExportService:
    def __init__(self, db: Session):
        self.db = db
        self.font_name = "HeiseiMin-W3"
        self._register_japanese_font()

    def _register_japanese_font(self):
        for path, subfont_index in FONT_CANDIDATES:
            try:
                if subfont_index is not None:
                    pdfmetrics.registerFont(TTFont("JPFont", path, subfontIndex=subfont_index))
                else:
                    pdfmetrics.registerFont(TTFont("JPFont", path))
                self.font_name = "JPFont"
                logger.info(f"[PDFExportService] Font registered: {path} (subfont={subfont_index})")
                return
            except Exception as e:
                logger.warning(f"[PDFExportService] Font load failed: {path} err={e}")
        
        try:
            pdfmetrics.registerFont(UnicodeCIDFont("HeiseiMin-W3"))
            self.font_name = "HeiseiMin-W3"
            logger.info("[PDFExportService] Using CID font: HeiseiMin-W3")
        except Exception as e:
            logger.error(f"[PDFExportService] CID font failed: {e}")
            self.font_name = "Helvetica"
            logger.warning("[PDFExportService] Fallback to Helvetica (no Japanese support)")

    def _sanitize_text(self, text: str) -> str:
        """
        PDF 描画用にテキストをサニタイズ:
        1. Unicode 正規化 (NFKC)
        2. 制御文字削除
        3. フォント非対応文字を '?' に置換
        """
        if not text:
            return ""
        
        # Unicode 正規化 (全角/半角統一、合字分解)
        text = unicodedata.normalize('NFKC', text)
        
        # 制御文字を削除 (改行・タブは保持)
        text = ''.join(c if c in '\n\t' or not unicodedata.category(c).startswith('C') else '' for c in text)
        
        # reportlab で描画できない文字を検出して置換
        safe_text = []
        for char in text:
            try:
                # テスト描画（実際には描画しない）
                pdfmetrics.getFont(self.font_name).face.getCharWidth(ord(char))
                safe_text.append(char)
            except:
                # フォントに存在しない文字
                logger.warning(f"[PDFExportService] Unsupported char: U+{ord(char):04X} ({char})")
                safe_text.append('?')
        
        return ''.join(safe_text)

    def export_pdf_with_comments(
        self,
        original_pdf_bytes: bytes,
        document_file_id: int
    ) -> BytesIO:
        logger.info(f"[PDFExportService] Start export. document_file_id={document_file_id} bytes_len={len(original_pdf_bytes)}")
        base_stream = BytesIO(original_pdf_bytes)
        reader = PdfReader(base_stream)
        writer = PdfWriter()

        logger.info(f"[PDFExportService] Original pages={len(reader.pages)}")
        for page in reader.pages:
            writer.add_page(page)

        highlights = self._get_highlights_with_comments(document_file_id)
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

    def _get_highlights_with_comments(self, document_file_id: int) -> List[Highlight]:
        """コメントツリーを構築して取得"""
        statement = (
            select(Highlight)
            .where(Highlight.document_file_id == document_file_id)
            .order_by(Highlight.created_at)
        )
        highlights = self.db.exec(statement).all()
        
        for h in highlights:
            # 全コメントを取得
            stmt_c = (
                select(Comment)
                .where(
                    Comment.highlight_id == h.id,
                    Comment.deleted_at.is_(None)
                )
                .order_by(Comment.created_at)
            )
            all_comments = list(self.db.exec(stmt_c).all())
            
            # ルートコメントのみを h.comments に設定
            h.comments = [c for c in all_comments if c.parent_id is None]
            
            # 各ルートコメントにリプライを紐付け
            for root_comment in h.comments:
                root_comment.replies = [
                    c for c in all_comments 
                    if c.parent_id == root_comment.id
                ]
        
        return highlights

    def _create_comment_pages(self, highlights: List[Highlight]) -> BytesIO:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 30 * mm

        c.setFont(self.font_name, 16)
        c.drawString(20 * mm, y, self._sanitize_text("コメント一覧"))
        y -= 15 * mm

        for idx, h in enumerate(highlights, 1):
            if y < 50 * mm:
                c.showPage()
                y = height - 30 * mm
                c.setFont(self.font_name, 16)
                c.drawString(20 * mm, y, self._sanitize_text("コメント一覧 (続き)"))
                y -= 15 * mm

            c.setFont(self.font_name, 12)
            c.drawString(20 * mm, y, self._sanitize_text(f"#{idx} ハイライト"))
            y -= 7 * mm

            c.setFont(self.font_name, 10)
            c.drawString(25 * mm, y, self._sanitize_text(f"作成者: {h.created_by}"))
            y -= 5 * mm
            c.drawString(25 * mm, y, self._sanitize_text(f"作成日時: {h.created_at.strftime('%Y-%m-%d %H:%M')}"))
            y -= 5 * mm

            if h.memo:
                memo_lines = self._wrap_text(self._sanitize_text(h.memo), 70)
                for i, line in enumerate(memo_lines):
                    prefix = "メモ: " if i == 0 else "      "
                    c.drawString(25 * mm, y, prefix + line)
                    y -= 5 * mm
                    if y < 30 * mm:
                        c.showPage()
                        y = height - 30 * mm

            if h.text:
                sanitized_text = self._sanitize_text(h.text)
                logger.debug(f"[PDFExportService] Original text length: {len(h.text)}, sanitized: {len(sanitized_text)}")
                lines = self._wrap_text(sanitized_text, 70)
                c.drawString(25 * mm, y, self._sanitize_text("選択テキスト:"))
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
                c.drawString(25 * mm, y, self._sanitize_text("コメント:"))
                y -= 6 * mm
                
                for comment in h.comments:
                    if y < 40 * mm:
                        c.showPage()
                        y = height - 30 * mm
                    
                    c.setFont(self.font_name, 9)
                    header = f"• {comment.author} ({comment.created_at.strftime('%Y-%m-%d %H:%M')})"
                    c.drawString(30 * mm, y, self._sanitize_text(header))
                    y -= 5 * mm
                    
                    text_lines = self._wrap_text(self._sanitize_text(comment.text), 75)
                    for line in text_lines:
                        if y < 30 * mm:
                            c.showPage()
                            y = height - 30 * mm
                        c.drawString(35 * mm, y, line)
                        y -= 5 * mm
                    
                    if hasattr(comment, 'replies') and comment.replies:
                        for reply in comment.replies:
                            if y < 35 * mm:
                                c.showPage()
                                y = height - 30 * mm
                            reply_text = self._sanitize_text(f"↳ {reply.author}: {reply.text}")
                            reply_lines = self._wrap_text(reply_text, 70)
                            for rline in reply_lines:
                                c.drawString(40 * mm, y, rline)
                                y -= 5 * mm
                                if y < 30 * mm:
                                    c.showPage()
                                    y = height - 30 * mm
            
            y -= 10 * mm

        c.save()
        buffer.seek(0)
        return buffer

    def _wrap_text(self, text: str, max_chars: int) -> List[str]:
        if not text:
            return [""]
        
        lines = []
        current_line = ""
        
        for char in text:
            if len(current_line) >= max_chars:
                lines.append(current_line)
                current_line = char
            else:
                current_line += char
        
        if current_line:
            lines.append(current_line)
        
        return lines if lines else [""]