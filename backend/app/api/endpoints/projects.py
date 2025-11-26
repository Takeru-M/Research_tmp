import logging
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import project as crud_project
from app.schemas import ProjectCreate, ProjectUpdate, ProjectRead, CompletionStageUpdate
from app.core.security import get_current_user
from app.models import User

router = APIRouter()

logger = logging.getLogger("app.projects")
logger.setLevel(logging.INFO)

@router.get("/", response_model=List[ProjectRead])
def read_projects(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"[GET /projects] User {current_user.id} requesting projects")
    projects = crud_project.get_projects_by_user(session, current_user.id)
    logger.info(f"[GET /projects] Returning {len(projects)} projects")
    return projects

@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"[POST /projects] User {current_user.id} creating project: {project_in.project_name}")
    project_data = project_in.model_copy(update={"user_id": current_user.id})
    project = crud_project.create_project(session, project_data)
    logger.info(f"[POST /projects] Project created with id: {project.id}")
    return project

@router.get("/{project_id}", response_model=ProjectRead)
def read_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = crud_project.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    return project

@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = crud_project.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    return crud_project.update_project(session, project, project_in)

@router.patch("/{project_id}/update-completion-stage", response_model=ProjectRead)
def update_project_completion_stage(
    project_id: int,
    stage_update: CompletionStageUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """プロジェクトのcompletion_stageを更新"""
    project = crud_project.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    
    logger.info(f"[PATCH /projects/{project_id}/completion-stage] Updating to: {stage_update.completion_stage}")
    updated_project = crud_project.update_completion_stage(session, project_id, stage_update.completion_stage)
    
    if not updated_project:
        raise HTTPException(status_code=500, detail="Failed to update completion stage")
    
    return updated_project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = crud_project.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
    crud_project.delete_project(session, project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
