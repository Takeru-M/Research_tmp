from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.db.base import get_session
from app.api.deps import get_current_user, get_db
from app.models import User, ProjectFile
from app.schemas import ProjectFileCreate, ProjectFileRead, ProjectFileUpdate
from app.crud import create_project_file, get_project_file, get_project_files, delete_project_file
from app.crud import create_project, get_project, get_projects, update_project, delete_project

router = APIRouter()

@router.post("/", response_model=ProjectFileRead, status_code=status.HTTP_201_CREATED)
def create_project_file(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_in: ProjectFileCreate
) -> ProjectFile:
    """
    プロジェクトファイルを作成
    """
    # プロジェクトの存在確認とアクセス権限チェック
    project = get_project(session, file_in.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # ファイル作成
    return create_project_file(session, file_in)


@router.get("/project/{project_id}", response_model=List[ProjectFileRead])
def read_files_by_project(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    project_id: int
) -> List[ProjectFile]:
    """
    プロジェクトIDに紐づくファイル一覧を取得（作成日時の降順）
    """
    # プロジェクトの存在確認とアクセス権限チェック
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # ファイル一覧を取得（作成日時の降順でソート）
    files = get_project_files(session, project_id)
    return files


@router.get("/{file_id}", response_model=ProjectFileRead)
def read_project_file(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_id: int
) -> ProjectFile:
    """
    ファイルIDで特定のファイルを取得
    """
    file = get_project_file(session, file_id)
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # プロジェクトへのアクセス権限チェック
    project = get_project(session, file.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return file


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_file(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_id: int
):
    """
    ファイルを削除
    """
    file = get_project_file(session, file_id)
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # プロジェクトへのアクセス権限チェック
    project = get_project(session, file.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # ファイル削除（S3からの削除は別途実装が必要）
    delete_project_file(session, file_id)
    return None
