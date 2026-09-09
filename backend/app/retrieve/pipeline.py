from app.ingest.embed import embed_texts
from app.retrieve.dense import dense_search
from app.retrieve.sparse import sparse_search
from app.retrieve.fusion import reciprocal_rank_fusion
from app.retrieve.rerank import rerank
from app.generate.answer import generate_answer


def retrieve_hits(query: str, db, mode: str, top_n: int = 3) -> list[dict]:
    if mode not in ("dense", "hybrid"):
        raise ValueError(f"unknown mode: {mode}")
    q_emb = embed_texts([query])[0]
    if mode == "dense":
        return dense_search(q_emb, db, k=10)[:top_n]
    dense_hits = dense_search(q_emb, db, k=10)
    sparse_hits = sparse_search(query, db, k=10)
    fused = reciprocal_rank_fusion([dense_hits, sparse_hits], k=60)
    return rerank(query, fused, top_n=top_n)


def answer_for_eval(query: str, db, mode: str) -> dict:
    hits = retrieve_hits(query, db, mode)
    result = generate_answer(query, hits)
    return {"answer": result["answer"], "contexts": [h["content"] for h in hits]}


def hybrid_answer(query: str, db) -> dict:
    hits = retrieve_hits(query, db, "hybrid")
    return generate_answer(query, hits)
