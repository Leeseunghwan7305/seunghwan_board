from sqlalchemy import select
from app.db import models

def dense_search(query_embedding, db, k: int = 10) -> list[dict]:
    distance = models.Chunk.embedding.cosine_distance(query_embedding)
    stmt = (
        select(models.Chunk, distance.label("distance"))
        .order_by(distance)
        .limit(k)
    )
    rows = db.execute(stmt).all()  # rows of (Chunk, distance)
    return [
        {
            "chunk_id": str(c.id),
            "page": c.page,
            "content": c.content,
            "rank": i,
            "score": 1.0 - float(d),
        }
        for i, (c, d) in enumerate(rows)
    ]
