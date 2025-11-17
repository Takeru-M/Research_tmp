from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models.project_files import ProjectFile
from app.schemas import ProjectFileCreate, ProjectFileUpdate

def create_project_file(session: Session, file_in: ProjectFileCreate) -> ProjectFile:
    db_file = ProjectFile(**file_in.model_dump())
    session.add(db_file)
    session.commit()
    session.refresh(db_file)
    return db_file

def get_project_file_by_id(session: Session, file_id: int) -> Optional[ProjectFile]:
    statement = select(ProjectFile).where(ProjectFile.id == file_id)
    return session.exec(statement).first()

def get_project_files(session: Session, project_id: int) -> List[ProjectFile]:
    statement = select(ProjectFile).where(ProjectFile.project_id == project_id)
    return session.exec(statement).all()

def update_project_file(session: Session, file: ProjectFile, file_in: ProjectFileUpdate) -> ProjectFile:
    update_data = file_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(file, key, value)
    session.add(file)
    session.commit()
    session.refresh(file)
    return file

def delete_project_file(session: Session, file: ProjectFile) -> ProjectFile:
    session.delete(file)
    session.commit()
    return file
