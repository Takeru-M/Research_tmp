from typing import List, Optional
from sqlmodel import Session, select
from app.models.highlights import Highlight
from app.models.highlight_rects import HighlightRect
from app.schemas.highlight import HighlightCreate, HighlightUpdate

def create_highlight(session: Session, highlight_in: HighlightCreate) -> Highlight:
    db_highlight = Highlight(**highlight_in.model_dump())
    session.add(db_highlight)
    session.commit()
    session.refresh(db_highlight)
    return db_highlight

def get_highlight_by_id(session: Session, highlight_id: int) -> Optional[Highlight]:
    """IDでハイライトを取得"""
    statement = select(Highlight).where(Highlight.id == highlight_id)
    return session.exec(statement).first()

def get_highlights_by_file(session: Session, file_id: int) -> List[Highlight]:
    statement = select(Highlight).where(Highlight.project_file_id == file_id)
    return session.exec(statement).all()

def update_highlight(session: Session, highlight: Highlight, highlight_in: HighlightUpdate) -> Highlight:
    update_data = highlight_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(highlight, key, value)
    session.add(highlight)
    session.commit()
    session.refresh(highlight)
    return highlight

def delete_highlight(session: Session, highlight: Highlight) -> Highlight:
    session.delete(highlight)
    session.commit()
    return highlight

def delete_highlight(session: Session, highlight_id: int) -> None:
    """ハイライトと関連するコメント、矩形を削除"""
    from app.models.comments import Comment
    
    # 関連するコメントを先に削除
    statement = select(Comment).where(Comment.highlight_id == highlight_id)
    comments = session.exec(statement).all()
    for comment in comments:
        session.delete(comment)
    
    # 関連する矩形を削除
    statement = select(HighlightRect).where(HighlightRect.highlight_id == highlight_id)
    rects = session.exec(statement).all()
    for rect in rects:
        session.delete(rect)
    
    # ハイライトを削除
    statement = select(Highlight).where(Highlight.id == highlight_id)
    highlight = session.exec(statement).first()
    if highlight:
        session.delete(highlight)
        session.commit()
