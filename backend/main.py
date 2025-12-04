import os
import time
# import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware # Next.jsからのアクセスを許可するため
from dotenv import load_dotenv
from app.api.api import api_router
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from app.core.logging import setup_loggers, LoggingMiddleware
from contextlib import asynccontextmanager
import logging

logging.basicConfig(level=logging.INFO)
setup_loggers()

load_dotenv()

app = FastAPI(
  title="FastAPI NextAuth JWT Backend",
)
app.include_router(api_router)

# CORS設定
origins = [
    "http://localhost:3000",
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

# ----------------- 例外ハンドラ -----------------

# カスタム例外ハンドラを登録
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# ----------------- ミドルウェア -----------------

# APIアクセスログミドルウェアを追加
app.add_middleware(LoggingMiddleware)