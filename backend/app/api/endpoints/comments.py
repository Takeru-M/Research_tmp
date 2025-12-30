from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session
from typing import List, Optional
from app.db.base import get_session
from app.crud import comment as crud_comment
from app.crud import llm_comment_metadata as crud_llm_metadata
from app.schemas.comment import CommentCreate, CommentUpdate, CommentRead
from app.schemas.llm_comment_metadata import LLMCommentMetadataCreate
from app.utils.constants import LLM_AUTHOR_LOWER
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
        
        # LLMコメントの場合、メタデータを保存
        if comment.author.lower() == LLM_AUTHOR_LOWER and comment_in.suggestion_reason:
            metadata = crud_llm_metadata.create_llm_comment_metadata(
                session,
                comment.id,
                LLMCommentMetadataCreate(suggestion_reason=comment_in.suggestion_reason)
            )
            logger.info(f"LLM metadata saved: comment_id={comment.id}, suggestion_reason={comment_in.suggestion_reason[:50]}...")
        
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
    session: Session = Depends(get_session),
    reason: Optional[str] = Query(default=None, description="LLM コメントの削除理由")
):
    """コメントを削除（LLM は理由を保存してソフトデリート）"""
    try:
        if comment_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なコメントIDです"
            )

        logger.info(f"Deleting comment: ID={comment_id}, reason={reason}")
        # author 判定のため一度取得
        comment = crud_comment.get_comment_by_id(session, comment_id)
        if not comment:
            logger.warning(f"Comment not found for deletion: ID={comment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="コメントが見つかりません"
            )

        logger.info(f"Comment found for deletion: ID={comment_id}, author={comment.author}")
        is_llm = (comment.author or "").strip().lower() == LLM_AUTHOR_LOWER
        is_root = comment.parent_id is None
        logger.info(f"Is LLM comment: {is_llm}, Is root: {is_root}")

        # LLM子コメントのみ理由を求める（ルートコメントは理由不要で子ごと削除）
        if is_llm and not is_root and (reason is None or not reason.strip()):
            logger.warning("LLM child comment deletion attempted without reason")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LLM子コメントの削除理由を入力してください"
            )

        try:
            crud_comment.delete_comment(session, comment_id, reason)
        except ValueError as e:
            logger.error(f"Validation error deleting comment {comment_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        logger.info(f"Comment deleted (soft/hard) successfully: ID={comment_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting comment {comment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="コメント削除中にエラーが発生しました"
        )

@router.get("/llm/soft-deleted/exists")
def soft_deleted_llm_exists(
    session: Session = Depends(get_session)
):
    """ソフトデリート済みのLLMコメントが存在するかを判定"""
    try:
        exists = crud_comment.has_soft_deleted_llm(session)
        return {"exists": bool(exists)}
    except Exception as e:
        logger.error(f"Error checking soft-deleted LLM comments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ソフトデリート状況の取得中にエラーが発生しました"
        )

@router.post("/llm/soft-deleted/restore-latest", response_model=CommentRead)
def restore_latest_soft_deleted_llm_endpoint(
    session: Session = Depends(get_session)
):
    try:
        restored = crud_comment.restore_latest_soft_deleted_llm(session)
        if not restored:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="復元可能なLLMコメントがありません"
            )
        return restored
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring soft-deleted LLM comment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLMコメント復元中にエラーが発生しました"
        )

@router.post("/{comment_id}/llm-metadata", status_code=status.HTTP_201_CREATED)
def create_or_update_llm_metadata_endpoint(
    comment_id: int,
    metadata_in: LLMCommentMetadataCreate,
    session: Session = Depends(get_session)
):
    """LLMコメントのメタデータを作成または更新"""
    try:
        if comment_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なコメントIDです"
            )

        # コメント存在確認
        comment = crud_comment.get_comment_by_id(session, comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"コメントID {comment_id} が見つかりません"
            )

        # LLMコメントであることを確認
        if comment.author.lower() != LLM_AUTHOR_LOWER:
            logger.warning(f"Attempt to add LLM metadata to non-LLM comment: {comment_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LLMコメントのみメタデータを追加できます"
            )

        logger.info(f"Creating/updating LLM metadata for comment {comment_id}")
        metadata = crud_llm_metadata.update_llm_metadata_deletion_reason(
            session, comment_id, metadata_in.deletion_reason or ""
        ) if metadata_in.deletion_reason else crud_llm_metadata.create_llm_comment_metadata(
            session, comment_id, metadata_in
        )
        
        logger.info(f"LLM metadata saved: comment_id={comment_id}")
        return {
            "id": metadata.id,
            "comment_id": metadata.comment_id,
            "suggestion_reason": metadata.suggestion_reason,
            "deletion_reason": metadata.deletion_reason,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating LLM metadata for comment {comment_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLMメタデータ作成中にエラーが発生しました"
        )