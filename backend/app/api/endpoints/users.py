from fastapi import APIRouter, Depends, HTTPException, status

from typing import List
from sqlmodel import Session
from app.crud.user import create_user, get_user_by_id, get_users, update_user, delete_user
from app.db.base import get_session
from app.models import User
from app.schemas.auth import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    認証済みユーザーの情報を返す
    """
    return current_user

@router.get("/", response_model=List[UserRead], tags=["Users"])
def read_users(
    offset: int = 0, 
    limit: int = 100, 
    session: Session = Depends(get_session)
):
    """すべてのユーザーを取得します。"""
    users = get_users(session=session, offset=offset, limit=limit)
    return users

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED, tags=["Users"])
def create_new_user(
    user: UserCreate, 
    session: Session = Depends(get_session)
):
    """新しいユーザーを作成します。"""
    # すでに同じメールアドレスのユーザーがいないかチェックするロジックなどを追加するのが一般的です
    # ...
    db_user = create_user(session=session, user_in=user)
    return db_user

@router.get("/{user_id}", response_model=UserRead, tags=["Users"])
def read_user_by_id(
    user_id: int, 
    session: Session = Depends(get_session)
):
    """指定されたIDのユーザーを取得します。"""
    db_user = get_user_by_id(session=session, user_id=user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )
    return db_user

@router.put("/{user_id}", response_model=UserRead, tags=["Users"])
def update_user_data(
    user_id: int,
    user_in: UserUpdate,
    session: Session = Depends(get_session)
):
    """ユーザー情報を更新します。"""
    db_user = get_user_by_id(session=session, user_id=user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )
    
    updated_user = update_user(session=session, user=db_user, user_in=user_in)
    return updated_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
def delete_user_data(
    user_id: int,
    session: Session = Depends(get_session)
):
    """ユーザーを論理削除します。"""
    db_user = get_user_by_id(session=session, user_id=user_id)
    if not db_user:
        # 存在しないIDへのDELETEは成功と見なすことが多い (冪等性の観点)
        return {"ok": True}
    
    delete_user(session=session, user=db_user)
    return {"ok": True}