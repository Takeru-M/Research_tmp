# app/crud/__init__.py

from .user import get_user_by_username, authenticate_user, create_user, get_user_by_id, get_users, update_user, delete_user
from .project import create_project, get_project_by_id, get_projects,update_project, delete_project
from .project_file import create_project_file, get_project_file_by_id, get_project_files, update_project_file, delete_project_file
from .highlight import create_highlight, get_highlight_by_id, get_highlights_by_file, update_highlight, delete_highlight
from .highlight_rect import create_highlight_rect, get_rect_by_id, get_rects_by_highlight, update_highlight_rect, delete_highlight_rect
from .comment import create_comment, get_comment_by_id, get_comments_by_file, update_comment, delete_comment

# オプション: 外部から app.crud.create_user のようにアクセスできるように、
# 公開する関数を __all__ に含める（Pythonの慣例）
__all__ = [
  # user
  "get_user_by_username",
  "authenticate_user",
  "create_user",
  "get_user_by_id",
  "get_users",
  "update_user",
  "delete_user",

  # project
  "create_project",
  "get_project_by_id",
  "get_projects",
  "update_project",
  "delete_project",

  # project_file
  "create_project_file",
  "get_project_file_by_id",
  "get_project_files",
  "update_project_file",
  "delete_project_file",

  # highlight
  "create_highlight",
  "get_highlight_by_id",
  "get_highlights_by_file",
  "update_highlight",
  "delete_highlight",

  # highlight_rect
  "create_highlight_rect",
  "get_rect_by_id",
  "get_rects_by_highlight",
  "update_highlight_rect",
  "delete_highlight_rect",

  # comment
  "create_comment",
  "get_comment_by_id",
  "get_comments_by_file",
  "update_comment",
  "delete_comment",
]