from typing import List, Optional
from sqlmodel import Session, select
from app.models import ProjectFile
from app.schemas import ProjectFileCreate, ProjectFileUpdate
import logging

logger = logging.getLogger(__name__)

def create_project_file(session: Session, file_in: ProjectFileCreate) -> ProjectFile:
    """プロジェクトファイルを作成"""
    logger.info(f"[CRUD] Creating project file: {file_in.file_name}")
    db_file = ProjectFile.model_validate(file_in)
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    logger.info(f"[CRUD] Project file created with ID: {db_file.id}")
    return db_file


def get_project_file(session: Session, file_id: int) -> Optional[ProjectFile]:
    """ファイルIDで特定のファイルを取得"""
    statement = select(ProjectFile).where(ProjectFile.id == file_id)
    file = session.exec(statement).first()
    if file:
        logger.debug(f"[CRUD] Project file {file_id} found: {file.file_name}")
    else:
        logger.debug(f"[CRUD] Project file {file_id} not found")
    return file


def get_project_files(session: Session, project_id: int) -> List[ProjectFile]:
    """プロジェクトIDに紐づくファイル一覧を取得（作成日時の降順）"""
    statement = (
        select(ProjectFile)
        .where(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
    )
    files = list(session.exec(statement).all())
    logger.debug(f"[CRUD] Retrieved {len(files)} files for project {project_id}")
    return files


def update_project_file(
    session: Session, 
    file_id: int, 
    file_in: ProjectFileUpdate
) -> Optional[ProjectFile]:
    """ファイル情報を更新"""
    logger.info(f"[CRUD] Updating project file {file_id}")
    db_file = get_project_file(session, file_id)
    if not db_file:
        logger.warning(f"[CRUD] Project file {file_id} not found for update")
        return None
    
    file_data = file_in.model_dump(exclude_unset=True)
    for key, value in file_data.items():
        logger.debug(f"[CRUD] Setting {key} = {value}")
        setattr(db_file, key, value)
    
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    logger.info(f"[CRUD] Project file {file_id} updated successfully")
    return db_file


def delete_project_file(session: Session, file_id: int) -> bool:
    """ファイルをDBから物理削除"""
    logger.info(f"[CRUD] Deleting project file {file_id}")
    db_file = get_project_file(session, file_id)
    if not db_file:
        logger.warning(f"[CRUD] Project file {file_id} not found for deletion")
        return False
    
    session.delete(db_file)
    session.commit()
    logger.info(f"[CRUD] Project file {file_id} deleted from database")
    return True
