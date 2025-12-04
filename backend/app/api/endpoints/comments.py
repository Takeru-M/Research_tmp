from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import comment as crud_comment
from app.schemas.comment import CommentCreate, CommentUpdate, CommentRead
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment_endpoint(
    comment_in: CommentCreate, 
    session: Session = Depends(get_session)
):
    """新しいコメントを作成"""
    try:
        # 入力バリデーション
        if not comment_in.text or not comment_in.text.strip():
            logger.warning("Attempt to create comment with empty text")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="コメント本文を入力してください"
            )

        if comment_in.author and len(comment_in.author.strip()) == 0:
            logger.warning("Attempt to create comment with empty author")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="作成者名を入力してください"
            )

        logger.info(f"Creating comment: highlight_id={comment_in.highlight_id}, parent_id={comment_in.parent_id}")
        comment = crud_comment.create_comment(session, comment_in)
        logger.info(f"Comment created successfully: ID={comment.id}")
        return comment
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error creating comment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating comment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="コメント作成中にエラーが発生しました"
        )

@router.get("/highlight/{highlight_id}", response_model=List[CommentRead])
def read_comments_by_highlight(
    highlight_id: int, 
    session: Session = Depends(get_session)
):
    """ハイライトに紐づくコメント一覧を取得"""
    try:
        if highlight_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なハイライトIDです"
            )

        logger.info(f"Fetching comments for highlight_id={highlight_id}")
        comments = crud_comment.get_comments_by_highlight(session, highlight_id)
        logger.info(f"Found {len(comments)} comments for highlight_id={highlight_id}")
        return comments
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching comments for highlight {highlight_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="コメント取得中にエラーが発生しました"
        )

@router.get("/{comment_id}", response_model=CommentRead)
def read_comment_endpoint(
    comment_id: int, 
    session: Session = Depends(get_session)
):
    """特定のコメントを取得"""
    try:
        if comment_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なコメントIDです"
            )

        logger.info(f"Fetching comment: ID={comment_id}")
        comment = crud_comment.get_comment_by_id(session, comment_id)
        
        if not comment:
            logger.warning(f"Comment not found: ID={comment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="コメントが見つかりません"
            )
        
        return comment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching comment {comment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="コメント取得中にエラーが発生しました"
        )

@router.put("/{comment_id}", response_model=CommentRead)
def update_comment_endpoint(
    comment_id: int, 
    comment_in: CommentUpdate, 
    session: Session = Depends(get_session)
):
    """コメントを更新"""
    try:
        if comment_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なコメントIDです"
            )

        # 入力バリデーション
        if comment_in.text is not None and not comment_in.text.strip():
            logger.warning(f"Attempt to update comment {comment_id} with empty text")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="コメント本文を入力してください"
            )

        logger.info(f"Updating comment: ID={comment_id}")
        comment = crud_comment.get_comment_by_id(session, comment_id)
        
        if not comment:
            logger.warning(f"Comment not found for update: ID={comment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="コメントが見つかりません"
            )
        
        updated_comment = crud_comment.update_comment(session, comment, comment_in)
        logger.info(f"Comment updated successfully: ID={comment_id}")
        return updated_comment
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error updating comment {comment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error updating comment {comment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="コメント更新中にエラーが発生しました"
        )

@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment_endpoint(
    comment_id: int, 
    session: Session = Depends(get_session)
):
    """コメントを削除"""
    try:
        if comment_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なコメントIDです"
            )

        logger.info(f"Deleting comment: ID={comment_id}")
        comment = crud_comment.get_comment_by_id(session, comment_id)
        
        if not comment:
            logger.warning(f"Comment not found for deletion: ID={comment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="コメントが見つかりません"
            )
        
        crud_comment.delete_comment(session, comment_id)
        logger.info(f"Comment deleted successfully: ID={comment_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting comment {comment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="コメント削除中にエラーが発生しました"
        )
