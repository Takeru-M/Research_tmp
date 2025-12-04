from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.i18n.translator import parse_accept_language, translate
import logging

logger = logging.getLogger(__name__)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    HTTPExceptionのカスタムハンドラ
    Accept-Languageヘッダーに基づいてエラーメッセージを翻訳
    """
    # リクエストヘッダーからロケールを取得
    accept_language = request.headers.get("Accept-Language")
    locale = parse_accept_language(accept_language)
    
    # エラーメッセージを翻訳
    translated_detail = translate(str(exc.detail), locale)
    
    # ログ記録
    logger.warning(
        f"HTTPException: status={exc.status_code}, "
        f"locale={locale}, "
        f"original='{exc.detail}', "
        f"translated='{translated_detail}', "
        f"path={request.url.path}"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": translated_detail},
        headers=exc.headers
    )


async def validation_exception_handler(
    request: Request, 
    exc: RequestValidationError
) -> JSONResponse:
    """
    バリデーションエラーのカスタムハンドラ
    """
    accept_language = request.headers.get("Accept-Language")
    locale = parse_accept_language(accept_language)
    
    # バリデーションエラーメッセージを翻訳
    errors = []
    for error in exc.errors():
        error_msg = translate(error["msg"], locale)
        errors.append({
            "loc": error["loc"],
            "msg": error_msg,
            "type": error["type"]
        })
    
    logger.warning(
        f"ValidationError: locale={locale}, "
        f"errors={len(errors)}, "
        f"path={request.url.path}"
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors}
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    一般的な例外のハンドラ
    """
    accept_language = request.headers.get("Accept-Language")
    locale = parse_accept_language(accept_language)
    
    error_message = "An unexpected error occurred"
    translated_message = translate(error_message, locale)
    
    logger.error(
        f"Unexpected error: {str(exc)}, "
        f"locale={locale}, "
        f"path={request.url.path}",
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": translated_message}
    )