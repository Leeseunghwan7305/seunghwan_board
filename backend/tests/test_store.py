import pytest
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.db import models
from app.ingest.store import store_document

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_store_document_inserts_rows():
    db = SessionLocal()
    chunks = [{"page": 1, "chunk_index": 0, "content": "환불 30일"}]
    embeddings = [[0.05] * 1536]
    doc_id = store_document("s.pdf", 1, chunks, embeddings, db)
    got = db.query(models.Chunk).filter(models.Chunk.document_id == doc_id).all()
    assert len(got) == 1
    assert got[0].content == "환불 30일"
    db.close()
