from typing import List, Optional, Any
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from openai import OpenAI
from app.utils.constants import (
    FORMAT_DATA_SYSTEM_PROMPT,
    OPTION_SYSTEM_PROMPT,
    DELIBERATION_SYSTEM_PROMPT,
    OPTION_DIALOGUE_SYSTEM_PROMPT,
    DELIBERATION_DIALOGUE_SYSTEM_PROMPT,
)

import os

api_key = os.getenv("OPENAI_SECRET_KEY")
if not api_key:
    raise RuntimeError("OPENAI_SECRET_KEY is not defined.")

client = OpenAI(api_key=api_key)

router = APIRouter()


class DeliberationAnalyzeRequest(BaseModel):
    userInput: Any = Field(..., alias="userInput")


class OptionAnalyzeRequest(BaseModel):
    userInput: Any = Field(..., alias="userInput")


class PdfItem(BaseModel):
    text: str
    x1: float
    x2: float
    y1: float
    y2: float

    model_config = {"populate_by_name": True, "extra": "allow"}


class PdfLine(BaseModel):
    pageNum: int = Field(..., alias="pageNum")
    text: str
    x1: float
    x2: float
    y1: float
    y2: float
    yCenter: float = Field(..., alias="yCenter")
    items: List[PdfItem]

    model_config = {"populate_by_name": True, "extra": "allow"}


class PdfTextData(BaseModel):
    lines: List[PdfLine]
    rawText: Optional[str] = Field(None, alias="rawText")

    model_config = {"populate_by_name": True, "extra": "allow"}


class FormatDataRequest(BaseModel):
    pdfTextData: PdfTextData = Field(..., alias="pdfTextData")

    model_config = {"populate_by_name": True}


class DialogueInput(BaseModel):
    pdf_text: str
    selected_threads: List[Any]


class OptionDialogueRequest(BaseModel):
    userInput: DialogueInput = Field(..., alias="userInput")


class DeliberationDialogueRequest(BaseModel):
    userInput: DialogueInput = Field(..., alias="userInput")


def _call_chat(model: str, temperature: float, system_prompt: str, user_content: str, as_json: bool = False):
    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"} if as_json else None,
        )
        return {"analysis": resp.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to call OpenAI: {str(e)}")


@router.post("/deliberation-analyze")
def deliberation_analyze(req: DeliberationAnalyzeRequest):
    user_content = req.userInput if isinstance(req.userInput, str) else str(req.userInput)
    return _call_chat(
        model="gpt-4o-mini",
        temperature=0.2,
        system_prompt=DELIBERATION_SYSTEM_PROMPT,
        user_content=user_content,
        as_json=True,
    )


@router.post("/option-analyze")
def option_analyze(req: OptionAnalyzeRequest):
    user_content = req.userInput if isinstance(req.userInput, str) else str(req.userInput)
    return _call_chat(
        model="gpt-4o-mini",
        temperature=0.5,
        system_prompt=OPTION_SYSTEM_PROMPT,
        user_content=user_content,
        as_json=True,
    )


@router.post("/format-data")
def format_data(req: FormatDataRequest):
    user_json = req.model_dump(by_alias=True)["pdfTextData"]
    return _call_chat(
        model="gpt-4o-mini",
        temperature=0.0,
        system_prompt=FORMAT_DATA_SYSTEM_PROMPT,
        user_content=json.dumps(user_json, ensure_ascii=False),
        as_json=True,
    )


@router.post("/option-dialogue")
def option_dialogue(req: OptionDialogueRequest):
    user_json = req.model_dump(by_alias=True)["userInput"]
    return _call_chat(
        model="gpt-4o-mini",
        temperature=0.7,
        system_prompt=OPTION_DIALOGUE_SYSTEM_PROMPT,
        user_content=str(user_json),
        as_json=True,
    )


@router.post("/deliberation-dialogue")
def deliberation_dialogue(req: DeliberationDialogueRequest):
    user_json = req.model_dump(by_alias=True)["userInput"]
    return _call_chat(
        model="gpt-4o-mini",
        temperature=0.7,
        system_prompt=DELIBERATION_DIALOGUE_SYSTEM_PROMPT,
        user_content=str(user_json),
        as_json=True,
    )