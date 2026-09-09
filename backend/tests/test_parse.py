from pathlib import Path
from app.ingest.parse import parse_pdf


def test_parse_returns_pages_with_text():
    data = Path("tests/fixtures/sample.pdf").read_bytes()
    pages = parse_pdf(data)
    assert len(pages) == 2
    assert pages[0]["page"] == 1
    assert "Refunds" in pages[0]["text"]
    assert "Shipping" in pages[1]["text"]
