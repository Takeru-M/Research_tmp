from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlmodel import Session
from sqlalchemy.exc import IntegrityError
from app.crud.user import create_user, get_user_by_id, get_users, update_user, delete_user
from app.db.base import get_session
from app.models import User
from app.schemas.auth import User as AuthUser
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.api.deps import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/me", response_model=AuthUser)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    認証済みユーザーの情報を返す
    """
    try:
        logger.info(f"[GET /users/me] User {current_user.id} requesting own info")
        return current_user
    except Exception as e:
        logger.error(f"[GET /users/me] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー情報取得中にエラーが発生しました"
        )

@router.get("/", response_model=List[UserRead], tags=["Users"])
def read_users(
    offset: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """すべてのユーザーを取得します。"""
    try:
        # バリデーション
        if offset < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="オフセットは0以上である必要があります"
            )
        
        if limit <= 0 or limit > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="リミットは1から1000の範囲で指定してください"
            )
        
        logger.info(f"[GET /users] Fetching users with offset={offset}, limit={limit}")
        users = get_users(session=session, offset=offset, limit=limit)
        logger.info(f"[GET /users] Found {len(users)} users")
        return users
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET /users] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー一覧取得中にエラーが発生しました"
        )

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED, tags=["Users"])
def create_new_user(
    user: UserCreate, 
    session: Session = Depends(get_session)
):
    """新しいユーザーを作成します。"""
    try:
        # 入力バリデーション
        if not user.name or not user.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ユーザー名を入力してください"
            )
        
        if not user.email or not user.email.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="メールアドレスを入力してください"
            )
        
        if not user.password or len(user.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="パスワードは8文字以上である必要があります"
            )
        
        logger.info(f"[POST /users] Creating user: {user.email}")
        db_user = create_user(session=session, user_in=user)
        
        if not db_user or not db_user.id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ユーザーの作成に失敗しました"
            )
        
        logger.info(f"[POST /users] User created with ID: {db_user.id}")
        return db_user
    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error(f"[POST /users] Integrity error: {str(e)}")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています"
        )
    except Exception as e:
        logger.error(f"[POST /users] Error: {str(e)}", exc_info=True)
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー作成中にエラーが発生しました"
        )

@router.get("/{user_id}", response_model=UserRead, tags=["Users"])
def read_user_by_id(
    user_id: int, 
    session: Session = Depends(get_session)
):
    """指定されたIDのユーザーを取得します。"""
    try:
        if user_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なユーザーIDです"
            )
        
        logger.info(f"[GET /users/{user_id}] Fetching user")
        db_user = get_user_by_id(session=session, user_id=user_id)
        
        if not db_user:
            logger.warning(f"[GET /users/{user_id}] User not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ユーザーが見つかりません"
            )
        
        logger.info(f"[GET /users/{user_id}] User found: {db_user.email}")
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET /users/{user_id}] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー取得中にエラーが発生しました"
        )

@router.put("/{user_id}", response_model=UserRead, tags=["Users"])
def update_user_data(
    user_id: int,
    user_in: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """ユーザー情報を更新します。"""
    try:
        if user_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なユーザーIDです"
            )
        
        # 入力バリデーション
        if user_in.name is not None and not user_in.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ユーザー名を入力してください"
            )
        
        if user_in.email is not None and not user_in.email.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="メールアドレスを入力してください"
            )
        
        # 権限チェック: 自分自身のみ更新可能
        if current_user.id != user_id:
            logger.warning(f"[PUT /users/{user_id}] User {current_user.id} attempted unauthorized update")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="他のユーザーの情報は更新できません"
            )
        
        logger.info(f"[PUT /users/{user_id}] Updating user")
        db_user = get_user_by_id(session=session, user_id=user_id)
        
        if not db_user:
            logger.warning(f"[PUT /users/{user_id}] User not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ユーザーが見つかりません"
            )
        
        updated_user = update_user(session=session, user=db_user, user_in=user_in)
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ユーザー情報の更新に失敗しました"
            )
        
        logger.info(f"[PUT /users/{user_id}] User updated successfully")
        return updated_user
    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error(f"[PUT /users/{user_id}] Integrity error: {str(e)}")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に使用されています"
        )
    except Exception as e:
        logger.error(f"[PUT /users/{user_id}] Error: {str(e)}", exc_info=True)
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー情報更新中にエラーが発生しました"
        )

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
def delete_user_data(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """ユーザーを論理削除します。"""
    try:
        if user_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なユーザーIDです"
            )
        
        # 権限チェック: 自分自身のみ削除可能
        if current_user.id != user_id:
            logger.warning(f"[DELETE /users/{user_id}] User {current_user.id} attempted unauthorized deletion")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="他のユーザーは削除できません"
            )
        
        logger.info(f"[DELETE /users/{user_id}] Deleting user")
        db_user = get_user_by_id(session=session, user_id=user_id)
        
        if not db_user:
            # 存在しないIDへのDELETEは成功と見なす (冪等性の観点)
            logger.info(f"[DELETE /users/{user_id}] User not found, treating as success")
            return None
        
        delete_user(session=session, user=db_user)
        logger.info(f"[DELETE /users/{user_id}] User deleted successfully")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE /users/{user_id}] Error: {str(e)}", exc_info=True)
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー削除中にエラーが発生しました"
        )