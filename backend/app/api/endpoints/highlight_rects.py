from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import highlight_rect as crud_rect
from app.schemas import HighlightRectCreate, HighlightRectUpdate, HighlightRectRead

router = APIRouter(prefix="/highlight-rects", tags=["highlight_rects"])

@router.post("/", response_model=HighlightRectRead)
def create_rect(rect_in: HighlightRectCreate, session: Session = Depends(get_session)):
    return crud_rect.create_highlight_rect(session, rect_in)

@router.get("/highlight/{highlight_id}", response_model=List[HighlightRectRead])
def read_rects_by_highlight(highlight_id: int, session: Session = Depends(get_session)):
    return crud_rect.get_rects_by_highlight(session, highlight_id)

@router.get("/{rect_id}", response_model=HighlightRectRead)
def read_rect(rect_id: int, session: Session = Depends(get_session)):
    rect = crud_rect.get_rect_by_id(session, rect_id)
    if not rect:
        raise HTTPException(status_code=404, detail="HighlightRect not found")
    return rect

@router.put("/{rect_id}", response_model=HighlightRectRead)
def update_rect(rect_id: int, rect_in: HighlightRectUpdate, session: Session = Depends(get_session)):
    rect = crud_rect.get_rect_by_id(session, rect_id)
    if not rect:
        raise HTTPException(status_code=404, detail="HighlightRect not found")
    return crud_rect.update_highlight_rect(session, rect, rect_in)

@router.delete("/{rect_id}", response_model=HighlightRectRead)
def delete_rect(rect_id: int, session: Session = Depends(get_session)):
    rect = crud_rect.get_rect_by_id(session, rect_id)
    if not rect:
        raise HTTPException(status_code=404, detail="HighlightRect not found")
    return crud_rect.delete_highlight_rect(session, rect)
