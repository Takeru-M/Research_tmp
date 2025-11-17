from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models.comments import Comment
from app.schemas import CommentCreate, CommentUpdate

def create_comment(session: Session, comment_in: CommentCreate) -> Comment:
    db_comment = Comment(**comment_in.model_dump())
    session.add(db_comment)
    session.commit()
    session.refresh(db_comment)
    return db_comment

def get_comment_by_id(session: Session, comment_id: int) -> Optional[Comment]:
    statement = select(Comment).where(Comment.id == comment_id)
    return session.exec(statement).first()

def get_comments_by_file(session: Session, file_id: int) -> List[Comment]:
    statement = select(Comment).where(Comment.project_file_id == file_id)
    return session.exec(statement).all()

def update_comment(session: Session, comment: Comment, comment_in: CommentUpdate) -> Comment:
    update_data = comment_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(comment, key, value)
    comment.edited_at = datetime.utcnow()
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment

def delete_comment(session: Session, comment: Comment) -> Comment:
    comment.deleted = True
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment
