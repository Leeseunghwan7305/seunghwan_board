from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.eval import store

def test_post_eval_runs_and_persists(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_PATH", tmp_path / "r.json")
    client = TestClient(app)
    fake = {"dense": {"faithfulness": 0.5}, "hybrid": {"faithfulness": 0.9}}
    with patch("app.routers.eval.run_ab_eval", return_value=fake):
        r = client.post("/eval")
    assert r.status_code == 200
    assert r.json()["hybrid"]["faithfulness"] == 0.9
    # 저장 확인
    r2 = client.get("/eval/latest")
    assert r2.status_code == 200
    assert r2.json() == fake

def test_latest_404_when_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_PATH", tmp_path / "none.json")
    client = TestClient(app)
    assert client.get("/eval/latest").status_code == 404
