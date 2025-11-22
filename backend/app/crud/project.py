from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models import Project
from app.schemas import ProjectCreate, ProjectUpdate

def create_project(session: Session, project_in: ProjectCreate) -> Project:
    db_project = Project(**project_in.model_dump())
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

def get_project(session: Session, project_id: int) -> Optional[Project]:
    """プロジェクトIDで特定のプロジェクトを取得"""
    statement = select(Project).where(Project.id == project_id)
    return session.exec(statement).first()

def get_projects(session: Session, offset: int = 0, limit: int = 100) -> List[Project]:
    statement = select(Project).offset(offset).limit(limit)
    return session.exec(statement).all()

def get_projects_by_user(session: Session, user_id: int, offset: int = 0, limit: int = 100) -> List[Project]:
    statement = select(Project).where(Project.user_id == user_id).offset(offset).limit(limit)
    return session.exec(statement).all()

def update_project(session: Session, project: Project, project_in: ProjectUpdate) -> Project:
    update_data = project_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

def delete_project(session: Session, project: Project) -> Project:
    session.delete(project)
    session.commit()
    return project
