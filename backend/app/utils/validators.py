from pydantic import EmailStr
import re
from fastapi import HTTPException, status

class ValidationError(Exception):
    """入力検証用のアプリ内例外"""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message

def validate_email(email: str):
    # Email形式チェック（必要なら有効化）
    try:
        # EmailStr.validate(str(email))
        pass
    except Exception:
        # HTTPExceptionでも良いが、auth側でValidationErrorをまとめて扱うためこちらを送出
          raise ValidationError("Invalid email format")

def validate_username(username: str):
    if not username or len(username) < 3:
        raise ValidationError("Username must be at least 3 characters")

def validate_password(password: str):
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise ValidationError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValidationError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValidationError("Password must contain at least one number")

def validate_confirm_password(password: str, confirm_password: str):
    if password != confirm_password:
        raise ValidationError("Passwords do not match")
