from typing import Annotated, Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from app.db.base import get_session
from app.core.security import oauth2_scheme, decode_access_token
from app.models.users import User
import logging

logger = logging.getLogger(__name__)

# ----------------------------------------------------
# データベースセッションを取得し、クローズする
# ----------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """FastAPI 依存性注入用のセッション生成"""
    yield from get_session()

# ----------------------------------------------------

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Session = Depends(get_db),
) -> User:
    """トークンからユーザーを取得"""
    try:
        logger.info("Starting get_current_user")
        payload = decode_access_token(token)
        
        if not payload:
            logger.error("Payload is None")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("user_id")
        logger.info(f"Extracted user_id: {user_id}")
        
        if user_id is None:
            logger.error("user_id is None")
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = session.exec(
            select(User).where(User.id == user_id)
        ).first()
        
        if not user:
            logger.error(f"User not found for user_id: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"Successfully retrieved user: {user.email}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_current_user: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Invalid token")