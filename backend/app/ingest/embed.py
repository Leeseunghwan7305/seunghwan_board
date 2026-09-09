from openai import OpenAI
from app.config import settings


def embed_texts(texts: list[str], api_key: str) -> list[list[float]]:
    client = OpenAI(api_key=api_key)
    resp = client.embeddings.create(model=settings.EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]
