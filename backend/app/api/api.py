# api/endpointsで定義されているrouterを一つのrouterにまとめる

from fastapi import APIRouter

from app.api.endpoints import test, users

api_router = APIRouter()
api_router.include_router(test.router, tags=["test"], prefix="/test")
api_router.include_router(users.router, tags=["users"], prefix="/users")
# api_router.include_router(items.router, tags=["items"], prefix="/items")