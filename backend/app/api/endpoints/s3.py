from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
import boto3
from botocore.exceptions import ClientError
import os
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models import User
import logging

router = APIRouter()

# ロガーの設定
logger = logging.getLogger(__name__)

# S3クライアントの初期化
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-northeast-1')
)

BUCKET_NAME = os.getenv('S3_BUCKET_NAME')


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PDFファイルをS3にアップロードする
    """

    logger.info(f"User {current_user.id} started PDF upload.")

    # バケット名チェック
    if not BUCKET_NAME:
        logger.error("S3 bucket name is not configured.")
        raise HTTPException(status_code=500, detail="S3 bucket name not configured")

    # MIME タイプチェック
    if not file.content_type == 'application/pdf':
        logger.warning(
            f"User {current_user.id} tried to upload non-PDF file: {file.content_type}"
        )
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        # ファイル名生成
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_filename = file.filename or "document.pdf"
        s3_key = f"pdfs/{current_user.id}/{timestamp}_{original_filename}"

        logger.info(
            f"Uploading file '{original_filename}' for user {current_user.id} "
            f"to S3 key '{s3_key}'"
        )

        # ファイル読み込み
        file_content = await file.read()
        logger.debug(f"Read {len(file_content)} bytes from upload file.")

        # S3 アップロード
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=file_content,
            ContentType='application/pdf',
            Metadata={
                'user_id': str(current_user.id),
                'uploaded_at': timestamp
            }
        )

        # 完了ログ
        logger.info(
            f"File uploaded successfully: user={current_user.id}, key={s3_key}"
        )

        # 公開 URL 生成
        s3_url = (
            f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION', 'ap-northeast-1')}.amazonaws.com/{s3_key}"
        )

        return {
            "message": "PDF uploaded successfully",
            "s3_key": s3_key,
            "s3_url": s3_url,
            "filename": original_filename
        }

    except ClientError as e:
        logger.exception(
            f"S3 upload failed for user {current_user.id}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload to S3: {str(e)}"
        )

    except Exception as e:
        logger.exception(
            f"Unexpected error during PDF upload for user {current_user.id}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )
