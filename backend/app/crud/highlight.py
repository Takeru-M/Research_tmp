from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models.highlights import Highlight
from app.schemas import HighlightCreate, HighlightUpdate

def create_highlight(session: Session, highlight_in: HighlightCreate) -> Highlight:
    db_highlight = Highlight(**highlight_in.model_dump())
    session.add(db_highlight)
    session.commit()
    session.refresh(db_highlight)
    return db_highlight

def get_highlight_by_id(session: Session, highlight_id: int) -> Optional[Highlight]:
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
