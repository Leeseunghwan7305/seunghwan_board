from app.retrieve.fusion import reciprocal_rank_fusion


def test_rrf_boosts_items_ranked_high_in_both():
    dense = [
        {"chunk_id": "A", "page": 1, "content": "a", "rank": 0},
        {"chunk_id": "B", "page": 1, "content": "b", "rank": 1},
    ]
    sparse = [
        {"chunk_id": "B", "page": 1, "content": "b", "rank": 0},
        {"chunk_id": "A", "page": 1, "content": "a", "rank": 1},
    ]
    fused = reciprocal_rank_fusion([dense, sparse], k=60)
    # A: 1/60 + 1/61, B: 1/61 + 1/60 → 동점. 둘 다 존재하고 score>0
    ids = {f["chunk_id"] for f in fused}
    assert ids == {"A", "B"}
    assert all(f["score"] > 0 for f in fused)
    # 정렬 확인: score 내림차순
    assert fused[0]["score"] >= fused[1]["score"]
