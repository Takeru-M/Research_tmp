from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import highlight as crud_highlight
from app.schemas import HighlightCreate, HighlightUpdate, HighlightRead

router = APIRouter()

@router.post("/", response_model=HighlightRead)
def create_highlight(highlight_in: HighlightCreate, session: Session = Depends(get_session)):
    return crud_highlight.create_highlight(session, highlight_in)

@router.get("/file/{file_id}", response_model=List[HighlightRead])
def read_highlights(file_id: int, session: Session = Depends(get_session)):
    return crud_highlight.get_highlights_by_file(session, file_id)

@router.get("/{highlight_id}", response_model=HighlightRead)
def read_highlight(highlight_id: int, session: Session = Depends(get_session)):
    highlight = crud_highlight.get_highlight_by_id(session, highlight_id)
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    return highlight

@router.put("/{highlight_id}", response_model=HighlightRead)
def update_highlight(highlight_id: int, highlight_in: HighlightUpdate, session: Session = Depends(get_session)):
    highlight = crud_highlight.get_highlight_by_id(session, highlight_id)
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    return crud_highlight.update_highlight(session, highlight, highlight_in)

@router.delete("/{highlight_id}", response_model=HighlightRead)
def delete_highlight(highlight_id: int, session: Session = Depends(get_session)):
    highlight = crud_highlight.get_highlight_by_id(session, highlight_id)
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    return crud_highlight.delete_highlight(session, highlight)
