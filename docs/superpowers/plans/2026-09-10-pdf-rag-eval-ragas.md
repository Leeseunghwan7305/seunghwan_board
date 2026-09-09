# PDF-RAG RAGAS 평가 — Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동일 질문 세트를 "Dense만" vs "하이브리드+리랭크" 두 검색 모드로 돌려 RAGAS 4지표를 산출하고 A/B로 비교하는 평가 하네스를 만든다.

**Architecture:** 기존 검색 파이프라인을 리팩터해 검색 모드(dense|hybrid)를 파라미터로 받게 하고, 평가용으로 "답변 + 사용된 컨텍스트"를 함께 반환하는 함수를 노출한다. RAGAS 호출은 버전 churn을 흡수하는 얇은 어댑터 한 곳에 격리한다. 러너가 golden QA 세트를 두 모드로 실행해 지표를 모으고, 결과를 파일에 저장해 엔드포인트로 노출한다.

**Tech Stack:** Python 3.12, 기존 백엔드(FastAPI/pgvector/OpenAI), ragas==0.4.3, datasets, pytest. 테스트는 RAGAS와 파이프라인을 mock (결정적, 키 불필요).

**Spec:** `docs/superpowers/specs/2026-09-09-pdf-rag-service-design.md` (§7 RAGAS 평가)

## Global Constraints

- 이 플랜은 Plan 1(백엔드 코어)이 이미 병합된 `main` 위에서 진행. 기존 모듈 시그니처를 그대로 소비한다:
  - `app.retrieve.dense.dense_search(q_emb, db, k)`, `app.retrieve.sparse.sparse_search(q, db, k)`,
    `app.retrieve.fusion.reciprocal_rank_fusion(lists, k=60)`, `app.retrieve.rerank.rerank(q, hits, top_n)`,
    `app.generate.answer.generate_answer(q, hits)`, `app.ingest.embed.embed_texts(texts)`.
- 검색 모드는 정확히 두 값: `"dense"` | `"hybrid"`.
  - `"dense"`: dense_search top-k만 → 상위 top_n(리랭크 없음).
  - `"hybrid"`: dense + sparse → RRF → rerank top_n (Plan 1의 hybrid_answer와 동일 검색부).
- RAGAS 지표 이름 4개(고정): `faithfulness`, `answer_relevancy`, `context_precision`, `context_recall`.
- ragas는 무겁고 실제 실행에 OpenAI 키가 필요하므로 `backend/requirements-eval.txt`에 분리(코어 requirements와 별도). 테스트는 RAGAS를 mock하므로 ragas 미설치 상태에서도 통과해야 한다 → RAGAS import는 어댑터 함수 **내부**에서 지연 import.
- 평가 결과 저장 경로: `backend/app/eval/results_latest.json` (git-ignored). 저장 함수가 디렉토리 존재를 보장.
- venv: `backend/.venv` (python3.12). 테스트: `cd backend && ./.venv/bin/python -m pytest -v`. conftest.py가 더미 OPENAI_API_KEY 세팅.
- 모든 경로는 리포 루트 기준. 백엔드는 `backend/`.

---

### Task 0: 평가 스캐폴드 · golden QA 세트

**Files:**
- Create: `backend/requirements-eval.txt`
- Create: `backend/app/eval/__init__.py` (빈 파일)
- Create: `backend/app/eval/qa_set.json`
- Test: `backend/tests/test_qa_set.py`

**Interfaces:**
- Produces: `backend/app/eval/qa_set.json` — JSON 배열, 각 항목 `{"question": str, "ground_truth": str}` (10개 이상). 영문 샘플 PDF(Plan 1의 `tests/fixtures/sample.pdf`: "Refunds…30 days", "Shipping…2 days")와 정합.

- [ ] **Step 1: requirements-eval.txt 작성**

```
ragas==0.4.3
datasets
```

- [ ] **Step 2: qa_set.json 작성 (샘플 PDF 내용에 맞춘 10문항 — 정답이 문서에 실재해야 함)**

```json
[
  {"question": "How many days do I have to get a refund?", "ground_truth": "Refunds are available within 30 days of purchase."},
  {"question": "What is the refund window?", "ground_truth": "Refunds are available within 30 days of purchase."},
  {"question": "Can I return an item after a month?", "ground_truth": "Refunds are available within 30 days of purchase."},
  {"question": "How long does shipping take?", "ground_truth": "Shipping takes 2 business days."},
  {"question": "When will my order arrive?", "ground_truth": "Shipping takes 2 business days."},
  {"question": "Is delivery fast?", "ground_truth": "Shipping takes 2 business days."},
  {"question": "What is the shipping duration in business days?", "ground_truth": "Shipping takes 2 business days."},
  {"question": "Tell me about the return policy.", "ground_truth": "Refunds are available within 30 days of purchase."},
  {"question": "How soon are packages delivered?", "ground_truth": "Shipping takes 2 business days."},
  {"question": "What is the deadline for a refund?", "ground_truth": "Refunds are available within 30 days of purchase."}
]
```

- [ ] **Step 3: 실패 테스트 작성 (`test_qa_set.py`)**

```python
import json
from pathlib import Path

def test_qa_set_wellformed():
    data = json.loads(Path("app/eval/qa_set.json").read_text(encoding="utf-8"))
    assert isinstance(data, list) and len(data) >= 10
    for item in data:
        assert set(item.keys()) == {"question", "ground_truth"}
        assert item["question"].strip() and item["ground_truth"].strip()
```

- [ ] **Step 4: 테스트 실패→통과 확인**

Run: `cd backend && ./.venv/bin/python -m pytest tests/test_qa_set.py -v`
Expected: 파일 작성 후 PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/requirements-eval.txt backend/app/eval/__init__.py backend/app/eval/qa_set.json backend/tests/test_qa_set.py
git commit -m "feat(eval): scaffold + golden QA set"
```

(모든 커밋 메시지에 트레일러 2줄 추가:
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013Z9AF9oVehUqCiKzWJxm2N)

---

### Task 1: 검색 모드 리팩터 + 평가용 답변 함수

**Files:**
- Modify: `backend/app/retrieve/pipeline.py`
- Test: `backend/tests/test_pipeline_modes.py`

**Interfaces:**
- Consumes: dense_search, sparse_search, reciprocal_rank_fusion, rerank, generate_answer, embed_texts (기존).
- Produces (in `app.retrieve.pipeline`):
  - `retrieve_hits(query: str, db, mode: str, top_n: int = 3) -> list[dict]` — mode="dense"면 dense_search(k=10)→상위 top_n; mode="hybrid"면 dense+sparse→RRF→rerank top_n. 다른 mode는 ValueError.
  - `answer_for_eval(query: str, db, mode: str) -> dict` returning `{"answer": str, "contexts": list[str]}` (contexts = 사용된 hit들의 content 리스트).
  - 기존 `hybrid_answer(query, db)`는 유지하되 내부적으로 mode="hybrid" 경로를 재사용(동작 불변).

- [ ] **Step 1: 실패 테스트 작성 (내부 함수 mock으로 모드 분기·contexts 반환 검증)**

```python
from unittest.mock import patch
from app.retrieve import pipeline

def test_retrieve_hits_dense_skips_sparse_and_rerank():
    dense = [{"chunk_id": "A", "page": 1, "content": "Refunds 30 days", "rank": 0},
             {"chunk_id": "B", "page": 2, "content": "Shipping 2 days", "rank": 1}]
    with patch.object(pipeline, "embed_texts", return_value=[[0.0]*1536]), \
         patch.object(pipeline, "dense_search", return_value=dense) as ds, \
         patch.object(pipeline, "sparse_search") as ss, \
         patch.object(pipeline, "rerank") as rr:
        hits = pipeline.retrieve_hits("q", db=None, mode="dense", top_n=1)
    ds.assert_called_once()
    ss.assert_not_called()
    rr.assert_not_called()
    assert hits == dense[:1]

def test_retrieve_hits_hybrid_uses_all_stages():
    with patch.object(pipeline, "embed_texts", return_value=[[0.0]*1536]), \
         patch.object(pipeline, "dense_search", return_value=[]), \
         patch.object(pipeline, "sparse_search", return_value=[]), \
         patch.object(pipeline, "reciprocal_rank_fusion", return_value=[]) as rrf, \
         patch.object(pipeline, "rerank", return_value=[{"chunk_id":"A","page":1,"content":"x","score":1.0}]) as rr:
        hits = pipeline.retrieve_hits("q", db=None, mode="hybrid", top_n=3)
    rrf.assert_called_once()
    rr.assert_called_once()
    assert hits[0]["content"] == "x"

def test_answer_for_eval_returns_answer_and_contexts():
    hits = [{"chunk_id":"A","page":1,"content":"Refunds 30 days","score":5.0}]
    with patch.object(pipeline, "retrieve_hits", return_value=hits), \
         patch.object(pipeline, "generate_answer", return_value={"answer":"30 days [p.1].","citations":[]}):
        out = pipeline.answer_for_eval("q", db=None, mode="hybrid")
    assert out["answer"] == "30 days [p.1]."
    assert out["contexts"] == ["Refunds 30 days"]

def test_retrieve_hits_bad_mode():
    import pytest
    with pytest.raises(ValueError):
        pipeline.retrieve_hits("q", db=None, mode="nope")
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && ./.venv/bin/python -m pytest tests/test_pipeline_modes.py -v`
Expected: FAIL (함수 미존재)

- [ ] **Step 3: pipeline.py 수정 (기존 import 유지, 함수 추가/리팩터)**

```python
from app.ingest.embed import embed_texts
from app.retrieve.dense import dense_search
from app.retrieve.sparse import sparse_search
from app.retrieve.fusion import reciprocal_rank_fusion
from app.retrieve.rerank import rerank
from app.generate.answer import generate_answer


def retrieve_hits(query: str, db, mode: str, top_n: int = 3) -> list[dict]:
    q_emb = embed_texts([query])[0]
    if mode == "dense":
        return dense_search(q_emb, db, k=10)[:top_n]
    if mode == "hybrid":
        dense_hits = dense_search(q_emb, db, k=10)
        sparse_hits = sparse_search(query, db, k=10)
        fused = reciprocal_rank_fusion([dense_hits, sparse_hits], k=60)
        return rerank(query, fused, top_n=top_n)
    raise ValueError(f"unknown mode: {mode}")


def answer_for_eval(query: str, db, mode: str) -> dict:
    hits = retrieve_hits(query, db, mode)
    result = generate_answer(query, hits)
    return {"answer": result["answer"], "contexts": [h["content"] for h in hits]}


def hybrid_answer(query: str, db) -> dict:
    hits = retrieve_hits(query, db, "hybrid")
    return generate_answer(query, hits)
```

- [ ] **Step 4: 테스트 통과 + 전체 스위트 회귀 확인**

Run: `cd backend && ./.venv/bin/python -m pytest -v`
Expected: 신규 4개 PASS, 기존 test_api 등 회귀 없음(전체 GREEN). hybrid_answer 시그니처/동작 불변.

- [ ] **Step 5: 커밋**

```bash
git add backend/app/retrieve/pipeline.py backend/tests/test_pipeline_modes.py
git commit -m "feat(eval): retrieval modes (dense|hybrid) + answer_for_eval"
```

---

### Task 2: RAGAS 어댑터 (버전 churn 격리)

**Files:**
- Create: `backend/app/eval/ragas_adapter.py`
- Test: `backend/tests/test_ragas_adapter.py`

**Interfaces:**
- Produces: `app.eval.ragas_adapter.score_samples(samples: list[dict], metric_names: list[str]) -> dict[str, float]`
  - `samples` 각 항목: `{"question": str, "answer": str, "contexts": list[str], "ground_truth": str}`.
  - 반환: `{metric_name: float}` (metric_names의 각 지표 평균 점수).
  - RAGAS import·호출은 이 함수 **내부에서 지연 import** (모듈 최상단 import 금지 → ragas 미설치 시에도 다른 코드 import 가능).

**구현 주의 (implementer는 설치된 ragas==0.4.3의 실제 API를 확인해 이 한 함수만 바인딩):**
- ragas 0.4.x는 `EvaluationDataset`/`SingleTurnSample` 계열 API를 쓴다. 정확한 심볼·시그니처는 설치 후 `./.venv/bin/python -c "import ragas, inspect; ..."`로 확인할 것.
- 표준 흐름: 샘플들을 RAGAS 데이터셋으로 변환 → `evaluate(dataset, metrics=[...])` → 결과에서 지표별 평균 스칼라 추출 → `{name: float}`.
- 지표 객체는 이름으로 매핑: `faithfulness, answer_relevancy, context_precision, context_recall` (설치된 버전의 `ragas.metrics`에서 import).
- 이 함수의 **계약(입출력 형태)**은 위 Interfaces가 확정. 내부 RAGAS 배선만 버전에 맞춰 채운다.

- [ ] **Step 1: 실패 테스트 작성 (RAGAS를 통째로 mock — 어댑터가 계약대로 dict를 돌려주는지, 지연 import인지 검증)**

```python
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && ./.venv/bin/python -m pytest tests/test_ragas_adapter.py -v`
Expected: FAIL

- [ ] **Step 3: ragas_adapter.py 구현 (공개 계약 + 지연 import된 `_run_ragas`)**

```python
# NOTE: ragas는 최상단에서 import하지 않는다(무겁고, 미설치 환경에서도 다른 코드가 import되어야 함).
# 실제 RAGAS 배선은 _run_ragas 내부에만 존재하며, 설치된 ragas==0.4.3의 API로 채운다.

def score_samples(samples: list[dict], metric_names: list[str]) -> dict:
    if not samples:
        return {name: 0.0 for name in metric_names}
    return _run_ragas(samples, metric_names)


def _run_ragas(samples: list[dict], metric_names: list[str]) -> dict:
    # 지연 import (테스트는 이 함수를 patch하므로 ragas 없이도 통과)
    from ragas import evaluate, EvaluationDataset
    from ragas import metrics as M

    metric_map = {
        "faithfulness": M.faithfulness,
        "answer_relevancy": M.answer_relevancy,
        "context_precision": M.context_precision,
        "context_recall": M.context_recall,
    }
    metrics = [metric_map[n] for n in metric_names]

    dataset = EvaluationDataset.from_list([
        {
            "user_input": s["question"],
            "response": s["answer"],
            "retrieved_contexts": s["contexts"],
            "reference": s["ground_truth"],
        }
        for s in samples
    ])
    result = evaluate(dataset=dataset, metrics=metrics)
    # result를 지표별 평균 스칼라로 환원
    df = result.to_pandas()
    return {n: float(df[n].mean()) for n in metric_names}
```

> implementer: 위 `_run_ragas`는 ragas 0.4.x의 통상 형태다. 설치 후 심볼(`EvaluationDataset`, `evaluate`, `ragas.metrics.*`, 결과의 `to_pandas()`/컬럼명)이 실제와 다르면 **이 함수 안에서만** 실제 API에 맞게 수정하라. 공개 계약(`score_samples`의 입출력)과 테스트는 바꾸지 말 것. 이 함수는 실 키가 있어야 실행되므로 자동 테스트로는 커버되지 않는다(수동 검증은 Task 4 이후).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && ./.venv/bin/python -m pytest tests/test_ragas_adapter.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/app/eval/ragas_adapter.py backend/tests/test_ragas_adapter.py
git commit -m "feat(eval): ragas adapter (lazy import, version-isolated)"
```

---

### Task 3: A/B 러너

**Files:**
- Create: `backend/app/eval/runner.py`
- Test: `backend/tests/test_runner.py`

**Interfaces:**
- Consumes: `answer_for_eval`, `score_samples`, qa_set.json.
- Produces:
  - `app.eval.runner.build_samples(qa_set: list[dict], db, mode: str) -> list[dict]` — 각 질문을 `answer_for_eval(q, db, mode)`로 실행해 `{"question","answer","contexts","ground_truth"}` 리스트 생성.
  - `app.eval.runner.run_ab_eval(db) -> dict` — qa_set.json 로드 후 mode "dense"/"hybrid" 각각 build_samples → score_samples(4지표) → `{"dense": {...4}, "hybrid": {...4}}` 반환.
  - `METRIC_NAMES = ["faithfulness","answer_relevancy","context_precision","context_recall"]`.

- [ ] **Step 1: 실패 테스트 작성 (answer_for_eval·score_samples mock)**

```python
from unittest.mock import patch
from app.eval import runner

def test_build_samples_shapes_rows():
    qa = [{"question": "q1", "ground_truth": "g1"}]
    with patch.object(runner, "answer_for_eval",
                      return_value={"answer": "a1", "contexts": ["c1"]}) as af:
        rows = runner.build_samples(qa, db=None, mode="dense")
    af.assert_called_once_with("q1", None, "dense")
    assert rows == [{"question": "q1", "answer": "a1", "contexts": ["c1"], "ground_truth": "g1"}]

def test_run_ab_eval_scores_both_modes():
    with patch.object(runner, "_load_qa_set", return_value=[{"question":"q","ground_truth":"g"}]), \
         patch.object(runner, "answer_for_eval", return_value={"answer":"a","contexts":["c"]}), \
         patch.object(runner, "score_samples", return_value={"faithfulness":0.9,"answer_relevancy":0.8,"context_precision":0.7,"context_recall":0.6}):
        out = runner.run_ab_eval(db=None)
    assert set(out.keys()) == {"dense", "hybrid"}
    assert out["hybrid"]["faithfulness"] == 0.9
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && ./.venv/bin/python -m pytest tests/test_runner.py -v`
Expected: FAIL

- [ ] **Step 3: runner.py 구현**

```python
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && ./.venv/bin/python -m pytest tests/test_runner.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/app/eval/runner.py backend/tests/test_runner.py
git commit -m "feat(eval): A/B runner (dense vs hybrid over golden set)"
```

---

### Task 4: 저장 + 엔드포인트 (/eval, /eval/latest)

**Files:**
- Create: `backend/app/eval/store.py`
- Create: `backend/app/routers/eval.py`
- Modify: `backend/app/main.py` (eval 라우터 include)
- Test: `backend/tests/test_eval_api.py`

**Interfaces:**
- Produces:
  - `app.eval.store.save_results(results: dict) -> None` (results_latest.json에 저장, 디렉토리 보장), `app.eval.store.load_results() -> dict | None`.
  - HTTP: `POST /eval` → run_ab_eval(db) 실행·저장·반환 `{"dense":{...}, "hybrid":{...}}`; `GET /eval/latest` → 저장된 결과 또는 404.

- [ ] **Step 1: store.py 구현**

```python
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
```

- [ ] **Step 2: eval.py 라우터 구현**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.eval.runner import run_ab_eval
from app.eval.store import save_results, load_results

router = APIRouter(prefix="/eval", tags=["eval"])

@router.post("")
def run_eval(db: Session = Depends(get_db)):
    results = run_ab_eval(db)
    save_results(results)
    return results

@router.get("/latest")
def latest():
    results = load_results()
    if results is None:
        raise HTTPException(status_code=404, detail="no eval results yet")
    return results
```

- [ ] **Step 3: main.py에 라우터 추가**

`backend/app/main.py`의 라우터 import/include에 eval 추가:
```python
from app.routers import documents, chat, eval as eval_router
...
app.include_router(eval_router.router)
```
(기존 documents/chat include는 유지. 별칭 `eval_router`로 파이썬 builtin `eval` 가림 방지.)

- [ ] **Step 4: 실패 테스트 작성 (run_ab_eval mock, /latest 저장·조회 계약)**

```python
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
```

> 주의: `/eval` POST와 `/eval/latest` GET이 같은 `store._PATH`를 공유하도록 monkeypatch가 store 모듈의 `_PATH`를 바꾼다. eval.py는 `from app.eval.store import save_results, load_results`로 함수를 참조하므로 함수 내부에서 `_PATH`를 읽어야 monkeypatch가 반영된다(위 store.py 구현은 함수 내부에서 `_PATH` 참조 → OK).

- [ ] **Step 5: 테스트 실패→통과 + 전체 스위트 회귀 확인**

Run: `cd backend && ./.venv/bin/python -m pytest -v`
Expected: 신규 2개 PASS, 전체 GREEN.

- [ ] **Step 6: results_latest.json을 .gitignore에 추가**

리포 루트 `.gitignore`에 한 줄 추가: `backend/app/eval/results_latest.json`

- [ ] **Step 7: 커밋**

```bash
git add backend/app/eval/store.py backend/app/routers/eval.py backend/app/main.py backend/tests/test_eval_api.py .gitignore
git commit -m "feat(eval): /eval + /eval/latest endpoints with persistence"
```

---

### Task 5: 실 RAGAS 수동 검증 문서 (README 스니펫)

**Files:**
- Modify: `backend/README.md` (없으면 Create)

**Interfaces:** 없음(문서).

- [ ] **Step 1: RAGAS 실행 절차를 README에 추가**

```markdown
## RAGAS 평가 (실제 수치 생성)

자동 테스트는 RAGAS를 mock한다. 실제 A/B 점수를 뽑으려면 OpenAI 키와 인제스트된 문서가 필요하다.

1. `pip install -r backend/requirements-eval.txt`  (ragas==0.4.3)
2. `backend/.env`에 실제 `OPENAI_API_KEY` 설정
3. 샘플 PDF 인제스트: `curl -F "file=@backend/tests/fixtures/sample.pdf" http://localhost:8000/documents`
4. 평가 실행: `curl -X POST http://localhost:8000/eval`  → dense vs hybrid 4지표 반환
5. 최근 결과 조회: `curl http://localhost:8000/eval/latest`

지표: faithfulness, answer_relevancy, context_precision, context_recall.
"hybrid"가 "dense"보다 context_precision/recall이 높으면 하이브리드+리랭크의 검색 품질 개선이 수치로 증명된 것.
```

- [ ] **Step 2: 커밋**

```bash
git add backend/README.md
git commit -m "docs(eval): how to run real RAGAS A/B evaluation"
```

---

## Self-Review (스펙 §7 대비 점검)

- §7 golden set 10~15개 → Task 0 (10문항) ✓
- §7 4지표 측정 → Task 2 어댑터 + Task 3 러너 ✓
- §7 A/B (Dense만 vs 하이브리드+리랭크) → Task 1 모드 + Task 3 run_ab_eval ✓
- §7 결과 저장·대시보드용 노출 → Task 4 저장 + 엔드포인트 ✓ (대시보드 UI는 Plan 3)
- 타입 일관성: sample dict 키(question/answer/contexts/ground_truth)가 runner→adapter에서 일치; results 형태 `{mode: {metric: float}}`가 runner→store→router에서 일치 ✓
- 테스트 결정성: RAGAS·파이프라인 전부 mock, ragas 미설치·키 없이 전체 스위트 통과 ✓
- 플레이스홀더 스캔: `_run_ragas`의 실제 RAGAS 배선은 "설치 버전에 맞춰 확인" 지시가 있으나, 공개 계약과 테스트는 완전 명시 — 외부 라이브러리 churn을 한 함수로 격리한 의도적 경계 ✓
```
