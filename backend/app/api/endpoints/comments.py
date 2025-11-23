from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import comment as crud_comment
from app.schemas import CommentCreate, CommentUpdate, CommentRead

router = APIRouter()

@router.post("/", response_model=CommentRead)
def create_comment_endpoint(
    comment_in: CommentCreate, 
    session: Session = Depends(get_session)
):
    """新しいコメントを作成"""
    return crud_comment.create_comment(session, comment_in)

@router.get("/highlight/{highlight_id}", response_model=List[CommentRead])
def read_comments_by_highlight(
    highlight_id: int, 
    session: Session = Depends(get_session)
):
    """ハイライトに紐づくコメント一覧を取得"""
    return crud_comment.get_comments_by_highlight(session, highlight_id)

@router.get("/{comment_id}", response_model=CommentRead)
def read_comment_endpoint(
    comment_id: int, 
    session: Session = Depends(get_session)
):
    """特定のコメントを取得"""
    comment = crud_comment.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment

@router.put("/{comment_id}", response_model=CommentRead)
def update_comment_endpoint(
    comment_id: int, 
    comment_in: CommentUpdate, 
    session: Session = Depends(get_session)
):
    """コメントを更新"""
    comment = crud_comment.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return crud_comment.update_comment(session, comment, comment_in)

@router.delete("/{comment_id}", status_code=204)
def delete_comment_endpoint(
    comment_id: int, 
    session: Session = Depends(get_session)
):
    """コメントを削除"""
    comment = crud_comment.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    crud_comment.delete_comment(session, comment_id)
    return None
