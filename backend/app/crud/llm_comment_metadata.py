from typing import Optional
from sqlmodel import Session, select
from app.models.comments import Comment
from app.models.llm_comment_metadata import LLMCommentMetadata
from app.schemas.llm_comment_metadata import LLMCommentMetadataCreate
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def create_llm_comment_metadata(
    session: Session,
    comment_id: int,
    metadata_in: LLMCommentMetadataCreate
) -> LLMCommentMetadata:
    """LLMコメントのメタデータを作成"""
    db_metadata = LLMCommentMetadata(
        comment_id=comment_id,
        suggestion_reason=metadata_in.suggestion_reason,
        deletion_reason=metadata_in.deletion_reason
    )
    session.add(db_metadata)
    session.commit()
    session.refresh(db_metadata)
    return db_metadata

def get_llm_metadata_by_comment_id(
    session: Session,
    comment_id: int
) -> Optional[LLMCommentMetadata]:
    """コメントIDでLLMメタデータを取得"""
    statement = select(LLMCommentMetadata).where(
        LLMCommentMetadata.comment_id == comment_id
    )
    return session.exec(statement).first()

def update_llm_metadata_deletion_reason(
    session: Session,
    comment_id: int,
    deletion_reason: str
) -> Optional[LLMCommentMetadata]:
    """LLMコメントの削除理由を更新"""
    metadata = get_llm_metadata_by_comment_id(session, comment_id)
    if not metadata:
        # メタデータが存在しない場合は作成
        metadata = create_llm_comment_metadata(
            session,
            comment_id,
            LLMCommentMetadataCreate(deletion_reason=deletion_reason)
        )
    else:
        metadata.deletion_reason = deletion_reason
        metadata.updated_at = datetime.utcnow()
        session.add(metadata)
        session.commit()
        session.refresh(metadata)
    
    logger.info(f"[update_llm_metadata_deletion_reason] Updated comment {comment_id}: {deletion_reason[:50]}...")
    return metadata
