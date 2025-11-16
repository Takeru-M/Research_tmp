from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter()

# ✅ 基本テスト用エンドポイント
@router.get("/")
def read_root():
    return {"message": "Hello from FastAPI backend!"}