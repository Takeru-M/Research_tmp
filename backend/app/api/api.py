# api/endpointsで定義されているrouterを一つのrouterにまとめる

from fastapi import APIRouter

from app.api.endpoints import auth, users, projects, project_files, highlights, comments, s3, logs

api_router = APIRouter()
api_router.include_router(auth.router, tags=["auth"], prefix="/api/v1/auth")
api_router.include_router(users.router, tags=["users"], prefix="/api/v1/users")
api_router.include_router(projects.router, tags=["projects"], prefix="/api/v1/projects")
api_router.include_router(project_files.router, tags=["project-files"], prefix="/api/v1/project-files")
api_router.include_router(highlights.router, tags=["highlights"], prefix="/api/v1/highlights")
api_router.include_router(comments.router, tags=["comments"], prefix="/api/v1/comments")
api_router.include_router(s3.router, tags=["s3"], prefix="/api/v1/s3")
api_router.include_router(logs.router, tags=["logs"], prefix="/api/v1/logs")