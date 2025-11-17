from typing import List, Optional
from sqlmodel import Session, select
from app.models.highlight_rects import HighlightRect
from app.schemas import HighlightRectCreate, HighlightRectUpdate

def create_highlight_rect(session: Session, rect_in: HighlightRectCreate) -> HighlightRect:
    db_rect = HighlightRect(**rect_in.model_dump())
    session.add(db_rect)
    session.commit()
    session.refresh(db_rect)
    return db_rect

def get_rect_by_id(session: Session, rect_id: int) -> Optional[HighlightRect]:
    """単一 ID による取得"""
    statement = select(HighlightRect).where(HighlightRect.id == rect_id)
    return session.exec(statement).first()

def get_rects_by_highlight(session: Session, highlight_id: int) -> List[HighlightRect]:
    """ハイライトに紐づく全矩形を取得"""
    statement = select(HighlightRect).where(HighlightRect.highlight_id == highlight_id)
    return session.exec(statement).all()

def update_highlight_rect(session: Session, rect: HighlightRect, rect_in: HighlightRectUpdate) -> HighlightRect:
    update_data = rect_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rect, key, value)
    session.add(rect)
    session.commit()
    session.refresh(rect)
    return rect

def delete_highlight_rect(session: Session, rect: HighlightRect) -> HighlightRect:
    session.delete(rect)
    session.commit()
    return rect
