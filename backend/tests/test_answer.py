from unittest.mock import patch, MagicMock
from app.generate import answer


def test_fallback_when_below_threshold():
    hits = [{"page": 1, "content": "x", "score": 0.01}]  # 임계값(0.3) 미만
    out = answer.generate_answer("환불?", hits)
    assert out["answer"] == "문서에 근거가 없습니다."
    assert out["citations"] == []


def test_generates_answer_with_citations():
    hits = [{"page": 3, "content": "환불은 30일 이내 가능", "score": 5.0}]
    fake = MagicMock()
    fake.choices = [MagicMock(message=MagicMock(content="환불은 30일 이내 가능합니다 [p.3]."))]
    with patch.object(answer, "_client") as client:
        client.chat.completions.create.return_value = fake
        out = answer.generate_answer("환불 언제?", hits)
    assert "[p.3]" in out["answer"]
    assert out["citations"][0]["page"] == 3
