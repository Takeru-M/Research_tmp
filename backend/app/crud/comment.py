from typing import List, Optional
from sqlmodel import Session, select
from app.models.comments import Comment
from app.models.llm_comment_metadata import LLMCommentMetadata
from app.schemas.comment import CommentCreate, CommentUpdate
from app.schemas.llm_comment_metadata import LLMCommentMetadataCreate
import logging
from datetime import datetime
from app.utils.constants import LLM_AUTHOR, LLM_AUTHOR_LOWER
from app.crud import llm_comment_metadata as crud_llm_metadata

logger = logging.getLogger(__name__)

def create_comment(session: Session, comment_in: CommentCreate) -> Comment:
    # 親コメントの存在と同一ハイライトをチェック（子コメントの場合）
    if comment_in.parent_id is not None:
        parent = session.get(Comment, comment_in.parent_id)
        if not parent:
            logger.error(f"[create_comment] Parent comment not found: parent_id={comment_in.parent_id}")
            raise ValueError("親コメントが存在しません")
        if parent.highlight_id != comment_in.highlight_id:
            logger.error(
                f"[create_comment] Parent/highlight mismatch: parent_id={comment_in.parent_id}, "
                f"parent.highlight_id={parent.highlight_id}, child.highlight_id={comment_in.highlight_id}"
            )
            raise ValueError("親コメントと同じハイライトにのみ返信できます")

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

def get_active_comments_by_highlight(session: Session, highlight_id: int) -> List[Comment]:
    """
    ハイライトに紐づくすべてのアクティブコメント（ルート + 子）を取得
    子コメントのhighlight_idがnullでも取得できるように、ルートコメントから辿る
    """
    # まずルートコメントを取得
    root_stmt = (
        select(Comment)
        .where(
            Comment.highlight_id == highlight_id,
            Comment.parent_id.is_(None)
        )
        .order_by(Comment.created_at)
    )
    root_comments = list(session.exec(root_stmt).all())
    
    if not root_comments:
        return []
    
    # ルートコメントのIDを収集
    root_ids = [rc.id for rc in root_comments]
    
    # 子コメントを取得（parent_idがルートコメントのいずれか）
    child_stmt = (
        select(Comment)
        .where(
            Comment.parent_id.in_(root_ids)
        )
        .order_by(Comment.created_at)
    )
    child_comments = list(session.exec(child_stmt).all())

    # LLM子コメントのうち、メタデータで削除理由が設定されているものは除外（ソフトデリート扱い）
    llm_child_ids = [c.id for c in child_comments if (c.author or "").strip().lower() == LLM_AUTHOR_LOWER]
    excluded_ids: set[int] = set()
    if llm_child_ids:
        meta_stmt = (
            select(LLMCommentMetadata.comment_id)
            .where(
                LLMCommentMetadata.comment_id.in_(llm_child_ids),
                LLMCommentMetadata.deletion_reason.is_not(None)
            )
        )
        excluded_ids = set([row[0] for row in session.exec(meta_stmt).all()])
    child_comments = [c for c in child_comments if c.id not in excluded_ids]
    
    # ルートコメントと子コメントを結合して返す
    all_comments = root_comments + child_comments
    
    logger.info(f"[get_active_comments_by_highlight] highlight_id={highlight_id}: "
                f"root={len(root_comments)}, children={len(child_comments)}, total={len(all_comments)}")
    
    return all_comments

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
    
    # LLM子コメント: 理由付きでソフトデリート（メタデータに理由を保存）
    if not is_root and is_llm:
        if not reason or not reason.strip():
            logger.error(f"[delete_comment] LLM child comment soft-delete attempted without reason: {comment_id}")
            raise ValueError("LLM子コメントの削除には理由が必須です")
        
        # LLMメタデータに削除理由を保存
        crud_llm_metadata.update_llm_metadata_deletion_reason(session, comment_id, reason.strip())
        logger.info(f"[delete_comment] LLM child comment soft-deleted (via metadata): {comment_id}, reason: {reason[:50]}...")
        return
    
    # その他のコメント（非LLMコメント）: ハードデリート
    session.delete(comment)
    session.commit()
    logger.info(f"[delete_comment] Comment hard-deleted: {comment_id}, is_root: {is_root}, is_llm: {is_llm}")

def restore_latest_soft_deleted_llm(session: Session) -> Optional[Comment]:
    """
    メタデータの削除理由が設定された最新のLLM子コメントを復元（削除理由をクリア）
    復元対象: author=LLM かつ parent_id!=None かつ deletion_reasonがNotNull
    最新判定: LLMCommentMetadata.updated_at の降順
    """
    meta_stmt = (
        select(LLMCommentMetadata)
        .join(Comment, Comment.id == LLMCommentMetadata.comment_id)
        .where(
            LLMCommentMetadata.deletion_reason.is_not(None),
            Comment.author.ilike(LLM_AUTHOR_LOWER),
            Comment.parent_id.is_not(None)
        )
        .order_by(LLMCommentMetadata.updated_at.desc())
        .limit(1)
    )
    metadata = session.exec(meta_stmt).first()
    if not metadata:
        return None

    # 削除理由をクリアして復元
    metadata.deletion_reason = None
    metadata.updated_at = datetime.utcnow()
    session.add(metadata)
    session.commit()
    session.refresh(metadata)

    # 復元されたコメントを返す
    return session.get(Comment, metadata.comment_id)

def has_soft_deleted_llm(session: Session) -> bool:
    """ソフトデリート済みのLLM子コメント（メタデータの削除理由が設定されている）が存在するかを判定"""
    stmt = (
        select(LLMCommentMetadata.id)
        .join(Comment, Comment.id == LLMCommentMetadata.comment_id)
        .where(
            LLMCommentMetadata.deletion_reason.is_not(None),
            Comment.author.ilike(LLM_AUTHOR_LOWER),
            Comment.parent_id.is_not(None)
        )
        .limit(1)
    )
    result = session.exec(stmt).first()
    exists = result is not None
    logger.info(f"[has_soft_deleted_llm] Checking for soft-deleted LLM comments (via metadata): exists={exists}")
    return exists

def get_comments_by_highlight(session: Session, highlight_id: int) -> List[Comment]:
    """ハイライトに紐づくコメント一覧（ソフトデリート済みLLM子コメントは除外）"""
    # 既存利用を考慮して、アクティブコメント取得のロジックを流用
    return get_active_comments_by_highlight(session, highlight_id)
