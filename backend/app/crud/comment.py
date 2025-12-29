from typing import List, Optional
from sqlmodel import Session, select
from app.models.comments import Comment
from app.schemas.comment import CommentCreate, CommentUpdate
import logging
from datetime import datetime
from app.utils.constants import LLM_AUTHOR, LLM_AUTHOR_LOWER

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

def get_active_comments_by_highlight(session: Session, highlight_id: int) -> List[Comment]:
    """deleted_at が None のコメントのみ取得"""
    stmt = (
        select(Comment)
        .where(
            Comment.highlight_id == highlight_id,
            Comment.deleted_at.is_(None)
        )
        .order_by(Comment.created_at)
    )
    return session.exec(stmt).all()

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
    """
    コメント削除処理
    - ルートコメント（parent_id=None）かつ author=LLM: 子コメントごと全てハードデリート
    - LLMの子コメント（parent_id!=None かつ author=LLM）: 理由付きでソフトデリート
    - その他（非LLMコメント）: ハードデリート
    """
    statement = select(Comment).where(Comment.id == comment_id)
    comment = session.exec(statement).first()
    
    if not comment:
        logger.warning(f"[delete_comment] Comment not found: {comment_id}")
        return

    is_llm = (comment.author or "").strip().lower() == LLM_AUTHOR_LOWER
    is_root = comment.parent_id is None
    
    # LLMルートコメント: 子コメントごと全てハードデリート
    if is_root and is_llm:
        child_statement = select(Comment).where(Comment.parent_id == comment_id)
        child_comments = session.exec(child_statement).all()
        
        # 子コメントを先に削除
        for child in child_comments:
            session.delete(child)
            logger.info(f"[delete_comment] Child comment deleted: {child.id}")
        
        # ルートコメントを削除
        session.delete(comment)
        session.commit()
        logger.info(f"[delete_comment] LLM root comment and children hard-deleted: {comment_id}, children_count: {len(child_comments)}")
        return
    
    # LLM子コメント: 理由付きでソフトデリート
    if not is_root and is_llm:
        if not reason or not reason.strip():
            logger.error(f"[delete_comment] LLM child comment soft-delete attempted without reason: {comment_id}")
            raise ValueError("LLM子コメントの削除には理由が必須です")
        
        comment.deleted_at = datetime.utcnow()
        comment.deleted_reason = reason.strip()
        session.add(comment)
        session.commit()
        session.refresh(comment)
        logger.info(f"[delete_comment] LLM child comment soft-deleted: {comment_id}, reason: {reason[:50]}...")
        return
    
    # その他のコメント（非LLMコメント）: ハードデリート
    session.delete(comment)
    session.commit()
    logger.info(f"[delete_comment] Comment hard-deleted: {comment_id}, is_root: {is_root}, is_llm: {is_llm}")

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

def has_soft_deleted_llm(session: Session) -> bool:
    stmt = (
        select(Comment)
        .where(
            Comment.deleted_at.is_not(None),
            Comment.author.ilike(LLM_AUTHOR)
        )
        .limit(1)
    )
    return session.exec(stmt).first() is not None
