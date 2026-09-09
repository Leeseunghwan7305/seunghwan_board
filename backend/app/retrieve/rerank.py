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
        # 리랭커 로드/추론 실패 → RRF 순위 그대로 사용(graceful degradation).
        # RRF 점수(≈0.03)는 bge 로짓과 스케일이 달라 answer.py의 임계값(0.3)에
        # 그대로 걸리면 항상 "근거 없음"이 되므로, 임계값을 통과하는 sentinel 점수를
        # 부여해 생성 단계로 넘기고 근거 유무 판단은 LLM 프롬프트에 위임한다.
        fallback = hits[:top_n]
        for h in fallback:
            h["score"] = 1.0
        return fallback
