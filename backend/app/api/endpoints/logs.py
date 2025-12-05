from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import logging

router = APIRouter()

# ============ ログデータモデル ============

class LogData(BaseModel):
    timestamp: str
    type: str  # 'api' or 'user_action'
    method: str | None = None
    path: str | None = None
    status: int | None = None
    duration: float | None = None
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
    """フロントエンドからのバッチログを受け取り、適切なロガーに振り分け"""
    if not request.logs:
        return {"status": "success", "received": 0}

    try:
        for log_data in request.logs:
            # logTypeに応じて振り分け
            if log_data.type == 'api':
                logger_name = "api_access"
            elif log_data.type == 'user_action':
                logger_name = "user_action"
            else:
                logger_name = "user_action"

            log_record = logging.LogRecord(
                name=logger_name,
                level=logging.INFO,
                pathname="",
                lineno=0,
                msg=f"Frontend {log_data.type}",
                args=(),
                exc_info=None,
            )
            
            # フロント由来を識別できるようにsourceフィールドを追加
            log_dict = log_data.dict()
            log_dict["source"] = "frontend"
            log_record.extra_data = log_dict
            
            logging.getLogger(logger_name).handle(log_record)

        return {"status": "success", "received": len(request.logs)}
    except Exception as e:
        logging.error(f"[receive_frontend_logs] Failed to process batch: {str(e)}", exc_info=True)
        return {"status": "error", "detail": str(e), "received": 0}