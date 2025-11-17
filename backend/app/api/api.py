# api/endpointsで定義されているrouterを一つのrouterにまとめる

from fastapi import APIRouter

from app.api.endpoints import auth, users, projects, project_files, highlights, highlight_rects, comments

api_router = APIRouter()
api_router.include_router(auth.router, tags=["auth"], prefix="/api/v1/auth")
api_router.include_router(users.router, tags=["users"], prefix="/api/v1/users")
api_router.include_router(projects.router, tags=["projects"], prefix="/api/v1/projects")
api_router.include_router(project_files.router, tags=["project_files"], prefix="/api/v1/project_files")
api_router.include_router(highlights.router, tags=["highlights"], prefix="/api/v1/highlights")
api_router.include_router(highlight_rects.router, tags=["highlight_rects"], prefix="/api/v1/highlight_rects")
api_router.include_router(comments.router, tags=["comments"], prefix="/api/v1/comments")