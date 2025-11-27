import os
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# S3クライアントの初期化
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-northeast-1')
)

BUCKET_NAME = os.getenv('S3_BUCKET_NAME')


def fetch_pdf_bytes(file_key: str) -> bytes:
    """S3からPDFファイルのバイトデータを取得"""
    if not BUCKET_NAME:
        raise ValueError("S3_BUCKET_NAME is not configured")
    
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=file_key)
        return response['Body'].read()
    except ClientError as e:
        logger.error(f"Failed to fetch PDF from S3: {e}")
        raise


def delete_s3_file(file_key: str) -> bool:
    """S3から単一ファイルを削除"""
    if not BUCKET_NAME:
        logger.error("S3_BUCKET_NAME is not configured")
        return False
    
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=file_key)
        logger.info(f"Successfully deleted S3 file: {file_key}")
        return True
    except ClientError as e:
        logger.error(f"Failed to delete S3 file {file_key}: {e}")
        return False


def delete_s3_files(file_keys: list) -> int:
    """S3から複数ファイルを一括削除"""
    if not BUCKET_NAME:
        logger.error("S3_BUCKET_NAME is not configured")
        return 0
    
    if not file_keys:
        return 0
    
    try:
        # S3の一括削除APIを使用
        objects = [{'Key': key} for key in file_keys]
        response = s3_client.delete_objects(
            Bucket=BUCKET_NAME,
            Delete={'Objects': objects}
        )
        
        deleted_count = len(response.get('Deleted', []))
        logger.info(f"Successfully deleted {deleted_count} files from S3")
        
        # エラーがあればログ出力
        if 'Errors' in response:
            for error in response['Errors']:
                logger.error(f"Failed to delete {error['Key']}: {error['Message']}")
        
        return deleted_count
    except ClientError as e:
        logger.error(f"Failed to delete S3 files: {e}")
        return 0