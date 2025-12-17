from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Any
import logging
from app.core.logging import user_log_buffer
from datetime import datetime

router = APIRouter()

# ============ ログデータモデル ============

class LogData(BaseModel):
    timestamp: str
    type: str  # 'user_action' or 'llm_analysis'
    action: Optional[str] = None
    details: Optional[dict] = None
    analysisType: Optional[str] = None
    feedback: Optional[dict] = None
    documentId: Optional[int] = None
    fileId: Optional[int] = None
    highlightCount: Optional[int] = None
    commentCount: Optional[int] = None
    userAgent: str
    url: str
    userId: Optional[str] = None

class BatchLogRequest(BaseModel):
    logs: List[LogData]
    batchTimestamp: str

# ============ ログエンドポイント ============

@router.post("/")
async def receive_frontend_logs(request: BatchLogRequest):
    """フロントエンドからのユーザアクションログとLLM分析ログを受け取り"""
    if not request.logs:
        return {"status": "success", "received": 0}

    try:
        for log_data in request.logs:
            if log_data.type == 'user_action':
                # 既存のユーザアクションログ処理
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

            elif log_data.type == 'llm_analysis':
                # LLM分析ログの処理
                formatted_log = {
                    'timestamp': log_data.timestamp,
                    'type': log_data.type,
                    'analysisType': log_data.analysisType,
                    'userId': log_data.userId or 'anonymous',
                    'documentId': log_data.documentId,
                    'fileId': log_data.fileId,
                    'highlightCount': log_data.highlightCount,
                    'commentCount': log_data.commentCount,
                    'feedback': log_data.feedback or {},
                    'userAgent': log_data.userAgent,
                    'url': log_data.url,
                    'source': 'frontend',
                    'received_at': datetime.utcnow().isoformat()
                }
                
                await user_log_buffer.add_log(formatted_log)

        return {"status": "success", "received": len(request.logs)}
    except Exception as e:
        logging.error(f"[receive_frontend_logs] Failed to process batch: {str(e)}", exc_info=True)
        return {"status": "error", "detail": str(e), "received": 0}