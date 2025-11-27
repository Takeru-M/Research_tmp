# from pydantic import BaseModel, PostgresDsn

# class Settings(BaseModel):
#     SQLALCHEMY_DATABASE_URI: PostgresDsn = "postgresql://postgres:postgres@db:5432/test"
#     SECRET_KEY: str = "..." # 省略
#     ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

# settings = Settings()

import os
from dotenv import load_dotenv

load_dotenv()

# 実際には環境変数からロードするためのBaseSettingsクラスを使用することが推奨されます
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# DATABASE_URL 構築時に charset と collation を明示
# DATABASE_URL = f"mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_DATABASE}?charset=utf8mb4&collation=utf8mb4_unicode_ci"