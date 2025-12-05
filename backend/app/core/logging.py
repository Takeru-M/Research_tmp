import asyncio
import json
import logging
import time
import os
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from typing import Callable

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
        # log_dataまたはextra_dataから情報を取得
        if hasattr(record, "log_data"):
            log_data.update(record.log_data)
        elif hasattr(record, "extra_data"):
            log_data.update(record.extra_data)
        return json.dumps(log_data, ensure_ascii=False)

class LoggingMiddleware(BaseHTTPMiddleware):
    # ログバッファ
    log_buffer: list = []
    buffer_lock = asyncio.Lock()
    batch_size = 100
    batch_interval_seconds = 60
    batch_task = None

    async def dispatch(self, request: Request, call_next: Callable):
        """BaseHTTPMiddlewareの正しい使用方法"""
        start_time = time.time()
        
        # リクエスト情報を記録
        response = await call_next(request)
        
        # レスポンス時間を計算
        duration = (time.time() - start_time) * 1000  # ミリ秒
        
        # ログデータを作成
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'api',
            'method': request.method,
            'path': request.url.path,
            'status': response.status_code,
            'duration': duration,
            'userAgent': request.headers.get('user-agent', ''),
            'source': 'backend'
        }
        
        # バッファに追加
        await self.add_to_buffer(log_data)
        
        return response

    @classmethod
    async def add_to_buffer(cls, log_data: dict):
        """ログをバッファに追加"""
        async with cls.buffer_lock:
            cls.log_buffer.append(log_data)
            
            # バッファサイズがしきい値に達したら即座に送信
            if len(cls.log_buffer) >= cls.batch_size:
                await cls.flush_buffer()
            # バッチタスクがなければスケジュール
            elif cls.batch_task is None or cls.batch_task.done():
                cls.batch_task = asyncio.create_task(cls.schedule_flush())

    @classmethod
    async def schedule_flush(cls):
        """定期的にバッファをフラッシュ"""
        try:
            await asyncio.sleep(cls.batch_interval_seconds)
            async with cls.buffer_lock:
                if cls.log_buffer:
                    await cls.flush_buffer()
        except asyncio.CancelledError:
            pass

    @classmethod
    async def flush_buffer(cls):
        """バッファ内のログをサーバーに送信"""
        if not cls.log_buffer:
            return
        
        logs_to_send = cls.log_buffer.copy()
        cls.log_buffer.clear()
        
        try:
            logger = logging.getLogger('api_access')
            for log_data in logs_to_send:
                log_record = logging.LogRecord(
                    name='api_access',
                    level=logging.INFO,
                    pathname='',
                    lineno=0,
                    msg=f"API {log_data['method']} {log_data['path']}",
                    args=(),
                    exc_info=None,
                )
                log_record.log_data = log_data
                logger.handle(log_record)
        except Exception as e:
            logging.error(f"[LoggingMiddleware] Failed to flush logs: {str(e)}", exc_info=True)

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

def setup_loggers():
    """ロガーのセットアップ"""
    # logsディレクトリが存在しない場合は作成
    os.makedirs("logs", exist_ok=True)
    
    for logger_name in ["api_access", "user_action"]:
        logger = logging.getLogger(logger_name)
        
        # 既存のハンドラを削除（重複を防ぐ）
        logger.handlers.clear()
        
        # ファイルハンドラを作成
        handler = logging.FileHandler(f"logs/{logger_name}.log", encoding="utf-8")
        handler.setFormatter(JsonFormatter())
        
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False  # ルートロガーへの伝播を防止