from app.ingest.embed import embed_texts
from app.retrieve.dense import dense_search
from app.retrieve.sparse import sparse_search
from app.retrieve.fusion import reciprocal_rank_fusion
from app.retrieve.rerank import rerank
from app.generate.answer import generate_answer


def hybrid_answer(query: str, db) -> dict:
    q_emb = embed_texts([query])[0]
    dense_hits = dense_search(q_emb, db, k=10)
    sparse_hits = sparse_search(query, db, k=10)
    fused = reciprocal_rank_fusion([dense_hits, sparse_hits], k=60)
    top = rerank(query, fused, top_n=3)
    return generate_answer(query, top)
