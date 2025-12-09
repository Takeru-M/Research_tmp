import logging
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, delete
from typing import List
from sqlalchemy.exc import IntegrityError
from app.db.base import get_session
from app.crud import document as crud_document
from app.crud import document_file as crud_document_file
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentRead, CompletionStageUpdate
from app.schemas.document_file import DocumentFileRead
from app.api.deps import get_current_user
from app.models import User, DocumentFile, Highlight, HighlightRect, Comment
from app.services.pdf_export_service import PDFExportService
from app.utils.s3 import fetch_pdf_bytes, delete_s3_files

router = APIRouter()

logger = logging.getLogger("app.documents")
logger.setLevel(logging.INFO)

# コンソールハンドラーを追加（まだ設定されていない場合）
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s [%(name)s] %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

@router.get("/", response_model=List[DocumentRead])
def read_documents(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """ユーザーのドキュメント一覧を取得"""
    try:
        logger.info(f"[GET /documents] User {current_user.id} requesting documents")
        documents = crud_document.get_documents_by_user(session, current_user.id)
        logger.info(f"[GET /documents] Returning {len(documents)} documents")
        return documents
    except Exception as e:
        logger.error(f"[GET /documents] Error fetching documents for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ドキュメント一覧の取得中にエラーが発生しました"
        )

@router.post("/", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(
    document_in: DocumentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """新規ドキュメントを作成"""
    try:
        # 入力バリデーション
        if not document_in.document_name or not document_in.document_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ドキュメント名を入力してください"
            )
        
        logger.info(f"[POST /documents] User {current_user.id} creating document: {document_in.document_name}")
        document_data = document_in.model_copy(update={"user_id": current_user.id})
        document = crud_document.create_document(session, document_data)
        
        if not document or not document.id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ドキュメントの作成に失敗しました"
            )
        
        logger.info(f"[POST /documents] Document created with id: {document.id}")
        return document
    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error(f"[POST /documents] Integrity error creating document: {str(e)}")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ドキュメント名が既に存在します"
        )
    except Exception as e:
        logger.error(f"[POST /documents] Error creating document: {str(e)}", exc_info=True)
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ドキュメント作成中にエラーが発生しました"
        )

@router.get("/{document_id}/files/{file_id}/export")
async def export_pdf_with_comments(
    document_id: int,
    file_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """PDFをコメント付きでエクスポート"""
    try:
        if document_id <= 0 or file_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDまたはファイルIDです"
            )
        
        logger.info(f"[Export][Backend] Start export document_id={document_id} file_id={file_id}")

        # ファイル取得
        document_file = db.get(DocumentFile, file_id)
        if not document_file or document_file.document_id != document_id:
            logger.error(f"[Export][Backend] File not found or mismatched. file_id={file_id}, document_id={document_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ファイルが見つかりません"
            )

        # ドキュメントへのアクセス権限チェック
        document = crud_document.get_document(db, document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"[Export][Backend] User {current_user.id} not authorized for document {document_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントへのアクセス権限がありません"
            )

        file_key = document_file.file_key
        logger.info(f"[Export][Backend] S3 file_key={file_key}")

        # S3からPDFを取得
        try:
            pdf_bytes = fetch_pdf_bytes(file_key)
        except Exception as e:
            logger.error(f"[Export][Backend] Failed to fetch PDF from S3: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="S3からPDFの取得に失敗しました"
            )

        # PDFにコメントを追加
        try:
            service = PDFExportService(db)
            output_pdf = service.export_pdf_with_comments(pdf_bytes, file_id)
            size = output_pdf.getbuffer().nbytes
            logger.info(f"[Export][Backend] Export done. bytes={size}, filename={document_file.file_name}")
        except Exception as e:
            logger.exception(f"[Export][Backend] Export failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PDFのエクスポートに失敗しました"
            )

        headers = {
            "Content-Disposition": f"attachment; filename={document_file.file_name.replace('.pdf', '_with_comments.pdf')}"
        }
        logger.info(f"[Export][Backend] Returning PDF headers={headers}")

        return StreamingResponse(output_pdf, media_type="application/pdf", headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Export][Backend] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="エクスポート中にエラーが発生しました"
        )

@router.get("/{document_id}", response_model=DocumentRead)
def read_document(
    document_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """特定のドキュメントを取得"""
    try:
        if document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
            )
        
        logger.info(f"[GET /documents/{document_id}] User {current_user.id} requesting document")
        document = crud_document.get_document(session, document_id)
        
        if not document:
            logger.warning(f"[GET /documents/{document_id}] Document not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"[GET /documents/{document_id}] User {current_user.id} not authorized")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントへのアクセス権限がありません"
            )
        
        logger.info(f"[GET /documents/{document_id}] Document found: {document.document_name}")
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET /documents/{document_id}] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ドキュメント取得中にエラーが発生しました"
        )

@router.put("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: int,
    document_in: DocumentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """ドキュメントを更新"""
    try:
        if document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
            )
        
        # 入力バリデーション
        if document_in.document_name is not None and not document_in.document_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ドキュメント名を入力してください"
            )
        
        logger.info(f"[PUT /documents/{document_id}] User {current_user.id} updating document")
        document = crud_document.get_document(session, document_id)
        
        if not document:
            logger.warning(f"[PUT /documents/{document_id}] Document not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"[PUT /documents/{document_id}] User {current_user.id} not authorized")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントの更新権限がありません"
            )
        
        updated_document = crud_document.update_document(session, document, document_in)
        
        if not updated_document:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ドキュメントの更新に失敗しました"
            )
        
        logger.info(f"[PUT /documents/{document_id}] Document updated successfully")
        return updated_document
    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error(f"[PUT /documents/{document_id}] Integrity error: {str(e)}")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ドキュメント名が既に存在します"
        )
    except Exception as e:
        logger.error(f"[PUT /documents/{document_id}] Error: {str(e)}", exc_info=True)
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ドキュメント更新中にエラーが発生しました"
        )

@router.patch("/{document_id}/update-completion-stage", response_model=DocumentRead)
def update_document_completion_stage(
    document_id: int,
    stage_update: CompletionStageUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """ドキュメントのcompletion_stageを更新"""
    try:
        if document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
            )
        
        logger.info(f"[PATCH /documents/{document_id}/completion-stage] User {current_user.id} updating stage to: {stage_update.completion_stage}")
        document = crud_document.get_document(session, document_id)
        
        if not document:
            logger.warning(f"[PATCH /documents/{document_id}/completion-stage] Document not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"[PATCH /documents/{document_id}/completion-stage] User {current_user.id} not authorized")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントの更新権限がありません"
            )
        
        updated_document = crud_document.update_completion_stage(session, document_id, stage_update.completion_stage)
        
        if not updated_document:
            logger.error(f"[PATCH /documents/{document_id}/completion-stage] Failed to update completion stage")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="完了ステージの更新に失敗しました"
            )
        
        logger.info(f"[PATCH /documents/{document_id}/completion-stage] Stage updated successfully")
        return updated_document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PATCH /documents/{document_id}/completion-stage] Error: {str(e)}", exc_info=True)
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="完了ステージ更新中にエラーが発生しました"
        )

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """ドキュメントとそれに紐づくファイルをDBとS3から削除"""
    try:
        if document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
            )
        
        logger.info(f"[DELETE /documents/{document_id}] ===== START DELETE PROJECT =====")
        logger.info(f"[DELETE /documents/{document_id}] User {current_user.id} requesting deletion")
        
        # ドキュメント取得
        document = crud_document.get_document(session, document_id)
        if not document:
            logger.warning(f"[DELETE /documents/{document_id}] Document not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )
        
        if document.user_id != current_user.id:
            logger.warning(f"[DELETE /documents/{document_id}] User {current_user.id} not authorized")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントの削除権限がありません"
            )
        
        logger.info(f"[DELETE /documents/{document_id}] Document found: {document.document_name}")
        
        # ドキュメントに紐づくファイル一覧を取得
        try:
            document_files = crud_document_file.get_document_files(session, document_id)
            logger.info(f"[DELETE /documents/{document_id}] Found {len(document_files)} files to delete")
            
            for pf in document_files:
                logger.info(f"[DELETE /documents/{document_id}] - File ID: {pf.id}, Name: {pf.file_name}, Key: {pf.file_key}")
        except Exception as e:
            logger.error(f"[DELETE /documents/{document_id}] Error fetching document files: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ドキュメントファイルの取得に失敗しました"
            )
        
        # S3からファイルを削除
        if document_files:
            file_keys = [pf.file_key for pf in document_files if pf.file_key]
            logger.info(f"[DELETE /documents/{document_id}] Deleting {len(file_keys)} files from S3")
            
            if file_keys:
                try:
                    deleted_count = delete_s3_files(file_keys)
                    logger.info(f"[DELETE /documents/{document_id}] Successfully deleted {deleted_count}/{len(file_keys)} files from S3")
                except Exception as e:
                    logger.error(f"[DELETE /documents/{document_id}] Error deleting files from S3: {e}", exc_info=True)
                    # S3削除失敗してもDB削除は続行
                    logger.warning(f"[DELETE /documents/{document_id}] Continuing with database deletion despite S3 error")
        else:
            logger.info(f"[DELETE /documents/{document_id}] No files to delete from S3")
        
        # 各ファイルに紐づく関連データを削除
        try:
            logger.info(f"[DELETE /documents/{document_id}] Deleting related data")
            
            for pf in document_files:
                file_id = pf.id
                logger.info(f"[DELETE /documents/{document_id}] Processing file {file_id}")
                
                # ハイライトIDを取得
                highlight_ids_stmt = select(Highlight.id).where(Highlight.document_file_id == file_id)
                highlight_ids_result = session.exec(highlight_ids_stmt)
                highlight_ids = [hid for hid in highlight_ids_result]
                
                if highlight_ids:
                    logger.info(f"[DELETE /documents/{document_id}] Found {len(highlight_ids)} highlights in file {file_id}")
                    
                    # コメントを再帰的に削除
                    all_comment_ids_stmt = select(Comment.id).where(Comment.highlight_id.in_(highlight_ids))
                    all_comment_ids_result = session.exec(all_comment_ids_stmt)
                    all_comment_ids = set(cid for cid in all_comment_ids_result)
                    
                    if all_comment_ids:
                        logger.info(f"[DELETE /documents/{document_id}] Found {len(all_comment_ids)} comments to delete")
                        
                        max_iterations = 100
                        iteration = 0
                        
                        while all_comment_ids and iteration < max_iterations:
                            iteration += 1
                            
                            parent_ids_stmt = select(Comment.parent_id).where(
                                Comment.id.in_(all_comment_ids),
                                Comment.parent_id.isnot(None),
                                Comment.parent_id.in_(all_comment_ids)
                            ).distinct()
                            parent_ids_result = session.exec(parent_ids_stmt)
                            parent_ids = set(pid for pid in parent_ids_result if pid is not None)
                            
                            leaf_comment_ids = all_comment_ids - parent_ids
                            
                            if not leaf_comment_ids:
                                logger.warning(f"[DELETE /documents/{document_id}] No leaf nodes found. Deleting all remaining")
                                leaf_comment_ids = all_comment_ids
                            
                            logger.info(f"[DELETE /documents/{document_id}] Iteration {iteration}: Deleting {len(leaf_comment_ids)} comments")
                            
                            delete_stmt = delete(Comment).where(Comment.id.in_(leaf_comment_ids))
                            session.exec(delete_stmt)
                            session.flush()
                            
                            all_comment_ids -= leaf_comment_ids
                            
                            if not all_comment_ids:
                                break
                        
                        if all_comment_ids:
                            logger.warning(f"[DELETE /documents/{document_id}] {len(all_comment_ids)} comments remaining after {iteration} iterations")
                    
                    # ハイライト矩形を削除
                    logger.info(f"[DELETE /documents/{document_id}] Deleting highlight rects")
                    delete_rects_stmt = delete(HighlightRect).where(HighlightRect.highlight_id.in_(highlight_ids))
                    session.exec(delete_rects_stmt)
                    
                    # ハイライトを削除
                    logger.info(f"[DELETE /documents/{document_id}] Deleting highlights")
                    delete_highlights_stmt = delete(Highlight).where(Highlight.id.in_(highlight_ids))
                    session.exec(delete_highlights_stmt)
            
            session.commit()
            logger.info(f"[DELETE /documents/{document_id}] Related data deleted successfully")
        except Exception as e:
            logger.error(f"[DELETE /documents/{document_id}] Error deleting related data: {e}", exc_info=True)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"関連データの削除に失敗しました"
            )
        
        # ドキュメントファイルを削除
        try:
            logger.info(f"[DELETE /documents/{document_id}] Deleting document files from database")
            for pf in document_files:
                success = crud_document_file.delete_document_file(session, pf.id)
                if not success:
                    logger.warning(f"[DELETE /documents/{document_id}] Failed to delete file ID: {pf.id}")
            logger.info(f"[DELETE /documents/{document_id}] Document files deleted")
        except IntegrityError as e:
            logger.error(f"[DELETE /documents/{document_id}] Integrity error: {e}", exc_info=True)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="データベース整合性エラーが発生しました"
            )
        except Exception as e:
            logger.error(f"[DELETE /documents/{document_id}] Error deleting files: {e}", exc_info=True)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ファイル削除中にエラーが発生しました"
            )
        
        # ドキュメントを削除
        try:
            logger.info(f"[DELETE /documents/{document_id}] Deleting document from database")
            crud_document.delete_document(session, document)
            logger.info(f"[DELETE /documents/{document_id}] ===== DELETE PROJECT COMPLETE =====")
            return None
        except IntegrityError as e:
            logger.error(f"[DELETE /documents/{document_id}] Integrity error: {e}", exc_info=True)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="データベース整合性エラーが発生しました"
            )
        except Exception as e:
            logger.error(f"[DELETE /documents/{document_id}] Error: {e}", exc_info=True)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ドキュメント削除中にエラーが発生しました"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE /documents/{document_id}] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ドキュメント削除中にエラーが発生しました"
        )

@router.get("/{document_id}/document-files", response_model=List[DocumentFileRead])
def list_document_files_for_document(
    document_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    ドキュメントIDに紐づくファイル一覧を取得（作成日時の降順）
    """
    try:
        if document_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なドキュメントIDです"
            )

        logger.info(f"[GET /documents/{document_id}/document-files] User {current_user.id} requesting files")

        document = crud_document.get_document(session, document_id)
        if not document:
            logger.warning(f"[GET /documents/{document_id}/document-files] Document not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ドキュメントが見つかりません"
            )

        if document.user_id != current_user.id:
            logger.warning(f"[GET /documents/{document_id}/document-files] User {current_user.id} not authorized")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントへのアクセス権限がありません"
            )

        files = crud_document_file.get_document_files(session, document_id)
        logger.info(f"[GET /documents/{document_id}/document-files] Found {len(files)} files")
        return files

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET /documents/{document_id}/document-files] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル取得中にエラーが発生しました"
        )
