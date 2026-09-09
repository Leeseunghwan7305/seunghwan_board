import json
from pathlib import Path
from app.retrieve.pipeline import answer_for_eval
from app.eval.ragas_adapter import score_samples

METRIC_NAMES = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
_QA_PATH = Path(__file__).parent / "qa_set.json"


def _load_qa_set() -> list[dict]:
    return json.loads(_QA_PATH.read_text(encoding="utf-8"))


def build_samples(qa_set: list[dict], db, mode: str) -> list[dict]:
    rows = []
    for item in qa_set:
        out = answer_for_eval(item["question"], db, mode)
        rows.append({
            "question": item["question"],
            "answer": out["answer"],
            "contexts": out["contexts"],
            "ground_truth": item["ground_truth"],
        })
    return rows


def run_ab_eval(db) -> dict:
    qa_set = _load_qa_set()
    results = {}
    for mode in ("dense", "hybrid"):
        samples = build_samples(qa_set, db, mode)
        results[mode] = score_samples(samples, METRIC_NAMES)
    return results
