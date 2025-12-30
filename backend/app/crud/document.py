from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

def create_document(session: Session, document_in: DocumentCreate) -> Document:
    db_document = Document(**document_in.model_dump())
    session.add(db_document)
    session.commit()
    session.refresh(db_document)
    return db_document

def get_document(session: Session, document_id: int) -> Optional[Document]:
    """ドキュメントIDで特定のドキュメントを取得"""
    statement = select(Document).where(
        Document.id == document_id,
        Document.deleted_at.is_(None)
    )
    return session.exec(statement).first()

def get_documents(session: Session, offset: int = 0, limit: int = 100) -> List[Document]:
    statement = select(Document).where(
        Document.deleted_at.is_(None)
    ).offset(offset).limit(limit)
    return list(session.exec(statement).all())

def get_documents_by_user(session: Session, user_id: int, offset: int = 0, limit: int = 100) -> List[Document]:
    statement = select(Document).where(
        Document.user_id == user_id,
        Document.deleted_at.is_(None)
    ).offset(offset).limit(limit).order_by(Document.created_at.desc())
    return list(session.exec(statement).all())

def get_document_by_name_and_user(session: Session, user_id: int, document_name: str) -> Optional[Document]:
    """特定ユーザーのドキュメント名でドキュメントを取得（重複チェック用）"""
    statement = select(Document).where(
        Document.user_id == user_id,
        Document.document_name == document_name,
        Document.deleted_at.is_(None)
    )
    return session.exec(statement).first()

def update_document(session: Session, document: Document, document_in: DocumentUpdate) -> Document:
    update_data = document_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(document, key, value)
    document.updated_at = datetime.utcnow()
    session.add(document)
    session.commit()
    session.refresh(document)
    return document

def update_completion_stage(session: Session, document_id: int, completion_stage: int) -> Optional[Document]:
    """ドキュメントのcompletion_stageを更新"""
    document = get_document(session, document_id)
    if not document:
        return None
    document.stage = completion_stage
    document.updated_at = datetime.utcnow()
    session.add(document)
    session.commit()
    session.refresh(document)
    return document

def delete_document(session: Session, document: Document) -> None:
    """ドキュメントを物理削除"""
    session.delete(document)
    session.commit()

def soft_delete_document(session: Session, document: Document) -> Document:
    """ドキュメントを論理削除"""
    document.deleted_at = datetime.utcnow()
    session.add(document)
    session.commit()
    session.refresh(document)
    return document
