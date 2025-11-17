from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import project_file as crud_file
from app.schemas import ProjectFileCreate, ProjectFileUpdate, ProjectFileRead

router = APIRouter(prefix="/files", tags=["project_files"])

@router.post("/", response_model=ProjectFileRead)
def create_file(file_in: ProjectFileCreate, session: Session = Depends(get_session)):
    return crud_file.create_project_file(session, file_in)

@router.get("/project/{project_id}", response_model=List[ProjectFileRead])
def read_files_by_project(project_id: int, session: Session = Depends(get_session)):
    return crud_file.get_project_files(session, project_id)

@router.get("/{file_id}", response_model=ProjectFileRead)
def read_file(file_id: int, session: Session = Depends(get_session)):
    file = crud_file.get_project_file_by_id(session, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file

@router.put("/{file_id}", response_model=ProjectFileRead)
def update_file(file_id: int, file_in: ProjectFileUpdate, session: Session = Depends(get_session)):
    file = crud_file.get_project_file_by_id(session, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return crud_file.update_project_file(session, file, file_in)

@router.delete("/{file_id}", response_model=ProjectFileRead)
def delete_file(file_id: int, session: Session = Depends(get_session)):
    file = crud_file.get_project_file_by_id(session, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return crud_file.delete_project_file(session, file)
