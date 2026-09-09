from unittest.mock import patch
from app.retrieve import pipeline

def test_retrieve_hits_dense_skips_sparse_and_rerank():
    dense = [{"chunk_id": "A", "page": 1, "content": "Refunds 30 days", "rank": 0},
             {"chunk_id": "B", "page": 2, "content": "Shipping 2 days", "rank": 1}]
    with patch.object(pipeline, "embed_texts", return_value=[[0.0]*1536]), \
         patch.object(pipeline, "dense_search", return_value=dense) as ds, \
         patch.object(pipeline, "sparse_search") as ss, \
         patch.object(pipeline, "rerank") as rr:
        hits = pipeline.retrieve_hits("q", db=None, mode="dense", top_n=1)
    ds.assert_called_once()
    ss.assert_not_called()
    rr.assert_not_called()
    assert hits == dense[:1]

def test_retrieve_hits_hybrid_uses_all_stages():
    with patch.object(pipeline, "embed_texts", return_value=[[0.0]*1536]), \
         patch.object(pipeline, "dense_search", return_value=[]), \
         patch.object(pipeline, "sparse_search", return_value=[]), \
         patch.object(pipeline, "reciprocal_rank_fusion", return_value=[]) as rrf, \
         patch.object(pipeline, "rerank", return_value=[{"chunk_id":"A","page":1,"content":"x","score":1.0}]) as rr:
        hits = pipeline.retrieve_hits("q", db=None, mode="hybrid", top_n=3)
    rrf.assert_called_once()
    rr.assert_called_once()
    assert hits[0]["content"] == "x"

def test_answer_for_eval_returns_answer_and_contexts():
    hits = [{"chunk_id":"A","page":1,"content":"Refunds 30 days","score":5.0}]
    with patch.object(pipeline, "retrieve_hits", return_value=hits), \
         patch.object(pipeline, "generate_answer", return_value={"answer":"30 days [p.1].","citations":[]}):
        out = pipeline.answer_for_eval("q", db=None, mode="hybrid")
    assert out["answer"] == "30 days [p.1]."
    assert out["contexts"] == ["Refunds 30 days"]

def test_retrieve_hits_bad_mode():
    import pytest
    with pytest.raises(ValueError):
        pipeline.retrieve_hits("q", db=None, mode="nope")

def test_answer_for_eval_dense_reaches_generate_answer_without_keyerror():
    from unittest.mock import MagicMock
    from app.generate import answer as answer_mod
    dense_hits = [{"chunk_id": "A", "page": 1, "content": "Refunds 30 days", "rank": 0, "score": 0.7}]
    with patch.object(pipeline, "embed_texts", return_value=[[0.0]*1536]), \
         patch.object(pipeline, "dense_search", return_value=dense_hits), \
         patch.object(answer_mod, "_client") as client:
        client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="30 days [p.1]."))])
        out = pipeline.answer_for_eval("q", db=None, mode="dense")
    assert out["answer"] == "30 days [p.1]."
    assert out["contexts"] == ["Refunds 30 days"]
