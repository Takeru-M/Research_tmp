from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import logging
from app.core.logging import user_log_buffer
from datetime import datetime

router = APIRouter()

# ============ ログデータモデル ============

class LogData(BaseModel):
    timestamp: str
    type: str  # 'user_action'
    action: Optional[str] = None
    details: Optional[dict] = None
    userAgent: str
    url: str
    userId: Optional[str] = None

class BatchLogRequest(BaseModel):
    logs: List[LogData]
    batchTimestamp: str

# ============ ログエンドポイント ============

@router.post("/")
async def receive_frontend_logs(request: BatchLogRequest):
    """フロントエンドからのユーザアクションログを受け取り"""
    if not request.logs:
        return {"status": "success", "received": 0}

    try:
        for log_data in request.logs:
            if log_data.type != 'user_action':
                continue

            # ログデータを整形してバッファに追加
            formatted_log = {
                'timestamp': log_data.timestamp,
                'type': log_data.type,
                'action': log_data.action,
                'details': log_data.details or {},
                'userAgent': log_data.userAgent,
                'url': log_data.url,
                'userId': log_data.userId or 'anonymous',
                'source': 'frontend',
                'received_at': datetime.utcnow().isoformat()
            }
            
            await user_log_buffer.add_log(formatted_log)

        return {"status": "success", "received": len(request.logs)}
    except Exception as e:
        logging.error(f"[receive_frontend_logs] Failed to process batch: {str(e)}", exc_info=True)
        return {"status": "error", "detail": str(e), "received": 0}