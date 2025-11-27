import logging
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from app.crud import project as crud_project
from app.schemas import ProjectCreate, ProjectUpdate, ProjectRead, CompletionStageUpdate
from app.core.security import get_current_user
from app.models import User
from app.services.pdf_export_service import PDFExportService
from app.models import ProjectFile
from app.utils.s3 import fetch_pdf_bytes

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

@router.get("/{project_id}/files/{file_id}/export")
async def export_pdf_with_comments(
    project_id: int,
    file_id: int,
    db: Session = Depends(get_session)
):
    logger.info(f"[Export][Backend] Start export project_id={project_id} file_id={file_id}")

    project_file = db.get(ProjectFile, file_id)
    if not project_file or project_file.project_id != project_id:
        logger.error(f"[Export][Backend] File not found or mismatched. file_id={file_id}, project_id={project_id}")
        raise HTTPException(status_code=404, detail="File not found")

    file_key = project_file.file_key
    logger.info(f"[Export][Backend] S3 file_key={file_key}")

    try:
        pdf_bytes = fetch_pdf_bytes(file_key)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch original PDF from S3")

    try:
        service = PDFExportService(db)
        output_pdf = service.export_pdf_with_comments(pdf_bytes, file_id)
        size = output_pdf.getbuffer().nbytes
        logger.info(f"[Export][Backend] Export done. bytes={size}, filename={project_file.file_name}")
    except Exception as e:
        logger.exception(f"[Export][Backend] Export failed: {e}")
        raise HTTPException(status_code=500, detail="Export failed")

    headers = {
        "Content-Disposition": f"attachment; filename={project_file.file_name.replace('.pdf', '_with_comments.pdf')}"
    }
    logger.info(f"[Export][Backend] Returning PDF headers={headers}")

    return StreamingResponse(output_pdf, media_type="application/pdf", headers=headers)

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
