from typing import Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models.document_formatted_text import DocumentFormattedText
from app.schemas.document_formatted_text import DocumentFormattedTextCreate, DocumentFormattedTextUpdate

def create_formatted_text(session: Session, formatted_text_in: DocumentFormattedTextCreate) -> DocumentFormattedText:
    """フォーマット済みテキストを作成"""
    db_formatted_text = DocumentFormattedText(**formatted_text_in.model_dump())
    session.add(db_formatted_text)
    session.commit()
    session.refresh(db_formatted_text)
    return db_formatted_text

def get_formatted_text_by_document(session: Session, document_id: int) -> Optional[DocumentFormattedText]:
    """ドキュメントIDでフォーマット済みテキストを取得"""
    statement = select(DocumentFormattedText).where(
        DocumentFormattedText.document_id == document_id
    )
    return session.exec(statement).first()

def update_formatted_text(
    session: Session, 
    formatted_text: DocumentFormattedText, 
    formatted_text_in: DocumentFormattedTextUpdate
) -> DocumentFormattedText:
    """フォーマット済みテキストを更新"""
    update_data = formatted_text_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(formatted_text, key, value)
    formatted_text.updated_at = datetime.utcnow()
    session.add(formatted_text)
    session.commit()
    session.refresh(formatted_text)
    return formatted_text

def delete_formatted_text(session: Session, formatted_text: DocumentFormattedText) -> None:
    """フォーマット済みテキストを削除"""
    session.delete(formatted_text)
    session.commit()
