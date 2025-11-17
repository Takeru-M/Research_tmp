from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime

class PdfRectWithPage(BaseModel):
    pageNum: int
    x1: float
    y1: float
    x2: float
    y2: float
    elementType: Optional[str] = 'unknown'

class Highlight(BaseModel):
    id: str
    createdAt: datetime
    createdBy: str
    memo: str
    rects: List[PdfRectWithPage]
    text: str
    type: str

class Comment(BaseModel):
    id: str
    highlightId: str
    parentId: Optional[str] = None
    author: str
    text: str
    createdAt: datetime
    editedAt: Optional[datetime] = None
    deleted: Optional[bool] = False

class EditorStateIn(BaseModel):
    fileType: Optional[str]
    fileContent: Optional[str]
    pdfTextContent: Optional[str]
    highlights: List[Highlight]
    comments: List[Comment]
    responses: Optional[Dict[str, str]] = None
    completionStage: int
