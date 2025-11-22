from typing import List, Optional
from sqlmodel import Session, select
from app.models import ProjectFile
from app.schemas import ProjectFileCreate, ProjectFileUpdate

def create_project_file(session: Session, file_in: ProjectFileCreate) -> ProjectFile:
    """プロジェクトファイルを作成"""
    db_file = ProjectFile.model_validate(file_in)
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    return db_file


def get_project_file(session: Session, file_id: int) -> Optional[ProjectFile]:
    """ファイルIDで特定のファイルを取得"""
    statement = select(ProjectFile).where(ProjectFile.id == file_id)
    return session.exec(statement).first()


def get_project_files(session: Session, project_id: int) -> List[ProjectFile]:
    """プロジェクトIDに紐づくファイル一覧を取得（作成日時の降順）"""
    statement = (
        select(ProjectFile)
        .where(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())  # 作成日時の降順でソート
    )
    return list(session.exec(statement).all())


def update_project_file(
    session: Session, 
    file_id: int, 
    file_in: ProjectFileUpdate
) -> Optional[ProjectFile]:
    """ファイル情報を更新"""
    db_file = get_project_file(session, file_id)
    if not db_file:
        return None
    
    file_data = file_in.model_dump(exclude_unset=True)
    for key, value in file_data.items():
        setattr(db_file, key, value)
    
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    return db_file


def delete_project_file(session: Session, file_id: int) -> bool:
    """ファイルを削除"""
    db_file = get_project_file(session, file_id)
    if not db_file:
        return False
    
    session.delete(db_file)
    session.commit()
    return True
