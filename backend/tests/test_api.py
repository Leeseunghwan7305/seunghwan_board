from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

def test_chat_endpoint_contract():
    client = TestClient(app)
    fake = {"answer": "환불은 30일 [p.3].", "citations": [{"page": 3, "snippet": "환불", "score": 0.9}]}
    with patch("app.routers.chat.hybrid_answer", return_value=fake):
        r = client.post("/chat", json={"query": "환불?"})
    assert r.status_code == 200
    assert r.json()["citations"][0]["page"] == 3
