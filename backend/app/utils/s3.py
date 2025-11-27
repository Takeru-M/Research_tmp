import os
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger("app.s3")

def get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_DEFAULT_REGION"),
    )

def fetch_pdf_bytes(key: str) -> bytes:
    bucket = os.getenv("S3_BUCKET_NAME")
    if not bucket:
        raise RuntimeError("S3_BUCKET_NAME not set")
    client = get_s3_client()
    logger.info(f"[S3] Fetching key={key} bucket={bucket}")
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
        data = obj["Body"].read()
        logger.info(f"[S3] Fetched bytes={len(data)}")
        return data
    except (BotoCoreError, ClientError) as e:
        logger.exception(f"[S3] Fetch failed key={key}: {e}")
        raise