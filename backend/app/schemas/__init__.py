# app/schemes/__init__.py

from .auth import User, Token, TokenData, UserSignupSchema, LoginRequest
from .user import UserCreate, UserRead, UserUpdate
from .project import ProjectBase, ProjectCreate, ProjectUpdate, ProjectRead
from .project_file import ProjectFileBase, ProjectFileCreate, ProjectFileUpdate, ProjectFileRead
from .highlight import HighlightBase, HighlightCreate, HighlightUpdate, HighlightRead
from .highlight_rect import HighlightRectBase, HighlightRectCreate, HighlightRectUpdate, HighlightRectRead
from .comment import CommentBase, CommentCreate, CommentUpdate, CommentRead

# オプション: 外部から直接使えるようにするため
__all__ = [
    # auth
    "User",
    "Token",
    "TokenData",
    "UserSignupSchema",
    "LoginRequest",

    # user
    "UserCreate",
    "UserRead",
    "UserUpdate",

    # project
    "ProjectBase",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectRead",

    # project_file
    "ProjectFileBase",
    "ProjectFileCreate",
    "ProjectFileUpdate",
    "ProjectFileRead",

    # highlight
    "HighlightBase",
    "HighlightCreate",
    "HighlightUpdate",
    "HighlightRead",

    # highlight_rect
    "HighlightRectBase",
    "HighlightRectCreate",
    "HighlightRectUpdate",
    "HighlightRectRead",

    # comment
    "CommentBase",
    "CommentCreate",
    "CommentUpdate",
    "CommentRead",
]