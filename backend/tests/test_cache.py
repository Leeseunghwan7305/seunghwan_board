import hashlib
import io
import uuid
from unittest.mock import MagicMock, patch

import fitz  # PyMuPDF
import pytest
from fastapi.testclient import TestClient

from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.db import models
from app.main import app
from app import cache as answer_cache

FIXTURE_PATH = "tests/fixtures/sample.pdf"


@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()


def _fixed_embed(texts, api_key=None):
    return [[0.01] * 1536 for _ in texts]


def _make_pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _purge_by_hash(content_hash: str) -> None:
    """Test isolation helper: since Postgres persists across test runs, a
    previous run's upload of the same fixture bytes would leave a document
    with this content_hash already stored, making the dedup test's "first
    upload is NOT cached" assertion flaky on reruns. Clear any such rows
    before the test uploads, so each run starts from a clean slate."""
    db = SessionLocal()
    try:
        docs = db.query(models.Document).filter(models.Document.content_hash == content_hash).all()
        for doc in docs:
            db.query(models.Chunk).filter(models.Chunk.document_id == doc.id).delete()
            db.delete(doc)
        db.commit()
    finally:
        db.close()


def test_ingest_dedup_skips_reembedding_on_duplicate_upload():
    client = TestClient(app)
    with open(FIXTURE_PATH, "rb") as f:
        data = f.read()

    content_hash = hashlib.sha256(data).hexdigest()
    _purge_by_hash(content_hash)

    mock_embed = MagicMock(side_effect=_fixed_embed)
    with patch("app.routers.documents.embed_texts", mock_embed):
        r1 = client.post("/documents", files={"file": ("sample.pdf", data, "application/pdf")})
        assert r1.status_code == 200
        body1 = r1.json()
        assert body1["cached"] is False

        r2 = client.post("/documents", files={"file": ("sample.pdf", data, "application/pdf")})
        assert r2.status_code == 200
        body2 = r2.json()

    assert body2["cached"] is True
    assert body2["document_id"] == body1["document_id"]
    assert body2["chunks"] == body1["chunks"]
    mock_embed.assert_called_once()


def test_chat_answer_cache_hit_skips_pipeline():
    client = TestClient(app)
    fake = {"answer": "환불은 30일 [p.3].", "citations": [{"page": 3, "snippet": "환불", "score": 0.9}]}
    mock_answer = MagicMock(return_value=fake)
    query = "동일 질문 캐시 테스트?"

    with patch("app.routers.chat.hybrid_answer", mock_answer):
        r1 = client.post("/chat", json={"query": query})
        r2 = client.post("/chat", json={"query": query})

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json() == fake
    mock_answer.assert_called_once()


def test_new_ingest_clears_answer_cache():
    client = TestClient(app)
    answer_cache.put_answer("q", {"answer": "stale", "citations": []})
    assert answer_cache.get_answer("q") is not None

    new_pdf = _make_pdf_bytes(f"Distinct fixture for cache invalidation testing {uuid.uuid4()}.")

    with patch("app.routers.documents.embed_texts", side_effect=_fixed_embed):
        r = client.post("/documents", files={"file": ("distinct.pdf", new_pdf, "application/pdf")})

    assert r.status_code == 200
    assert r.json()["cached"] is False
    assert answer_cache.get_answer("q") is None
