from fastapi import Header, HTTPException
from app.config import settings
from app.db.session import SessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_openai_key(x_openai_key: str | None = Header(default=None, alias="X-OpenAI-Key")) -> str:
    key = x_openai_key or settings.OPENAI_API_KEY
    if not key:
        raise HTTPException(status_code=400, detail="OpenAI API 키가 필요해요. 키를 먼저 등록해 주세요.")
    return key
