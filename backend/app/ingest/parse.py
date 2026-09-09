import fitz


def parse_pdf(data: bytes) -> list[dict]:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise ValueError(f"PDF를 열 수 없습니다: {e}")
    pages = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text().strip()
        if text:
            pages.append({"page": i, "text": text})
    if not pages:
        raise ValueError("추출 가능한 텍스트가 없습니다 (스캔 PDF일 수 있음)")
    return pages
