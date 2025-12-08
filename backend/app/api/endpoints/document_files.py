from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.db.base import get_session
from app.api.deps import get_current_user, get_db
from app.models import User, DocumentFile
from app.schemas.document_file import DocumentFileCreate, DocumentFileRead
from app.crud import document_file as crud_document_file
from app.crud import document as crud_document
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=DocumentFileRead, status_code=status.HTTP_201_CREATED)
def create_file_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_in: DocumentFileCreate
) -> DocumentFile:
    """
    ドキュメントファイルを作成
    """
    try:
        # 入力バリデーション
        if file_in.document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
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
        
        logger.info(f"Creating file for document {file_in.document_id} by user {current_user.id}")
        
        # ドキュメントの存在確認とアクセス権限チェック
        document = crud_document.get_document(session, file_in.document_id)
        if not document:
            logger.warning(f"Document {file_in.document_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to access document {file_in.document_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントへのアクセス権限がありません"
            )
        
        # ファイル作成
        created_file = crud_document_file.create_document_file(session, file_in)
        
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


@router.get("/document/{document_id}", response_model=List[DocumentFileRead])
def read_files_by_document_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    document_id: int
) -> List[DocumentFile]:
    """
    ドキュメントIDに紐づくファイル一覧を取得（作成日時の降順）
    """
    try:
        if document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
            )
        
        logger.info(f"Fetching files for document {document_id} by user {current_user.id}")
        
        # ドキュメントの存在確認とアクセス権限チェック
        document = crud_document.get_document(session, document_id)
        if not document:
            logger.warning(f"Document {document_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to access document {document_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントへのアクセス権限がありません"
            )
        
        # ファイル一覧を取得（作成日時の降順でソート）
        files = crud_document_file.get_document_files(session, document_id)
        logger.info(f"Found {len(files)} files for document {document_id}")
        return files
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching files for document {document_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル取得中にエラーが発生しました"
        )


@router.get("/{file_id}", response_model=DocumentFileRead)
def read_document_file_endpoint(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    file_id: int
) -> DocumentFile:
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
        
        file = crud_document_file.get_document_file(session, file_id)
        if not file:
            logger.warning(f"File {file_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ファイルが見つかりません"
            )
        
        # ドキュメントへのアクセス権限チェック
        document = crud_document.get_document(session, file.document_id)
        if not document:
            logger.warning(f"Document {file.document_id} not found for file {file_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
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
        
        file = crud_document_file.get_document_file(session, file_id)
        if not file:
            logger.warning(f"File {file_id} not found for deletion")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ファイルが見つかりません"
            )
        
        # ドキュメントへのアクセス権限チェック
        document = crud_document.get_document(session, file.document_id)
        if not document:
            logger.warning(f"Document {file.document_id} not found for file {file_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"User {current_user.id} attempted to delete file {file_id} without permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このファイルへのアクセス権限がありません"
            )
        
        # ファイル削除（S3からの削除は別途実装が必要）
        crud_document_file.delete_document_file(session, file_id)
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
