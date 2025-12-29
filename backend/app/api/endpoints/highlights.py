from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List
from app.db.base import get_session
from pydantic import BaseModel
import json
import logging
import app.crud.comment as crud_comment
from app.schemas.highlight import HighlightCreate, HighlightRead, HighlightWithComments
from app.schemas.comment import CommentCreate, CommentRead
from app.schemas.highlight_rect import HighlightRectCreate
from app.crud import highlight as crud_highlight
from app.crud import highlight_rect as crud_highlight_rect

# ロガーの設定
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()

class RectData(BaseModel):
    page_num: int
    x1: float
    y1: float
    x2: float
    y2: float
    element_type: str | None = None

class HighlightWithMemoCreate(BaseModel):
    """ハイライトとメモを同時に作成するためのスキーマ"""
    document_file_id: int
    created_by: str
    memo: str
    text: str | None = None
    rects: List[RectData]
    element_type: str | None = None

@router.post("/", response_model=HighlightRead, status_code=status.HTTP_201_CREATED)
def create_highlight_with_memo(
    *,
    session: Session = Depends(get_session),
    highlight_data: HighlightWithMemoCreate
):
    """ハイライトとメモ(ルートコメント)を同時に作成"""
    try:
        # === 入力バリデーション ===
        if highlight_data.document_file_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なファイルIDです"
            )
        
        if not highlight_data.created_by or not highlight_data.created_by.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="作成者名を入力してください"
            )
        
        if not highlight_data.memo or not highlight_data.memo.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="メモを入力してください"
            )
        
        if not highlight_data.rects or len(highlight_data.rects) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ハイライト範囲が指定されていません"
            )
        
        # === データ受信の確認ログ ===
        logger.info("=" * 80)
        logger.info("Received highlight creation request")
        logger.info("=" * 80)
        
        # 受信データ全体をJSON形式で出力
        logger.info(f"Full request data:\n{json.dumps(highlight_data.model_dump(), indent=2, ensure_ascii=False)}")
        
        # 各フィールドを個別に確認
        logger.info(f"document_file_id: {highlight_data.document_file_id} (type: {type(highlight_data.document_file_id)})")
        logger.info(f"created_by: {highlight_data.created_by} (type: {type(highlight_data.created_by)})")
        logger.info(f"memo: {highlight_data.memo} (type: {type(highlight_data.memo)})")
        logger.info(f"memo length: {len(highlight_data.memo)} characters")
        logger.info(f"text: {highlight_data.text} (type: {type(highlight_data.text)})")
        logger.info(f"element_type (top level): {highlight_data.element_type}")
        logger.info(f"Number of rects: {len(highlight_data.rects)}")
        
        # 各矩形データを詳細に確認
        for idx, rect in enumerate(highlight_data.rects):
            logger.info(f"\nRect #{idx + 1}:")
            logger.info(f"  page_num: {rect.page_num} (type: {type(rect.page_num)})")
            logger.info(f"  x1: {rect.x1} (type: {type(rect.x1)})")
            logger.info(f"  y1: {rect.y1} (type: {type(rect.y1)})")
            logger.info(f"  x2: {rect.x2} (type: {type(rect.x2)})")
            logger.info(f"  y2: {rect.y2} (type: {type(rect.y2)})")
            logger.info(f"  element_type: {highlight_data.element_type} (type: {type(highlight_data.element_type)})")
        
        logger.info("=" * 80)
        
        # 1. ハイライトを作成
        logger.info("Creating highlight in database...")
        highlight_in = HighlightCreate(
            document_file_id=highlight_data.document_file_id,
            created_by=highlight_data.created_by,
            memo=highlight_data.memo,
            text=highlight_data.text
        )
        logger.info(f"Highlight input data: {highlight_in.model_dump()}")
        
        db_highlight = crud_highlight.create_highlight(session, highlight_in)
        
        if not db_highlight or not db_highlight.id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ハイライトの作成に失敗しました"
            )
        
        logger.info(f"Highlight created with ID: {db_highlight.id}")
        
        # 2. ハイライト矩形を作成
        logger.info(f"Creating {len(highlight_data.rects)} highlight rectangles...")
        for idx, rect_data in enumerate(highlight_data.rects):
            # 使用するelement_typeを決定（トップレベル > rect個別 > デフォルト）
            final_element_type = highlight_data.element_type or rect_data.element_type or 'unknown'
            
            logger.info(f"\nCreating rect #{idx + 1} with element_type: {final_element_type}")
            
            rect_in = HighlightRectCreate(
                highlight_id=db_highlight.id,
                page_num=rect_data.page_num,
                x1=rect_data.x1,
                y1=rect_data.y1,
                x2=rect_data.x2,
                y2=rect_data.y2,
                element_type=final_element_type
            )
            logger.info(f"Rect input data: {rect_in.model_dump()}")
            
            db_rect = crud_highlight_rect.create_highlight_rect(session, rect_in)
            
            if not db_rect or not db_rect.id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"矩形データ #{idx + 1} の作成に失敗しました"
                )
            
            logger.info(f"Rect created with ID: {db_rect.id}")
        
        # 3. ルートコメント(メモ)を作成
        logger.info("Creating root comment...")
        comment_in = CommentCreate(
            highlight_id=db_highlight.id,
            parent_id=None,
            author=highlight_data.created_by,
            text=highlight_data.memo
        )
        logger.info(f"Comment input data: {comment_in.model_dump()}")
        
        db_comment = crud_comment.create_comment(session, comment_in)
        
        if not db_comment or not db_comment.id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="コメントの作成に失敗しました"
            )
        
        logger.info(f"Comment created with ID: {db_comment.id}")
        
        # 4. 作成したハイライトと矩形を返す
        logger.info("Fetching created highlight and rects...")
        session.refresh(db_highlight)
        rects = crud_highlight_rect.get_rects_by_highlight(session, db_highlight.id)
        
        logger.info(f"Retrieved {len(rects)} rects for highlight {db_highlight.id}")
        
        # commentも取得
        comment = crud_comment.get_comment_by_highlight_id(session, db_highlight.id)
        logger.info(f"Get comment: {comment}")
        
        result = HighlightRead(
            id=db_highlight.id,
            comment_id=comment.id if comment else None,
            document_file_id=db_highlight.document_file_id,
            created_by=db_highlight.created_by,
            memo=db_highlight.memo,
            text=db_highlight.text,
            created_at=db_highlight.created_at,
            rects=rects
        )
        
        logger.info(f"Returning response:\n{json.dumps(result.model_dump(), indent=2, default=str, ensure_ascii=False)}")
        logger.info("=" * 80)
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error during highlight creation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"ERROR occurred during highlight creation:")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error(f"Error details:", exc_info=True)
        logger.error("=" * 80)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ハイライト作成中にエラーが発生しました"
        )

@router.get("/file/{file_id}", response_model=List[HighlightWithComments])
def get_highlights_by_file_endpoint(
    *,
    session: Session = Depends(get_session),
    file_id: int
):
    """特定ファイルのすべてのハイライトと、紐づく全コメントを取得"""
    try:
        if file_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なファイルIDです"
            )
        
        logger.info(f"[with-comments] Fetching highlights for file_id: {file_id}")
        highlights = crud_highlight.get_highlights_by_file(session, file_id)
        logger.info(f"[with-comments] Found {len(highlights)} highlights")

        result: List[HighlightWithComments] = []
        for hl in highlights:
            try:
                rects = crud_highlight_rect.get_rects_by_highlight(session, hl.id)
                comments = crud_comment.get_active_comments_by_highlight(session, hl.id) or []

                highlight_read = HighlightRead(
                    id=hl.id,
                    comment_id=comments[0].id if comments else None,
                    document_file_id=hl.document_file_id,
                    created_by=hl.created_by,
                    memo=hl.memo,
                    text=hl.text,
                    created_at=hl.created_at,
                    rects=rects
                )

                comment_reads = [
                    CommentRead(
                        id=c.id,
                        highlight_id=c.highlight_id,
                        parent_id=c.parent_id,
                        author=c.author,
                        text=c.text,
                        created_at=c.created_at,
                        updated_at=c.updated_at
                    )
                    for c in comments
                ]

                result.append(HighlightWithComments(
                    highlight=highlight_read,
                    comments=comment_reads
                ))
            except Exception as e:
                logger.error(f"Error processing highlight {hl.id}: {str(e)}")
                # 個別のハイライトエラーはスキップして続行
                continue

        logger.info(f"[with-comments] Returning {len(result)} highlights with comments")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching highlights for file {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ハイライト取得中にエラーが発生しました"
        )

@router.delete("/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_highlight_endpoint(
    *,
    session: Session = Depends(get_session),
    highlight_id: int
):
    """ハイライトと関連コメントを削除"""
    try:
        if highlight_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無効なハイライトIDです"
            )
        
        logger.info(f"Deleting highlight {highlight_id} and related comments")
        
        # ハイライトの存在確認
        highlight = crud_highlight.get_highlight_by_id(session, highlight_id)
        if not highlight:
            logger.warning(f"Highlight not found for deletion: ID={highlight_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ハイライトが見つかりません"
            )
        
        # ハイライトを削除（関連コメントも削除される）
        crud_highlight.delete_highlight(session, highlight_id)
        
        logger.info(f"Highlight {highlight_id} deleted successfully")
        return None
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error deleting highlight {highlight_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting highlight {highlight_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ハイライト削除中にエラーが発生しました"
        )
