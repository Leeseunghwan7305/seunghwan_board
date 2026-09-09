import json
from pathlib import Path

_PATH = Path(__file__).parent / "results_latest.json"

def save_results(results: dict) -> None:
    _PATH.parent.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

def load_results() -> dict | None:
    if not _PATH.exists():
        return None
    return json.loads(_PATH.read_text(encoding="utf-8"))
