from sqlalchemy import select
from app.db import models

def dense_search(query_embedding, db, k: int = 10) -> list[dict]:
    stmt = (
        select(models.Chunk)
        .order_by(models.Chunk.embedding.cosine_distance(query_embedding))
        .limit(k)
    )
    rows = db.execute(stmt).scalars().all()
    return [
        {"chunk_id": str(c.id), "page": c.page, "content": c.content, "rank": i}
        for i, c in enumerate(rows)
    ]
