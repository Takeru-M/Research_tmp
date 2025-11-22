from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import comment as crud_comment
from app.schemas import CommentCreate, CommentUpdate, CommentRead

router = APIRouter()

@router.post("/", response_model=CommentRead)
def create_comment(comment_in: CommentCreate, session: Session = Depends(get_session)):
    return crud_comment.create_comment(session, comment_in)

@router.get("/file/{file_id}", response_model=List[CommentRead])
def read_comments(file_id: int, session: Session = Depends(get_session)):
    return crud_comment.get_comments_by_file(session, file_id)

@router.get("/{comment_id}", response_model=CommentRead)
def read_comment(comment_id: int, session: Session = Depends(get_session)):
    comment = crud_comment.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment

@router.put("/{comment_id}", response_model=CommentRead)
def update_comment(comment_id: int, comment_in: CommentUpdate, session: Session = Depends(get_session)):
    comment = crud_comment.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return crud_comment.update_comment(session, comment, comment_in)

@router.delete("/{comment_id}", response_model=CommentRead)
def delete_comment(comment_id: int, session: Session = Depends(get_session)):
    comment = crud_comment.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return crud_comment.delete_comment(session)
