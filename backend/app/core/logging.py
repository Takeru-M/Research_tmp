import logging
import json
from datetime import datetime
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# ロガー設定
api_logger = logging.getLogger("api_access")
user_logger = logging.getLogger("user_action")

# JSONフォーマッターでログを構造化
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)
        return json.dumps(log_data)

def setup_loggers():
    for logger in [api_logger, user_logger]:
        handler = logging.FileHandler(f"logs/{logger.name}.log")
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

# APIアクセスログミドルウェア
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = datetime.now()
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()

        log_record = logging.LogRecord(
            name="api_access",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="API Access",
            args=(),
            exc_info=None,
        )
        log_record.extra_data = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "process_time": f"{process_time:.3f}s",
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
        api_logger.handle(log_record)
        return response

# ユーザー操作ログ用ヘルパー関数
def log_user_action(action: str, user_id: str = None, details: dict = None):
    log_record = logging.LogRecord(
        name="user_action",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg=f"User Action: {action}",
        args=(),
        exc_info=None,
    )
    log_record.extra_data = {
        "action": action,
        "user_id": user_id,
        "details": details or {},
    }
    user_logger.handle(log_record)