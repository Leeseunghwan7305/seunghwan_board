import json
from pathlib import Path

def test_qa_set_wellformed():
    data = json.loads(Path("app/eval/qa_set.json").read_text(encoding="utf-8"))
    assert isinstance(data, list) and len(data) >= 10
    for item in data:
        assert set(item.keys()) == {"question", "ground_truth"}
        assert item["question"].strip() and item["ground_truth"].strip()
