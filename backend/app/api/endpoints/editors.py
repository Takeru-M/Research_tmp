from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Any
from app.schemas.editor import EditorStateIn
from app.db.base import get_session
from app.models import ProjectFile, Highlight, HighlightRect, Comment
from datetime import datetime

router = APIRouter(prefix="/api/v1/editor", tags=["editor"])

@router.post("/save")
def save_editor_state(editor_in: EditorStateIn, session: Session = Depends(get_session)) -> Any:
    """
    フロントの Redux editorState を受けて DB に格納する
    """
    try:
        # ここでは仮に project_file が事前に決まっているものとする
        # 実運用では editorState に project_file_id などを含める
        project_file_id = 1  # TODO: フロントから渡すか、URLパラメータで指定

        # --- Highlights ---
        for h in editor_in.highlights:
            # 既存確認（idベース）してなければ新規作成
            db_highlight = session.get(Highlight, h.id)
            if not db_highlight:
                db_highlight = Highlight(
                    id=h.id,
                    project_file_id=project_file_id,
                    created_by=h.createdBy,
                    text=h.text,
                    memo=h.memo,
                    type=h.type,
                    created_at=h.createdAt,
                    updated_at=datetime.utcnow(),
                )
                session.add(db_highlight)
            else:
                db_highlight.text = h.text
                db_highlight.memo = h.memo
                db_highlight.updated_at = datetime.utcnow()

            # --- Rects ---
            for r in h.rects:
                db_rect = session.get(HighlightRect, r.pageNum)  # 仮に pageNum で判定（要修正）
                if not db_rect:
                    db_rect = HighlightRect(
                        highlight_id=h.id,
                        page_num=r.pageNum,
                        x1=r.x1,
                        y1=r.y1,
                        x2=r.x2,
                        y2=r.y2,
                        element_type=r.elementType or "unknown",
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(db_rect)

        # --- Comments ---
        for c in editor_in.comments:
            db_comment = session.get(Comment, c.id)
            if not db_comment:
                db_comment = Comment(
                    id=c.id,
                    highlight_id=c.highlightId,
                    parent_id=c.parentId,
                    author=c.author,
                    text=c.text,
                    created_at=c.createdAt,
                    edited_at=c.editedAt,
                    deleted=c.deleted or False,
                )
                session.add(db_comment)
            else:
                db_comment.text = c.text
                db_comment.edited_at = c.editedAt or datetime.utcnow()
                db_comment.deleted = c.deleted or False

        session.commit()
        return {"status": "success"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
