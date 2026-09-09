from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import settings
from app.deps import get_openai_key
from app.main import app


def test_get_openai_key_prefers_header_over_env():
    key = get_openai_key(x_openai_key="sk-header-key")
    assert key == "sk-header-key"


def test_get_openai_key_falls_back_to_env_when_no_header():
    key = get_openai_key(x_openai_key=None)
    assert key == settings.OPENAI_API_KEY


def test_get_openai_key_raises_400_when_both_missing(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    with pytest.raises(HTTPException) as exc_info:
        get_openai_key(x_openai_key=None)
    assert exc_info.value.status_code == 400


def test_chat_endpoint_honors_byok_header():
    client = TestClient(app)
    fake = {"answer": "환불은 30일 [p.3].", "citations": [{"page": 3, "snippet": "환불", "score": 0.9}]}
    with patch("app.routers.chat.hybrid_answer", return_value=fake) as mock_answer:
        r = client.post(
            "/chat",
            json={"query": "BYOK 헤더 테스트?"},
            headers={"X-OpenAI-Key": "sk-user-123"},
        )
    assert r.status_code == 200
    assert r.json() == fake
    # the header-supplied key must be the one threaded into hybrid_answer, not the env fallback
    args, kwargs = mock_answer.call_args
    call_values = list(args) + list(kwargs.values())
    assert "sk-user-123" in call_values
