from unittest.mock import patch
from app.retrieve import rerank


def test_rerank_orders_by_model_score():
    hits = [
        {"chunk_id": "A", "page": 1, "content": "환불 안내", "score": 0.1},
        {"chunk_id": "B", "page": 2, "content": "배송 안내", "score": 0.9},
    ]
    with patch.object(rerank, "_get_model") as gm:
        gm.return_value.predict.return_value = [5.0, 1.0]  # A가 더 관련
        out = rerank.rerank("환불", hits, top_n=1)
    assert out[0]["chunk_id"] == "A"


def test_rerank_falls_back_when_model_unavailable():
    hits = [{"chunk_id": "A", "page": 1, "content": "x", "score": 0.5}]
    with patch.object(rerank, "_get_model", side_effect=RuntimeError("no model")):
        out = rerank.rerank("q", hits, top_n=3)
    assert out == hits[:3]


def test_rerank_fallback_scores_pass_threshold():
    from app.config import settings
    hits = [{"chunk_id": "A", "page": 1, "content": "x", "score": 0.02}]
    with patch.object(rerank, "_get_model", side_effect=RuntimeError("no model")):
        out = rerank.rerank("q", hits, top_n=3)
    assert out[0]["score"] >= settings.SIMILARITY_THRESHOLD
