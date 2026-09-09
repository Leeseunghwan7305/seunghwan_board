import pytest
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.ingest.store import store_document
from app.retrieve.sparse import sparse_search

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_sparse_keyword_match():
    db = SessionLocal()
    chunks = [
        {"page": 1, "chunk_index": 0, "content": "환불 정책 안내"},
        {"page": 2, "chunk_index": 1, "content": "배송 기간 안내"},
    ]
    store_document("sp.pdf", 2, chunks, [[0.0]*1536, [0.0]*1536], db)
    hits = sparse_search("환불", db, k=2)
    assert hits[0]["content"].startswith("환불")
    db.close()
