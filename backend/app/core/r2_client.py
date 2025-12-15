import os
import boto3
from botocore.client import Config
from typing import Optional

class R2Client:
    """Cloudflare R2クライアント"""
    
    _instance: Optional['R2Client'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'client'):
            self.client = boto3.client(
                's3',
                endpoint_url=os.getenv('R2_ENDPOINT_URL'),
                aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
                config=Config(signature_version='s3v4'),
                region_name='auto'
            )
            self.bucket_name = os.getenv('R2_BUCKET_NAME')
    
    def upload_log(self, key: str, data: str) -> bool:
        """ログデータをR2にアップロード"""
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=data.encode('utf-8'),
                ContentType='application/json'
            )
            return True
        except Exception as e:
            print(f"Failed to upload to R2: {str(e)}")
            return False

def get_r2_client() -> R2Client:
    """R2クライアントのシングルトンインスタンスを取得"""
    return R2Client()