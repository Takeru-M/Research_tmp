from typing import List, Optional
from sqlmodel import Session, select
from app.models.comments import Comment
from app.schemas.comment import CommentCreate, CommentUpdate
import logging
from app.utils.constants import LLM_AUTHOR_LOWER

logger = logging.getLogger(__name__)

def create_comment(session: Session, comment_in: CommentCreate) -> Comment:
    db_comment = Comment(**comment_in.model_dump())
    session.add(db_comment)
    session.commit()
    session.refresh(db_comment)
    return db_comment

def get_comments_by_user(session: Session, user_id: int) -> List[Comment]:
    statement = select(Comment).where(Comment.author == user_id)
    return session.exec(statement).all()

def get_comment_by_id(session: Session, comment_id: int) -> Optional[Comment]:
    return session.get(Comment, comment_id)

def get_comment_by_highlight_id(session: Session, highlight_id: int) -> Optional[Comment]:
    statement = select(Comment).where(Comment.highlight_id == highlight_id)
    return session.exec(statement).first()

def get_comments_by_highlight_id(session: Session, highlight_id: int) -> Optional[Comment]:
    statement = select(Comment).where(Comment.highlight_id == highlight_id)
    return session.exec(statement).all()

def get_comments_by_file(session: Session, file_id: int) -> List[Comment]:
    statement = select(Comment).where(Comment.document_file_id == file_id)
    return session.exec(statement).all()

def get_comments_by_highlight(session: Session, highlight_id: int) -> List[Comment]:
    return session.exec(
        select(Comment).where(Comment.highlight_id == highlight_id).order_by(Comment.created_at)
    ).all()

def update_comment(session: Session, comment: Comment, comment_in: CommentUpdate) -> Comment:
    update_data = comment_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(comment, key, value)
    comment.updated_at = datetime.utcnow()
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment

def delete_comment(session: Session, comment_id: int, reason: Optional[str] = None) -> None:
    """author が LLM の場合は理由付きでソフトデリート、それ以外はハードデリート"""
    statement = select(Comment).where(Comment.id == comment_id)
    comment = session.exec(statement).first()
    
    if not comment:
        logger.warning(f"[delete_comment] Comment not found: {comment_id}")
        return

    is_llm = (comment.author or "").strip().lower() == LLM_AUTHOR_LOWER
    
    if is_llm:
        # ソフトデリート（理由必須）
        if not reason or not reason.strip():
            logger.error(f"[delete_comment] LLM comment deletion attempted without reason: {comment_id}")
            raise ValueError("LLMコメントの削除には理由が必須です")
        
        comment.deleted_at = datetime.utcnow()
        comment.deleted_reason = reason.strip()
        session.add(comment)
        session.commit()
        session.refresh(comment)
        logger.info(f"[delete_comment] LLM comment soft-deleted: {comment_id}, reason: {reason[:50]}...")
    else:
        # 従来通りハードデリート
        session.delete(comment)
        session.commit()
        logger.info(f"[delete_comment] Non-LLM comment hard-deleted: {comment_id}")

def restore_latest_soft_deleted_llm(session: Session) -> Optional[Comment]:
    stmt = (
        select(Comment)
        .where((Comment.author.ilike(LLM_AUTHOR_LOWER)) & (Comment.deleted_at.is_not(None)))
        .order_by(Comment.deleted_at.desc())
        .limit(1)
    )
    comment = session.exec(stmt).first()
    if not comment:
        return None
    comment.deleted_at = None
    comment.deleted_reason = None
    comment.updated_at = datetime.utcnow()
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment

def has_soft_deleted_llm_by_highlight(session: Session, highlight_id: int) -> bool:
    # author が LLM（ケース無視）かつ deleted_at がセットされているものが存在するか
    stmt = select(Comment).where(
        Comment.highlight_id == highlight_id,
        Comment.deleted_at.is_not(None),
        Comment.author.ilike("LLM")
    ).limit(1)
    return session.exec(stmt).first() is not None
