from openai import OpenAI
from app.config import settings

_client = OpenAI(api_key=settings.OPENAI_API_KEY)

def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = _client.embeddings.create(model=settings.EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]
