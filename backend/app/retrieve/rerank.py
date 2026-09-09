_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder
        _model = CrossEncoder("BAAI/bge-reranker-v2-m3")
    return _model


def rerank(query: str, hits: list[dict], top_n: int = 3) -> list[dict]:
    if not hits:
        return []
    try:
        model = _get_model()
        pairs = [(query, h["content"]) for h in hits]
        scores = model.predict(pairs)
        for h, s in zip(hits, scores):
            h["score"] = float(s)
        ranked = sorted(hits, key=lambda x: x["score"], reverse=True)
        return ranked[:top_n]
    except Exception:
        # 리랭커 로드/추론 실패 → RRF 순위 그대로 사용
        return hits[:top_n]
