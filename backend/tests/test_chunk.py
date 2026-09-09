from app.ingest.chunk import chunk_pages

def test_chunk_preserves_page_and_indexes():
    pages = [
        {"page": 1, "text": "가" * 1200},
        {"page": 2, "text": "나" * 300},
    ]
    chunks = chunk_pages(pages, chunk_size=500, overlap=0)
    # page1은 1200자 → 최소 3청크, page2는 1청크
    assert chunks[0]["page"] == 1
    assert chunks[0]["chunk_index"] == 0
    assert chunks[-1]["page"] == 2
    # chunk_index는 전역적으로 0,1,2,... 연속
    idxs = [c["chunk_index"] for c in chunks]
    assert idxs == list(range(len(chunks)))
