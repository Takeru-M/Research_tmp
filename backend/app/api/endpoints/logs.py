from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import logging

router = APIRouter()

# ============ ログデータモデル ============

class LogData(BaseModel):
    timestamp: str
    type: str  # 'user_action'
    action: str | None = None
    details: dict | None = None
    userAgent: str
    url: str

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
            # ユーザアクションのみ処理
            if log_data.type != 'user_action':
                continue

            log_record = logging.LogRecord(
                name='user_action',
                level=logging.INFO,
                pathname='',
                lineno=0,
                msg=f"User action: {log_data.action}",
                args=(),
                exc_info=None,
            )
            
            log_dict = log_data.dict()
            log_dict['source'] = 'frontend'
            log_record.log_data = log_dict
            
            logging.getLogger('user_action').handle(log_record)

        return {"status": "success", "received": len(request.logs)}
    except Exception as e:
        logging.error(f"[receive_frontend_logs] Failed to process batch: {str(e)}", exc_info=True)
        return {"status": "error", "detail": str(e), "received": 0}