from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.db.base import get_session
from app.api.deps import get_current_user, get_db
from app.models import User, ProjectFile
from app.schemas.project_file import ProjectFileCreate, ProjectFileRead
from app.crud import project_file as crud_project_file
from app.crud import project as crud_project
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=ProjectFileRead, status_code=status.HTTP_201_CREATED)
def create_file_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_in: ProjectFileCreate
) -> ProjectFile:
    """
    プロジェクトファイルを作成
    """
    try:
        # 入力バリデーション
        if file_in.project_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なプロジェクトIDです"
            )
        
        if not file_in.file_name or not file_in.file_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ファイル名を入力してください"
            )
        
        if not file_in.file_key or not file_in.file_key.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ファイルキーが必要です"
            )
        
        logger.info(f"Creating file for project {file_in.project_id} by user {current_user.id}")
        
        # プロジェクトの存在確認とアクセス権限チェック
        project = crud_project.get_project(session, file_in.project_id)
        if not project:
            logger.warning(f"Project {file_in.project_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="プロジェクトが見つかりません"
            )
        
        if project.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to access project {file_in.project_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このプロジェクトへのアクセス権限がありません"
            )
        
        # ファイル作成
        created_file = crud_project_file.create_project_file(session, file_in)
        
        if not created_file or not created_file.id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ファイルの作成に失敗しました"
            )
        
        logger.info(f"File created successfully: ID={created_file.id}")
        return created_file
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error creating file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating file: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル作成中にエラーが発生しました"
        )


@router.get("/project/{project_id}", response_model=List[ProjectFileRead])
def read_files_by_project_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    project_id: int
) -> List[ProjectFile]:
    """
    プロジェクトIDに紐づくファイル一覧を取得（作成日時の降順）
    """
    try:
        if project_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なプロジェクトIDです"
            )
        
        logger.info(f"Fetching files for project {project_id} by user {current_user.id}")
        
        # プロジェクトの存在確認とアクセス権限チェック
        project = crud_project.get_project(session, project_id)
        if not project:
            logger.warning(f"Project {project_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="プロジェクトが見つかりません"
            )
        
        if project.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to access project {project_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このプロジェクトへのアクセス権限がありません"
            )
        
        # ファイル一覧を取得（作成日時の降順でソート）
        files = crud_project_file.get_project_files(session, project_id)
        logger.info(f"Found {len(files)} files for project {project_id}")
        return files
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching files for project {project_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル取得中にエラーが発生しました"
        )


@router.get("/{file_id}", response_model=ProjectFileRead)
def read_project_file_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_id: int
) -> ProjectFile:
    """
    ファイルIDで特定のファイルを取得
    """
    try:
        if file_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なファイルIDです"
            )
        
        logger.info(f"Fetching file {file_id} by user {current_user.id}")
        
        file = crud_project_file.get_project_file(session, file_id)
        if not file:
            logger.warning(f"File {file_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ファイルが見つかりません"
            )
        
        # プロジェクトへのアクセス権限チェック
        project = crud_project.get_project(session, file.project_id)
        if not project:
            logger.warning(f"Project {file.project_id} not found for file {file_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="プロジェクトが見つかりません"
            )
        
        if project.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to access file {file_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このファイルへのアクセス権限がありません"
            )
        
        logger.info(f"File {file_id} fetched successfully")
        return file
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル取得中にエラーが発生しました"
        )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_id: int
):
    """
    ファイルを削除
    """
    try:
        if file_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なファイルIDです"
            )
        
        logger.info(f"Deleting file {file_id} by user {current_user.id}")
        
        file = crud_project_file.get_project_file(session, file_id)
        if not file:
            logger.warning(f"File {file_id} not found for deletion")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ファイルが見つかりません"
            )
        
        # プロジェクトへのアクセス権限チェック
        project = crud_project.get_project(session, file.project_id)
        if not project:
            logger.warning(f"Project {file.project_id} not found for file {file_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="プロジェクトが見つかりません"
            )
        
        if project.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to delete file {file_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このファイルへのアクセス権限がありません"
            )
        
        # ファイル削除（S3からの削除は別途実装が必要）
        crud_project_file.delete_project_file(session, file_id)
        logger.info(f"File {file_id} deleted successfully")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル削除中にエラーが発生しました"
        )
