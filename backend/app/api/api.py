# api/endpointsで定義されているrouterを一つのrouterにまとめる

from fastapi import APIRouter

from app.api.endpoints import users, auth

api_router = APIRouter()
api_router.include_router(users.router, tags=["users"], prefix="/api/v1/users")
api_router.include_router(auth.router, tags=["auth"], prefix="/api/v1/auth")
# api_router.include_router(items.router, tags=["items"], prefix="/items")