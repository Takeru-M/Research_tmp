import logging
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, delete
from typing import List
from sqlalchemy.exc import IntegrityError
from app.db.base import get_session
from app.crud import project as crud_project
from app.crud import project_file as crud_project_file
from app.schemas import ProjectCreate, ProjectUpdate, ProjectRead, CompletionStageUpdate
from app.core.security import get_current_user
from app.models import User, Project, ProjectFile, Highlight, HighlightRect, Comment
from app.services.pdf_export_service import PDFExportService
from app.utils.s3 import fetch_pdf_bytes, delete_s3_files

router = APIRouter()

logger = logging.getLogger("app.projects")
logger.setLevel(logging.INFO)

# コンソールハンドラーを追加（まだ設定されていない場合）
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s [%(name)s] %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

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
    logger.info(f"[GET /projects/{project_id}] User {current_user.id} requesting project")
    project = crud_project.get_project(session, project_id)
    if not project:
        logger.warning(f"[GET /projects/{project_id}] Project not found")
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        logger.warning(f"[GET /projects/{project_id}] User {current_user.id} not authorized")
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    logger.info(f"[GET /projects/{project_id}] Project found: {project.project_name}")
    return project

@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"[PUT /projects/{project_id}] User {current_user.id} updating project with data: {project_in.model_dump(exclude_unset=True)}")
    project = crud_project.get_project(session, project_id)
    if not project:
        logger.warning(f"[PUT /projects/{project_id}] Project not found")
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        logger.warning(f"[PUT /projects/{project_id}] User {current_user.id} not authorized")
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    
    updated_project = crud_project.update_project(session, project, project_in)
    logger.info(f"[PUT /projects/{project_id}] Project updated successfully: {updated_project.project_name}")
    return updated_project

@router.patch("/{project_id}/update-completion-stage", response_model=ProjectRead)
def update_project_completion_stage(
    project_id: int,
    stage_update: CompletionStageUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """プロジェクトのcompletion_stageを更新"""
    logger.info(f"[PATCH /projects/{project_id}/completion-stage] User {current_user.id} updating stage to: {stage_update.completion_stage}")
    project = crud_project.get_project(session, project_id)
    if not project:
        logger.warning(f"[PATCH /projects/{project_id}/completion-stage] Project not found")
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        logger.warning(f"[PATCH /projects/{project_id}/completion-stage] User {current_user.id} not authorized")
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    
    updated_project = crud_project.update_completion_stage(session, project_id, stage_update.completion_stage)
    
    if not updated_project:
        logger.error(f"[PATCH /projects/{project_id}/completion-stage] Failed to update completion stage")
        raise HTTPException(status_code=500, detail="Failed to update completion stage")
    
    logger.info(f"[PATCH /projects/{project_id}/completion-stage] Stage updated successfully")
    return updated_project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """プロジェクトとそれに紐づくファイルをDBとS3から削除"""
    logger.info(f"[DELETE /projects/{project_id}] ===== START DELETE PROJECT =====")
    logger.info(f"[DELETE /projects/{project_id}] User {current_user.id} requesting deletion")
    
    # プロジェクト取得
    project = crud_project.get_project(session, project_id)
    if not project:
        logger.warning(f"[DELETE /projects/{project_id}] Project not found")
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        logger.warning(f"[DELETE /projects/{project_id}] User {current_user.id} not authorized")
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
    
    logger.info(f"[DELETE /projects/{project_id}] Project found: {project.project_name}")
    
    # プロジェクトに紐づくファイル一覧を取得
    try:
        project_files = crud_project_file.get_project_files(session, project_id)
        logger.info(f"[DELETE /projects/{project_id}] Found {len(project_files)} files to delete")
        
        for pf in project_files:
            logger.info(f"[DELETE /projects/{project_id}] - File ID: {pf.id}, Name: {pf.file_name}, Key: {pf.file_key}")
    except Exception as e:
        logger.error(f"[DELETE /projects/{project_id}] Error fetching project files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch project files")
    
    # S3からファイルを削除
    if project_files:
        file_keys = [pf.file_key for pf in project_files if pf.file_key]
        logger.info(f"[DELETE /projects/{project_id}] Deleting {len(file_keys)} files from S3")
        
        if file_keys:
            try:
                deleted_count = delete_s3_files(file_keys)
                logger.info(f"[DELETE /projects/{project_id}] Successfully deleted {deleted_count}/{len(file_keys)} files from S3")
            except Exception as e:
                logger.error(f"[DELETE /projects/{project_id}] Error deleting files from S3: {e}", exc_info=True)
                # S3削除失敗してもDB削除は続行
    else:
        logger.info(f"[DELETE /projects/{project_id}] No files to delete from S3")
    
    # 各ファイルに紐づく関連データを削除（外部キー制約の順序を守る）
    try:
        logger.info(f"[DELETE /projects/{project_id}] Deleting related data (comments, highlight_rects, highlights)")
        
        for pf in project_files:
            file_id = pf.id
            logger.info(f"[DELETE /projects/{project_id}] Processing file {file_id}")
            
            # 1. そのファイルのハイライトIDを取得
            highlight_ids_stmt = select(Highlight.id).where(Highlight.project_file_id == file_id)
            highlight_ids_result = session.exec(highlight_ids_stmt)
            highlight_ids = [hid for hid in highlight_ids_result]
            
            if highlight_ids:
                logger.info(f"[DELETE /projects/{project_id}] Found {len(highlight_ids)} highlights in file {file_id}")
                
                # 2. コメントを再帰的に削除（葉ノードから削除）
                logger.info(f"[DELETE /projects/{project_id}] Deleting comments recursively for {len(highlight_ids)} highlights")
                
                # 対象のハイライトに紐づくすべてのコメントIDを取得
                all_comment_ids_stmt = select(Comment.id).where(Comment.highlight_id.in_(highlight_ids))
                all_comment_ids_result = session.exec(all_comment_ids_stmt)
                all_comment_ids = set(cid for cid in all_comment_ids_result)
                
                if all_comment_ids:
                    logger.info(f"[DELETE /projects/{project_id}] Found {len(all_comment_ids)} comments to delete")
                    
                    # 葉ノード（子を持たないコメント）から順に削除
                    max_iterations = 100  # 無限ループ防止
                    iteration = 0
                    
                    while all_comment_ids and iteration < max_iterations:
                        iteration += 1
                        
                        # 現在残っているコメントの中で、他のコメントから参照されていない（葉ノード）コメントを特定
                        # parent_idとして使われているコメントIDを取得
                        parent_ids_stmt = select(Comment.parent_id).where(
                            Comment.id.in_(all_comment_ids),
                            Comment.parent_id.isnot(None),
                            Comment.parent_id.in_(all_comment_ids)
                        ).distinct()
                        parent_ids_result = session.exec(parent_ids_stmt)
                        parent_ids = set(pid for pid in parent_ids_result if pid is not None)
                        
                        # 葉ノード = all_comment_ids - parent_ids
                        leaf_comment_ids = all_comment_ids - parent_ids
                        
                        if not leaf_comment_ids:
                            # 葉ノードが見つからない場合は、すべて削除を試みる（循環参照の可能性）
                            logger.warning(f"[DELETE /projects/{project_id}] No leaf nodes found. Attempting to delete all remaining {len(all_comment_ids)} comments")
                            leaf_comment_ids = all_comment_ids
                        
                        logger.info(f"[DELETE /projects/{project_id}] Iteration {iteration}: Deleting {len(leaf_comment_ids)} leaf comments")
                        
                        # 葉ノードを削除
                        delete_stmt = delete(Comment).where(Comment.id.in_(leaf_comment_ids))
                        session.exec(delete_stmt)
                        session.flush()  # 即座にDBに反映
                        
                        # 削除したコメントをall_comment_idsから除外
                        all_comment_ids -= leaf_comment_ids
                        
                        logger.info(f"[DELETE /projects/{project_id}] Iteration {iteration}: {len(all_comment_ids)} comments remaining")
                        
                        if not all_comment_ids:
                            break
                    
                    if all_comment_ids:
                        logger.warning(f"[DELETE /projects/{project_id}] {len(all_comment_ids)} comments could not be deleted after {iteration} iterations")
                    else:
                        logger.info(f"[DELETE /projects/{project_id}] All comments deleted successfully in {iteration} iterations")
                else:
                    logger.info(f"[DELETE /projects/{project_id}] No comments found")
                
                # 3. ハイライト矩形を削除（highlight_idに紐づく）
                logger.info(f"[DELETE /projects/{project_id}] Deleting highlight rects for {len(highlight_ids)} highlights")
                delete_rects_stmt = delete(HighlightRect).where(HighlightRect.highlight_id.in_(highlight_ids))
                session.exec(delete_rects_stmt)
                logger.info(f"[DELETE /projects/{project_id}] Deleted highlight rects")
                
                # 4. ハイライトを削除
                logger.info(f"[DELETE /projects/{project_id}] Deleting {len(highlight_ids)} highlights")
                delete_highlights_stmt = delete(Highlight).where(Highlight.id.in_(highlight_ids))
                session.exec(delete_highlights_stmt)
                logger.info(f"[DELETE /projects/{project_id}] Deleted highlights")
            else:
                logger.info(f"[DELETE /projects/{project_id}] No highlights found for file {file_id}")
        
        # コミット
        session.commit()
        logger.info(f"[DELETE /projects/{project_id}] Related data deleted successfully")
    except Exception as e:
        logger.error(f"[DELETE /projects/{project_id}] Error deleting related data: {e}", exc_info=True)
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete related data: {str(e)}")
    
    # DBからプロジェクトファイルを削除
    try:
        logger.info(f"[DELETE /projects/{project_id}] Deleting {len(project_files)} files from database")
        for pf in project_files:
            logger.debug(f"[DELETE /projects/{project_id}] Deleting file ID: {pf.id}")
            success = crud_project_file.delete_project_file(session, pf.id)
            if not success:
                logger.warning(f"[DELETE /projects/{project_id}] Failed to delete file ID: {pf.id}")
        logger.info(f"[DELETE /projects/{project_id}] All project files deleted from database")
    except IntegrityError as e:
        logger.error(f"[DELETE /projects/{project_id}] Integrity error deleting files: {e}", exc_info=True)
        session.rollback()
        raise HTTPException(status_code=500, detail="Database integrity error while deleting files")
    except Exception as e:
        logger.error(f"[DELETE /projects/{project_id}] Error deleting project files from database: {e}", exc_info=True)
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete project files")
    
    # DBからプロジェクトを削除
    try:
        logger.info(f"[DELETE /projects/{project_id}] Deleting project from database")
        crud_project.delete_project(session, project)
        logger.info(f"[DELETE /projects/{project_id}] Project deleted successfully from database")
    except IntegrityError as e:
        logger.error(f"[DELETE /projects/{project_id}] Integrity error deleting project: {e}", exc_info=True)
        session.rollback()
        raise HTTPException(status_code=500, detail="Database integrity error while deleting project")
    except Exception as e:
        logger.error(f"[DELETE /projects/{project_id}] Error deleting project from database: {e}", exc_info=True)
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete project")
    
    logger.info(f"[DELETE /projects/{project_id}] ===== DELETE PROJECT COMPLETE =====")
    return None
