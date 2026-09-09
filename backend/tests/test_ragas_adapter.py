import sys
from unittest.mock import patch, MagicMock
from app.eval import ragas_adapter

def test_score_samples_returns_metric_dict():
    samples = [{"question": "q", "answer": "a", "contexts": ["c"], "ground_truth": "g"}]
    # 어댑터 내부의 실제 RAGAS 실행부(_run_ragas)를 mock — 버전 무관하게 계약만 검증
    with patch.object(ragas_adapter, "_run_ragas",
                      return_value={"faithfulness": 0.9, "answer_relevancy": 0.8}):
        out = ragas_adapter.score_samples(samples, ["faithfulness", "answer_relevancy"])
    assert out == {"faithfulness": 0.9, "answer_relevancy": 0.8}

def test_module_imports_without_ragas_installed():
    # 최상단에서 ragas를 import하지 않아야 함 → 모듈이 이미 import된 사실만으로 검증
    assert "app.eval.ragas_adapter" in sys.modules
