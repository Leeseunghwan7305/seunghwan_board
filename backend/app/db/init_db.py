from sqlalchemy import text
from app.db.session import engine, Base
from app.db import models  # noqa: F401  (테이블 등록)


def init_db():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING GIN (content_tsv)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks "
            "USING hnsw (embedding vector_cosine_ops)"
        ))
