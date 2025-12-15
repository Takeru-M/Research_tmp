import asyncio
import json
import logging
import time
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from typing import Callable, List
from .r2_client import get_r2_client

# ロガー設定
api_logger = logging.getLogger("api_access")
user_logger = logging.getLogger("user_action")

class LogBuffer:
    """ログバッファの基底クラス"""
    
    def __init__(self, log_type: str, batch_size: int = 100, batch_interval_seconds: int = 300):
        self.log_type = log_type  # 'api_access' or 'user_action'
        self.buffer: List[dict] = []
        self.lock = asyncio.Lock()
        self.batch_size = batch_size
        self.batch_interval_seconds = batch_interval_seconds
        self.batch_task = None
        self.r2_client = get_r2_client()
    
    async def add_log(self, log_data: dict):
        """ログをバッファに追加"""
        async with self.lock:
            self.buffer.append(log_data)
            
            # バッファサイズがしきい値に達したら即座に送信
            if len(self.buffer) >= self.batch_size:
                await self.flush_buffer()
            # バッチタスクがなければスケジュール
            elif self.batch_task is None or self.batch_task.done():
                self.batch_task = asyncio.create_task(self.schedule_flush())
    
    async def schedule_flush(self):
        """定期的にバッファをフラッシュ"""
        try:
            await asyncio.sleep(self.batch_interval_seconds)
            async with self.lock:
                if self.buffer:
                    await self.flush_buffer()
        except asyncio.CancelledError:
            pass
    
    async def flush_buffer(self):
        """バッファ内のログをR2に送信"""
        if not self.buffer:
            return
        
        logs_to_send = self.buffer.copy()
        self.buffer.clear()
        
        try:
            # タイムスタンプベースのキーを生成
            timestamp = datetime.utcnow()
            key = f"{self.log_type}/{timestamp.strftime('%Y/%m/%d')}/{timestamp.strftime('%H%M%S')}-{int(time.time() * 1000)}.json"
            
            # JSON形式でログをまとめる
            log_data = {
                "logs": logs_to_send,
                "batch_timestamp": timestamp.isoformat(),
                "count": len(logs_to_send)
            }
            
            # R2にアップロード
            success = self.r2_client.upload_log(key, json.dumps(log_data, ensure_ascii=False))
            
            if not success:
                logging.error(f"[{self.log_type}] Failed to upload logs to R2")
        
        except Exception as e:
            logging.error(f"[{self.log_type}] Failed to flush logs: {str(e)}", exc_info=True)

# グローバルバッファインスタンス
api_log_buffer = LogBuffer('api_access', batch_size=100, batch_interval_seconds=180)
user_log_buffer = LogBuffer('user_action', batch_size=50, batch_interval_seconds=180)

class LoggingMiddleware(BaseHTTPMiddleware):
    """APIアクセスログを記録するミドルウェア"""
    
    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.time()
        
        # リクエスト処理
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
        await api_log_buffer.add_log(log_data)
        
        return response

# ユーザー操作ログ用ヘルパー関数
def log_user_action(action: str, user_id: str = None, details: dict = None):
    """ユーザーアクションをログに記録"""
    log_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "user_id": user_id,
        "details": details or {},
    }
    
    # 非同期タスクとして追加
    asyncio.create_task(user_log_buffer.add_log(log_data))

def setup_loggers():
    """ロガーのセットアップ（コンソール出力用）"""
    for logger_name in ["api_access", "user_action"]:
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        
        # コンソールハンドラ（デバッグ用）
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        logger.addHandler(console_handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False

async def shutdown_loggers():
    """アプリケーション終了時にバッファをフラッシュ"""
    await api_log_buffer.flush_buffer()
    await user_log_buffer.flush_buffer()