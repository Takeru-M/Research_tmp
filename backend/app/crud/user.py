# app/crud.py
from typing import List, Optional
from sqlmodel import Session, select
from app.models import User, UserCreate, UserUpdate
import bcrypt # パスワードハッシュ化ライブラリ
from datetime import datetime

def get_password_hash(password: str) -> str:
    """パスワードをハッシュ化します。"""
    # bcryptのsalt生成とハッシュ化
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """平文パスワードとハッシュを比較します。"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- CRUD Operations ---

def create_user(session: Session, user_in: UserCreate) -> User:
    """新しいユーザーを作成し、データベースに保存します。"""
    # パスワードをハッシュ化
    hashed_password = get_password_hash(user_in.password)

    # UserCreateからUserモデルを作成
    user_data = user_in.model_dump(exclude={"password"})
    db_user = User(**user_data, hashed_password=hashed_password)

    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    """IDに基づいてユーザーを取得します (論理削除されていないもの)。"""
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
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    # モデルを更新
    for key, value in update_data.items():
        if key != "password": # passwordはすでにhashed_passwordとして処理済み
            setattr(user, key, value)
    
    # updated_atを現在時刻に更新
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