import os
# import mysql.connector
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Next.jsからのアクセスを許可するため
from dotenv import load_dotenv
from app.api.api import api_router
from contextlib import asynccontextmanager
import logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

app = FastAPI(
  title="FastAPI NextAuth JWT Backend",
  # openapi_url="/api/openapi.json"
)
app.include_router(api_router)

# TODO: docker用に変更
# CORS設定
origins = [
    # "http://localhost:3000",
    "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- ヘルスチェック -----------------

@app.get("/")
def read_root():
    return {"message": "Welcome to FastAPI backend"}

# ライフサイクルイベント（アプリケーション起動・終了時の処理）
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """
#     アプリケーション起動時 (startup) の処理を記述
#     """
#     print("Startup: データベース接続を初期化します。")
#     # 開発環境でテーブルを自動生成したい場合にコメントアウトを外す
#     # create_db_and_tables()

#     yield # ここでアプリケーションがリクエストの処理を開始します

#     """
#     アプリケーション終了時 (shutdown) の処理を記述
#     """
#     print("Shutdown: アプリケーションを終了します。")
#     # 必要であればここでデータベース接続をクローズするなどの処理を記述