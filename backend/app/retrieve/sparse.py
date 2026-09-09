from sqlalchemy import text
from app.db.session import SessionLocal  # noqa

def sparse_search(query: str, db, k: int = 10) -> list[dict]:
    sql = text(
        "SELECT id, page, content, "
        "ts_rank(content_tsv, plainto_tsquery('simple', :q)) AS score "
        "FROM chunks "
        "WHERE content_tsv @@ plainto_tsquery('simple', :q) "
        "ORDER BY score DESC LIMIT :k"
    )
    rows = db.execute(sql, {"q": query, "k": k}).fetchall()
    return [
        {"chunk_id": str(r.id), "page": r.page, "content": r.content, "rank": i}
        for i, r in enumerate(rows)
    ]
