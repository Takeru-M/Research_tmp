import os
import time
# import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
from app.api.api import api_router
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from app.core.logging import setup_loggers, LoggingMiddleware
import logging

logging.basicConfig(level=logging.INFO)
setup_loggers()

load_dotenv()

app = FastAPI(
    title="FastAPI NextAuth JWT Backend",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# CORS設定を最初に追加
origins = [
    "http://localhost:3000",
    "http://frontend:3000",
    "https://research-tmp.vercel.app"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 他のミドルウェアを追加
app.add_middleware(LoggingMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "backend", "nginx", "research-tmp.onrender.com", "research-tmp.vercel.app"])

# ルーターを含める
app.include_router(api_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to FastAPI backend"}

# 例外ハンドラを登録
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)