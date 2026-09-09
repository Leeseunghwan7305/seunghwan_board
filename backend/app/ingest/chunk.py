from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_pages(pages: list[dict], chunk_size: int = 500, overlap: int = 80) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    out: list[dict] = []
    idx = 0
    for p in pages:
        for piece in splitter.split_text(p["text"]):
            out.append({"page": p["page"], "chunk_index": idx, "content": piece})
            idx += 1
    return out
