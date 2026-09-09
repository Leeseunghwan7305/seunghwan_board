import pytest
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.ingest.store import store_document
from app.retrieve.dense import dense_search

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_dense_orders_by_similarity():
    db = SessionLocal()
    chunks = [
        {"page": 1, "chunk_index": 0, "content": "환불"},
        {"page": 2, "chunk_index": 1, "content": "배송"},
    ]
    embeddings = [[1.0] + [0.0]*1535, [0.0, 1.0] + [0.0]*1534]
    store_document("d.pdf", 2, chunks, embeddings, db)
    hits = dense_search([1.0] + [0.0]*1535, db, k=2)
    assert hits[0]["content"] == "환불"   # 쿼리와 가장 가까운 것
    assert hits[0]["rank"] == 0
    db.close()
