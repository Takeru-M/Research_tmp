from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import project as crud_project
from app.schemas import ProjectCreate, ProjectUpdate, ProjectRead

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectRead)
def create_project(project_in: ProjectCreate, session: Session = Depends(get_session)):
    return crud_project.create_project(session, project_in)

@router.get("/", response_model=List[ProjectRead])
def read_projects(session: Session = Depends(get_session)):
    return crud_project.get_projects(session)

@router.get("/{project_id}", response_model=ProjectRead)
def read_project(project_id: int, session: Session = Depends(get_session)):
    project = crud_project.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, project_in: ProjectUpdate, session: Session = Depends(get_session)):
    project = crud_project.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud_project.update_project(session, project, project_in)

@router.delete("/{project_id}", response_model=ProjectRead)
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = crud_project.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud_project.delete_project(session)
