from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.deps import get_db, get_openai_key
from app.retrieve.pipeline import hybrid_answer
from app.cache import get_answer, put_answer

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str


@router.post("")
def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(get_openai_key),
):
    cached = get_answer(body.query)
    if cached is not None:
        return cached
    result = hybrid_answer(body.query, db, api_key)
    put_answer(body.query, result)
    return result
