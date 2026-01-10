from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, status
from sqlalchemy.orm import Session
import boto3
from botocore.exceptions import ClientError, BotoCoreError
import os
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models import User
import logging
from fastapi.responses import StreamingResponse
from typing import Optional
import base64
import unicodedata

router = APIRouter()

# ロガーの設定
logger = logging.getLogger(__name__)

# S3クライアントの初期化
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-northeast-1')
    )
except Exception as e:
    logger.error(f"Failed to initialize S3 client: {str(e)}")
    s3_client = None

BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PDFファイルをS3にアップロードする
    """
    try:
        logger.info(f"[POST /s3/upload] User {current_user.id} started PDF upload: {file.filename}")

        # S3クライアントの初期化チェック
        if s3_client is None:
            logger.error("[POST /s3/upload] S3 client is not initialized")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="S3サービスが利用できません"
            )

        # バケット名チェック
        if not BUCKET_NAME:
            logger.error("[POST /s3/upload] S3 bucket name is not configured")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="S3バケット名が設定されていません"
            )

        # ファイルの存在チェック
        if not file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ファイルが選択されていません"
            )

        # ファイル名チェック
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ファイル名が無効です"
            )

        # MIMEタイプチェック
        if file.content_type != 'application/pdf':
            logger.warning(
                f"[POST /s3/upload] User {current_user.id} tried to upload non-PDF file: {file.content_type}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDFファイルのみアップロード可能です"
            )

        # ファイル読み込み
        try:
            file_content = await file.read()
            file_size = len(file_content)
            logger.debug(f"[POST /s3/upload] Read {file_size} bytes from upload file")
        except Exception as e:
            logger.error(f"[POST /s3/upload] Failed to read file: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ファイルの読み込みに失敗しました"
            )

        # ファイルサイズチェック
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ファイルが空です"
            )

        if file_size > MAX_FILE_SIZE:
            logger.warning(
                f"[POST /s3/upload] File too large: {file_size} bytes (max: {MAX_FILE_SIZE})"
            )
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"ファイルサイズが大きすぎます（最大: {MAX_FILE_SIZE // (1024 * 1024)}MB）"
            )

        # ファイル名生成
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_filename = file.filename
        # ファイル名のサニタイズ（危険な文字のみ除外してUnicode対応）
        # S3では: / \ \0 \n などが問題になる
        normalized_filename = unicodedata.normalize('NFC', original_filename)
        safe_filename = "".join(c for c in normalized_filename if c not in r'\/\x00\n\r' and not c.isspace() or c == ' ')
        safe_filename = safe_filename.replace('/', '').replace('\\', '').replace('\x00', '').replace('\n', '').replace('\r', '')
        s3_key = f"pdfs/{current_user.id}/{timestamp}_{safe_filename}"

        logger.info(
            f"[POST /s3/upload] Uploading file '{safe_filename}' for user {current_user.id} "
            f"to S3 key '{s3_key}' (size: {file_size} bytes)"
        )

        # S3 アップロード
        try:
            # メタデータはASCIIのみ許可されるため、オリジナルファイル名はBase64エンコード
            encoded_filename = base64.b64encode(original_filename.encode('utf-8')).decode('ascii')
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Body=file_content,
                ContentType='application/pdf',
                Metadata={
                    'user_id': str(current_user.id),
                    'uploaded_at': timestamp,
                    'original_filename': encoded_filename
                }
            )
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            
            logger.error(
                f"[POST /s3/upload] S3 ClientError for user {current_user.id}: "
                f"Code={error_code}, Message={error_message}"
            )
            
            if error_code == 'NoSuchBucket':
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="S3バケットが見つかりません"
                )
            elif error_code == 'AccessDenied':
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="S3へのアクセスが拒否されました"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"S3へのアップロードに失敗しました: {error_message}"
                )
        except BotoCoreError as e:
            logger.error(f"[POST /s3/upload] BotoCoreError for user {current_user.id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="S3との通信中にエラーが発生しました"
            )

        # 完了ログ
        logger.info(
            f"[POST /s3/upload] File uploaded successfully: user={current_user.id}, "
            f"key={s3_key}, size={file_size}"
        )

        # 公開 URL 生成
        aws_region = os.getenv('AWS_REGION', 'ap-northeast-1')
        s3_url = f"https://{BUCKET_NAME}.s3.{aws_region}.amazonaws.com/{s3_key}"

        return {
            "message": "PDFが正常にアップロードされました",
            "s3_key": s3_key,
            "s3_url": s3_url,
            "filename": safe_filename,
            "file_size": file_size
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[POST /s3/upload] Unexpected error for user {current_user.id}: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイルアップロード中にエラーが発生しました"
        )


@router.get("/get-file")
async def get_file(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    S3 からファイルを取得してストリーミング返却
    """
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File key is required"
        )

    # クライアント初期化チェック
    if s3_client is None:
        logger.error("[GET /s3/get-file] S3 client is not initialized")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3サービスが利用できません"
        )

    # バケット名チェック
    if not BUCKET_NAME:
        logger.error("[GET /s3/get-file] S3 bucket name is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3バケット名が設定されていません"
        )

    try:
        logger.info(f"[GET /s3/get-file] User {current_user.id} fetching key={key}")
        obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        body = obj["Body"]
        content_type: str = obj.get("ContentType") or "application/octet-stream"
        content_length: Optional[int] = obj.get("ContentLength")

        headers = {
            "Cache-Control": "public, max-age=31536000",
        }
        if content_length is not None:
            headers["Content-Length"] = str(content_length)

        return StreamingResponse(body, media_type=content_type, headers=headers)

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        logger.error(f"[GET /s3/get-file] ClientError code={error_code}: {e}")
        if error_code == "NoSuchKey":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル取得に失敗しました"
        )
    except Exception as e:
        logger.error(f"[GET /s3/get-file] Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ファイル取得中にエラーが発生しました"
        )
