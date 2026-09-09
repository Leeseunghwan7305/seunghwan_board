def reciprocal_rank_fusion(result_lists: list[list[dict]], k: int = 60) -> list[dict]:
    scores: dict[str, dict] = {}
    for results in result_lists:
        for hit in results:
            cid = hit["chunk_id"]
            if cid not in scores:
                scores[cid] = {"chunk_id": cid, "page": hit["page"],
                               "content": hit["content"], "score": 0.0}
            scores[cid]["score"] += 1.0 / (hit["rank"] + k)
    return sorted(scores.values(), key=lambda x: x["score"], reverse=True)
