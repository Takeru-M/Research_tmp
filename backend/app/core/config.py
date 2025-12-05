import os
from pydantic import BaseModel, PostgresDsn
from dotenv import load_dotenv

# .envファイルを最初に読み込む
load_dotenv()

class Settings(BaseModel):
    SQLALCHEMY_DATABASE_URI: PostgresDsn = "postgresql://postgres:postgres@db:5432/test"
    SECRET_KEY: str = "..." # 省略
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # データベース接続設定
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/test")
    
    # MySQLコネクションプール設定
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "3600"))
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()