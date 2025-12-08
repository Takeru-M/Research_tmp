from typing import List, Optional
from sqlmodel import Session, select
from app.models import DocumentFile
from app.schemas.document_file import DocumentFileCreate, DocumentFileUpdate
import logging

logger = logging.getLogger(__name__)

def create_document_file(session: Session, file_in: DocumentFileCreate) -> DocumentFile:
    """ドキュメントファイルを作成"""
    logger.info(f"[CRUD] Creating document file: {file_in.file_name}")
    db_file = DocumentFile.model_validate(file_in)
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    logger.info(f"[CRUD] Document file created with ID: {db_file.id}")
    return db_file


def get_document_file(session: Session, file_id: int) -> Optional[DocumentFile]:
    """ファイルIDで特定のファイルを取得"""
    statement = select(DocumentFile).where(DocumentFile.id == file_id)
    file = session.exec(statement).first()
    if file:
        logger.debug(f"[CRUD] Document file {file_id} found: {file.file_name}")
    else:
        logger.debug(f"[CRUD] Document file {file_id} not found")
    return file


def get_document_files(session: Session, document_id: int) -> List[DocumentFile]:
    """ドキュメントIDに紐づくファイル一覧を取得（作成日時の降順）"""
    statement = (
        select(DocumentFile)
        .where(DocumentFile.document_id == document_id)
        .order_by(DocumentFile.created_at.desc())
    )
    files = list(session.exec(statement).all())
    logger.debug(f"[CRUD] Retrieved {len(files)} files for document {document_id}")
    return files


def update_document_file(
    session: Session, 
    file_id: int, 
    file_in: DocumentFileUpdate
) -> Optional[DocumentFile]:
    """ファイル情報を更新"""
    logger.info(f"[CRUD] Updating document file {file_id}")
    db_file = get_document_file(session, file_id)
    if not db_file:
        logger.warning(f"[CRUD] Document file {file_id} not found for update")
        return None
    
    file_data = file_in.model_dump(exclude_unset=True)
    for key, value in file_data.items():
        logger.debug(f"[CRUD] Setting {key} = {value}")
        setattr(db_file, key, value)
    
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    logger.info(f"[CRUD] Document file {file_id} updated successfully")
    return db_file


def delete_document_file(session: Session, file_id: int) -> bool:
    """ファイルをDBから物理削除"""
    logger.info(f"[CRUD] Deleting document file {file_id}")
    db_file = get_document_file(session, file_id)
    if not db_file:
        logger.warning(f"[CRUD] Document file {file_id} not found for deletion")
        return False
    
    session.delete(db_file)
    session.commit()
    logger.info(f"[CRUD] Document file {file_id} deleted from database")
    return True
