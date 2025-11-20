from fastapi import HTTPException, status
from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from app.models import User
from app.schemas import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password

import logging
logger = logging.getLogger(__name__)

# --- CRUD Operations ---

def get_user_by_email(session: Session, email: str) -> Optional[User]:
    """メールアドレスでユーザーを取得します (論理削除されていないもの)。"""
    logger.debug(f"DB search started for email: {email}")
    statement = select(User).where(User.email == email, User.deleted_at == None)
    user = session.exec(statement).first()
    if user:
        logger.debug(f"User found: {email}")
    else:
        logger.debug(f"User not found: {email}")
    return user

def get_user_by_username(session: Session, username: str) -> Optional[User]:
    """ユーザー名に基づいてユーザーを取得します (認証ヘルパー)。"""
    # ユーザー名で検索し、論理削除されていないことを確認
    logger.debug(f"DB search started for username: {username}")
    statement = select(User).where(User.name == username, User.deleted_at == None)
    user = session.exec(statement).first()
    if user:
        logger.debug(f"User found: {username}")
    else:
        logger.debug(f"User not found: {username}")
    return user

def authenticate_user_by_email(session: Session, email: str, password: str) -> Optional[User]:
    """メールアドレスとパスワードで認証します。"""
    user = get_user_by_email(session, email)
    if not user:
        logger.warning(f"Authentication flow: Email not found in DB: {email}")
        return None

    try:
        is_password_valid = verify_password(password, user.hashed_password)
    except Exception as e:
        logger.error(f"Error during password verification for {email}", exc_info=True)
        return None

    if not is_password_valid:
        logger.warning(f"Authentication flow: Password mismatch for user: {email}")
        return None

    logger.info(f"Authentication flow: Successfully authenticated user: {email}")
    return user

def authenticate_user(session: Session, username: str, password: str) -> Optional[User]:
    """emailとパスワードで認証します。"""

    # 1. ユーザーの存在確認 (ユーザー名でDBを検索)
    user = get_user_by_username(session, username)
    if not user:
        logger.warning(f"Authentication flow: Username not found in DB: {username}")
        return None
    
    # 2. パスワード検証
    logger.debug(f"Authentication flow: User found, verifying password for: {username}")
    # user.hashed_passwordはUserモデルに存在するフィールドと仮定
    
    # 💡 パスワード検証関数内でエラーが発生しないか、try-exceptで囲む
    try:
        is_password_valid = verify_password(password, user.hashed_password)
    except Exception as e:
        logger.error(f"Authentication flow: Error during password verification for {username}. Hash problem?", exc_info=True)
        # 認証失敗として扱う (サーバー内部でハッシュに問題がある可能性)
        return None
    
    if not is_password_valid:
        logger.warning(f"Authentication flow: Password mismatch for user: {username}")
        return None
    
    # 3. 認証成功
    logger.info(f"Authentication flow: Successfully authenticated user: {username}")
    return user

def create_user(session: Session, user_in: UserCreate) -> User:
    """新しいユーザーを作成し、データベースに保存します。"""

    # メール重複チェック
    if get_user_by_email(session, user_in.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )

    # パスワードをハッシュ化
    hashed_password = get_password_hash(user_in.password)

    # UserCreateからUserモデルを作成
    user_data = user_in.model_dump(exclude={"password"})
    db_user = User(
        name=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
    )

    # DBに保存
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    """IDに基づいてユーザーを取得します (論理削除されていないもの)。"""
    # 論理削除チェック
    statement = select(User).where(User.id == user_id, User.deleted_at == None)
    return session.exec(statement).first()

def get_users(session: Session, offset: int = 0, limit: int = 100) -> List[User]:
    """全ユーザーを取得します (論理削除されていないもの)。"""
    statement = select(User).where(User.deleted_at == None).offset(offset).limit(limit)
    return session.exec(statement).all()

def update_user(session: Session, user: User, user_in: UserUpdate) -> User:
    """ユーザー情報を更新します。"""
    update_data = user_in.model_dump(exclude_unset=True)

    # パスワードが含まれていればハッシュ化して更新
    if "password" in update_data and update_data["password"]:
        # hashed_passwordキーに置き換える
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    # モデルを更新
    for key, value in update_data.items():
        setattr(user, key, value)
    
    # updated_atを現在時刻に更新
    # 💡 モデル側でイベントフックや default_factory を使う方が望ましいが、ここでは明示的に設定
    user.updated_at = datetime.utcnow()

    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def delete_user(session: Session, user: User) -> User:
    """ユーザーを論理削除します。"""
    user.deleted_at = datetime.utcnow()
    
    session.add(user)
    session.commit()
    session.refresh(user)
    return user