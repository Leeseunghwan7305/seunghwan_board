# PDF-RAG 백엔드 코어 — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF를 업로드하면 하이브리드 검색(Dense+Sparse→RRF→리랭크)으로 근거를 찾아 출처를 인용해 답하는 FastAPI 백엔드를 만든다.

**Architecture:** FastAPI 앱이 인제스트(파싱→청킹→임베딩→저장)와 질의(Dense/Sparse 검색→RRF 융합→리랭킹→인용 생성) 두 파이프라인을 제공한다. 저장소는 Postgres 하나에서 pgvector(dense)와 tsvector(sparse)를 동시에 쓴다. 각 단계는 한 책임만 갖는 모듈로 분리해 순수 로직은 유닛 테스트, 검색·저장은 통합 테스트한다.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, PostgreSQL 16 + pgvector, OpenAI (text-embedding-3-small, gpt-4.1-mini), sentence-transformers(bge-reranker-v2-m3), PyMuPDF, pytest, docker-compose.

**Spec:** `docs/superpowers/specs/2026-09-09-pdf-rag-service-design.md`

## Global Constraints

- Python 3.12; 의존성은 `backend/requirements.txt`에 고정.
- 임베딩 모델: `text-embedding-3-small`, 차원 **1536** (DB `vector(1536)`와 반드시 일치).
- 생성 모델: `gpt-4.1-mini`.
- 비밀값은 `.env`에서만 로드(`OPENAI_API_KEY`, `DATABASE_URL`). 코드에 하드코딩 금지.
- 검색 유사도 폴백 임계값: `SIMILARITY_THRESHOLD = 0.3` (리랭커 점수 기준). 미만이면 "문서에 근거가 없습니다".
- RRF 상수 `k = 60`.
- 외부 서비스(OpenAI, bge)를 호출하는 코드는 테스트에서 반드시 mock. DB는 실제 테스트용 Postgres(통합 테스트)로.
- 모든 작업 디렉토리 기준은 리포 루트. 백엔드 코드는 `backend/` 아래.

---

### Task 0: 프로젝트 스캐폴드 · docker-compose · 설정

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py` (빈 파일)
- Create: `backend/app/config.py`
- Create: `backend/.env.example`
- Create: `docker-compose.yml`
- Create: `backend/tests/__init__.py` (빈 파일)
- Create: `backend/tests/test_config.py`
- Create: `backend/pytest.ini`

**Interfaces:**
- Produces: `app.config.settings` — `OPENAI_API_KEY: str`, `DATABASE_URL: str`, `SIMILARITY_THRESHOLD: float`, `RRF_K: int`, `EMBED_MODEL: str`, `CHAT_MODEL: str`, `EMBED_DIM: int`.

- [ ] **Step 1: requirements.txt 작성**

```
fastapi
uvicorn[standard]
sqlalchemy
psycopg[binary]
pgvector
pydantic
pydantic-settings
python-dotenv
openai
pymupdf
langchain-text-splitters
sentence-transformers
pytest
httpx
```

- [ ] **Step 2: docker-compose.yml 작성 (pgvector 포함 Postgres)**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: rag
      POSTGRES_PASSWORD: rag
      POSTGRES_DB: ragdb
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 3: .env.example 작성**

```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+psycopg://rag:rag@localhost:5432/ragdb
```

- [ ] **Step 4: pytest.ini 작성**

```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 5: 실패 테스트 작성 (`backend/tests/test_config.py`)**

```python
from app.config import settings

def test_settings_defaults():
    assert settings.EMBED_MODEL == "text-embedding-3-small"
    assert settings.EMBED_DIM == 1536
    assert settings.CHAT_MODEL == "gpt-4.1-mini"
    assert settings.RRF_K == 60
    assert settings.SIMILARITY_THRESHOLD == 0.3
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: FAIL (`ModuleNotFoundError: app.config`)

- [ ] **Step 7: config.py 구현**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    OPENAI_API_KEY: str = ""
    DATABASE_URL: str = "postgresql+psycopg://rag:rag@localhost:5432/ragdb"
    EMBED_MODEL: str = "text-embedding-3-small"
    EMBED_DIM: int = 1536
    CHAT_MODEL: str = "gpt-4.1-mini"
    RRF_K: int = 60
    SIMILARITY_THRESHOLD: float = 0.3

settings = Settings()
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add backend docker-compose.yml
git commit -m "chore: scaffold backend, docker-compose, config"
```

---

### Task 1: DB 연결 · 스키마 (documents, chunks)

**Files:**
- Create: `backend/app/db/__init__.py` (빈 파일)
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/models.py`
- Create: `backend/app/db/init_db.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Consumes: `app.config.settings.DATABASE_URL`, `settings.EMBED_DIM`.
- Produces:
  - `app.db.session.engine`, `app.db.session.SessionLocal`, `app.db.session.Base`
  - `app.db.models.Document(id, filename, page_count, created_at)`
  - `app.db.models.Chunk(id, document_id, page, chunk_index, content, embedding)` — `content_tsv`는 DB에서 생성 컬럼으로 관리.
  - `app.db.init_db.init_db()` — 확장 설치, 테이블·인덱스 생성.

- [ ] **Step 1: session.py 작성**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()
```

- [ ] **Step 2: models.py 작성**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.db.session import Base
from app.config import settings

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    page_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    page = Column(Integer, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(settings.EMBED_DIM))
```

- [ ] **Step 3: init_db.py 작성 (확장·생성 컬럼·인덱스는 raw SQL로)**

```python
from sqlalchemy import text
from app.db.session import engine, Base
from app.db import models  # noqa: F401  (테이블 등록)

def init_db():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING GIN (content_tsv)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks "
            "USING hnsw (embedding vector_cosine_ops)"
        ))
```

- [ ] **Step 4: 실패 테스트 작성 (통합; 실제 테스트 DB 필요)**

```python
import pytest
from sqlalchemy import inspect
from app.db.session import engine
from app.db.init_db import init_db

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_tables_exist():
    names = inspect(engine).get_table_names()
    assert "documents" in names
    assert "chunks" in names
```

- [ ] **Step 5: 테스트 실패 확인 (DB 미기동 시 연결 에러, 모듈 부재 시 import 에러)**

Run: `docker compose up -d db && cd backend && python -m pytest tests/test_models.py -v`
Expected: 최초엔 FAIL (모듈 미구현) → 구현 후 PASS

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add backend/app/db backend/tests/test_models.py
git commit -m "feat: db session, models, init (pgvector + tsvector)"
```

---

### Task 2: PDF 파싱 (parse.py)

**Files:**
- Create: `backend/app/ingest/__init__.py` (빈 파일)
- Create: `backend/app/ingest/parse.py`
- Test: `backend/tests/test_parse.py`
- Create(fixture): `backend/tests/fixtures/sample.pdf` — 2페이지, 각 페이지에 알려진 문장이 든 간단 PDF (스텝1에서 생성)

**Interfaces:**
- Produces: `app.ingest.parse.parse_pdf(data: bytes) -> list[PageText]` where `PageText = {"page": int, "text": str}` (page는 1부터).

- [ ] **Step 1: 픽스처 PDF 생성 스크립트 실행 (재현용)**

```python
# backend/tests/fixtures/_make_sample.py  (한 번 실행해 sample.pdf 생성)
import fitz  # PyMuPDF
doc = fitz.open()
p1 = doc.new_page(); p1.insert_text((72, 72), "환불은 구매 후 30일 이내에 가능합니다.")
p2 = doc.new_page(); p2.insert_text((72, 72), "배송은 영업일 기준 2일 걸립니다.")
doc.save("backend/tests/fixtures/sample.pdf")
```

Run: `cd . && python backend/tests/fixtures/_make_sample.py`

- [ ] **Step 2: 실패 테스트 작성**

```python
from pathlib import Path
from app.ingest.parse import parse_pdf

def test_parse_returns_pages_with_text():
    data = Path("tests/fixtures/sample.pdf").read_bytes()
    pages = parse_pdf(data)
    assert len(pages) == 2
    assert pages[0]["page"] == 1
    assert "환불" in pages[0]["text"]
    assert "배송" in pages[1]["text"]
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_parse.py -v`
Expected: FAIL (`app.ingest.parse` 없음)

- [ ] **Step 4: parse.py 구현**

```python
import fitz

def parse_pdf(data: bytes) -> list[dict]:
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text().strip()
        if text:
            pages.append({"page": i, "text": text})
    if not pages:
        raise ValueError("추출 가능한 텍스트가 없습니다 (스캔 PDF일 수 있음)")
    return pages
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_parse.py -v`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add backend/app/ingest/parse.py backend/tests/test_parse.py backend/tests/fixtures
git commit -m "feat: pdf parsing with page numbers"
```

---

### Task 3: 청킹 (chunk.py) — 순수 로직, 유닛 테스트

**Files:**
- Create: `backend/app/ingest/chunk.py`
- Test: `backend/tests/test_chunk.py`

**Interfaces:**
- Consumes: `parse_pdf`의 결과 형태 `list[{"page","text"}]`.
- Produces: `app.ingest.chunk.chunk_pages(pages, chunk_size=500, overlap=80) -> list[ChunkDict]` where `ChunkDict = {"page": int, "chunk_index": int, "content": str}` (chunk_index는 문서 전체에서 0부터 증가).

- [ ] **Step 1: 실패 테스트 작성**

```python
from app.ingest.chunk import chunk_pages

def test_chunk_preserves_page_and_indexes():
    pages = [
        {"page": 1, "text": "가" * 1200},
        {"page": 2, "text": "나" * 300},
    ]
    chunks = chunk_pages(pages, chunk_size=500, overlap=0)
    # page1은 1200자 → 최소 3청크, page2는 1청크
    assert chunks[0]["page"] == 1
    assert chunks[0]["chunk_index"] == 0
    assert chunks[-1]["page"] == 2
    # chunk_index는 전역적으로 0,1,2,... 연속
    idxs = [c["chunk_index"] for c in chunks]
    assert idxs == list(range(len(chunks)))
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chunk.py -v`
Expected: FAIL

- [ ] **Step 3: chunk.py 구현**

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_pages(pages: list[dict], chunk_size: int = 500, overlap: int = 80) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    out: list[dict] = []
    idx = 0
    for p in pages:
        for piece in splitter.split_text(p["text"]):
            out.append({"page": p["page"], "chunk_index": idx, "content": piece})
            idx += 1
    return out
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chunk.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/ingest/chunk.py backend/tests/test_chunk.py
git commit -m "feat: page-aware chunking"
```

---

### Task 4: 임베딩 (embed.py) — OpenAI mock 테스트

**Files:**
- Create: `backend/app/ingest/embed.py`
- Test: `backend/tests/test_embed.py`

**Interfaces:**
- Consumes: `settings.OPENAI_API_KEY`, `settings.EMBED_MODEL`, `settings.EMBED_DIM`.
- Produces: `app.ingest.embed.embed_texts(texts: list[str]) -> list[list[float]]` (각 벡터 길이 = EMBED_DIM).

- [ ] **Step 1: 실패 테스트 작성 (OpenAI 클라이언트 mock)**

```python
from unittest.mock import patch, MagicMock
from app.ingest import embed

def test_embed_texts_returns_vectors():
    fake = MagicMock()
    fake.data = [MagicMock(embedding=[0.1] * 1536), MagicMock(embedding=[0.2] * 1536)]
    with patch.object(embed, "_client") as client:
        client.embeddings.create.return_value = fake
        vecs = embed.embed_texts(["a", "b"])
    assert len(vecs) == 2
    assert len(vecs[0]) == 1536
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_embed.py -v`
Expected: FAIL

- [ ] **Step 3: embed.py 구현**

```python
from openai import OpenAI
from app.config import settings

_client = OpenAI(api_key=settings.OPENAI_API_KEY)

def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = _client.embeddings.create(model=settings.EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_embed.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/ingest/embed.py backend/tests/test_embed.py
git commit -m "feat: openai embeddings wrapper"
```

---

### Task 5: 저장 (store.py) — 통합 테스트

**Files:**
- Create: `backend/app/ingest/store.py`
- Test: `backend/tests/test_store.py`

**Interfaces:**
- Consumes: `SessionLocal`, `Document`, `Chunk`, `chunk_pages` 출력, `embed_texts` 출력.
- Produces: `app.ingest.store.store_document(filename, page_count, chunks, embeddings, db) -> document_id: uuid.UUID`.

- [ ] **Step 1: 실패 테스트 작성**

```python
import pytest
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.db import models
from app.ingest.store import store_document

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_store_document_inserts_rows():
    db = SessionLocal()
    chunks = [{"page": 1, "chunk_index": 0, "content": "환불 30일"}]
    embeddings = [[0.05] * 1536]
    doc_id = store_document("s.pdf", 1, chunks, embeddings, db)
    got = db.query(models.Chunk).filter(models.Chunk.document_id == doc_id).all()
    assert len(got) == 1
    assert got[0].content == "환불 30일"
    db.close()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_store.py -v`
Expected: FAIL

- [ ] **Step 3: store.py 구현**

```python
import uuid
from sqlalchemy.orm import Session
from app.db import models

def store_document(filename, page_count, chunks, embeddings, db: Session) -> uuid.UUID:
    doc = models.Document(filename=filename, page_count=page_count)
    db.add(doc)
    db.flush()  # doc.id 확보
    for ch, emb in zip(chunks, embeddings):
        db.add(models.Chunk(
            document_id=doc.id, page=ch["page"],
            chunk_index=ch["chunk_index"], content=ch["content"], embedding=emb,
        ))
    db.commit()
    return doc.id
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_store.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/ingest/store.py backend/tests/test_store.py
git commit -m "feat: store document + chunks"
```

---

### Task 6: Dense 검색 (dense.py) — 통합 테스트

**Files:**
- Create: `backend/app/retrieve/__init__.py` (빈 파일)
- Create: `backend/app/retrieve/dense.py`
- Test: `backend/tests/test_dense.py`

**Interfaces:**
- Consumes: `embed_texts`(쿼리 임베딩), `Chunk.embedding`.
- Produces: `app.retrieve.dense.dense_search(query_embedding: list[float], db, k=10) -> list[Hit]` where `Hit = {"chunk_id": str, "page": int, "content": str, "rank": int}` (rank는 0부터, 코사인 거리 오름차순).

- [ ] **Step 1: 실패 테스트 작성 (두 청크 삽입 후, 한쪽에 가까운 쿼리 벡터로 검색)**

```python
import pytest
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.ingest.store import store_document
from app.retrieve.dense import dense_search

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_dense_orders_by_similarity():
    db = SessionLocal()
    chunks = [
        {"page": 1, "chunk_index": 0, "content": "환불"},
        {"page": 2, "chunk_index": 1, "content": "배송"},
    ]
    embeddings = [[1.0] + [0.0]*1535, [0.0, 1.0] + [0.0]*1534]
    store_document("d.pdf", 2, chunks, embeddings, db)
    hits = dense_search([1.0] + [0.0]*1535, db, k=2)
    assert hits[0]["content"] == "환불"   # 쿼리와 가장 가까운 것
    assert hits[0]["rank"] == 0
    db.close()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_dense.py -v`
Expected: FAIL

- [ ] **Step 3: dense.py 구현**

```python
from sqlalchemy import select
from app.db import models

def dense_search(query_embedding, db, k: int = 10) -> list[dict]:
    stmt = (
        select(models.Chunk)
        .order_by(models.Chunk.embedding.cosine_distance(query_embedding))
        .limit(k)
    )
    rows = db.execute(stmt).scalars().all()
    return [
        {"chunk_id": str(c.id), "page": c.page, "content": c.content, "rank": i}
        for i, c in enumerate(rows)
    ]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_dense.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/retrieve/dense.py backend/tests/test_dense.py
git commit -m "feat: dense (pgvector) retrieval"
```

---

### Task 7: Sparse 검색 (sparse.py) — 통합 테스트

**Files:**
- Create: `backend/app/retrieve/sparse.py`
- Test: `backend/tests/test_sparse.py`

**Interfaces:**
- Consumes: `chunks.content_tsv` (Task 1의 생성 컬럼).
- Produces: `app.retrieve.sparse.sparse_search(query: str, db, k=10) -> list[Hit]` (Hit 형태는 dense와 동일: `chunk_id, page, content, rank`).

- [ ] **Step 1: 실패 테스트 작성**

```python
import pytest
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.ingest.store import store_document
from app.retrieve.sparse import sparse_search

@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()

def test_sparse_keyword_match():
    db = SessionLocal()
    chunks = [
        {"page": 1, "chunk_index": 0, "content": "환불 정책 안내"},
        {"page": 2, "chunk_index": 1, "content": "배송 기간 안내"},
    ]
    store_document("sp.pdf", 2, chunks, [[0.0]*1536, [0.0]*1536], db)
    hits = sparse_search("환불", db, k=2)
    assert hits[0]["content"].startswith("환불")
    db.close()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_sparse.py -v`
Expected: FAIL

- [ ] **Step 3: sparse.py 구현**

```python
from sqlalchemy import text
from app.db.session import SessionLocal  # noqa

def sparse_search(query: str, db, k: int = 10) -> list[dict]:
    sql = text(
        "SELECT id, page, content, "
        "ts_rank(content_tsv, plainto_tsquery('simple', :q)) AS score "
        "FROM chunks "
        "WHERE content_tsv @@ plainto_tsquery('simple', :q) "
        "ORDER BY score DESC LIMIT :k"
    )
    rows = db.execute(sql, {"q": query, "k": k}).fetchall()
    return [
        {"chunk_id": str(r.id), "page": r.page, "content": r.content, "rank": i}
        for i, r in enumerate(rows)
    ]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_sparse.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/retrieve/sparse.py backend/tests/test_sparse.py
git commit -m "feat: sparse (tsvector/ts_rank) retrieval"
```

---

### Task 8: RRF 융합 (fusion.py) — 순수 로직, 유닛 테스트 ★ 핵심 차별점

**Files:**
- Create: `backend/app/retrieve/fusion.py`
- Test: `backend/tests/test_fusion.py`

**Interfaces:**
- Consumes: dense/sparse의 `list[Hit]` (각 Hit에 `chunk_id`, `rank` 존재).
- Produces: `app.retrieve.fusion.reciprocal_rank_fusion(result_lists: list[list[dict]], k=60) -> list[FusedHit]` where `FusedHit = {"chunk_id","page","content","score"}` (score 내림차순 정렬).

- [ ] **Step 1: 실패 테스트 작성**

```python
from app.retrieve.fusion import reciprocal_rank_fusion

def test_rrf_boosts_items_ranked_high_in_both():
    dense = [
        {"chunk_id": "A", "page": 1, "content": "a", "rank": 0},
        {"chunk_id": "B", "page": 1, "content": "b", "rank": 1},
    ]
    sparse = [
        {"chunk_id": "B", "page": 1, "content": "b", "rank": 0},
        {"chunk_id": "A", "page": 1, "content": "a", "rank": 1},
    ]
    fused = reciprocal_rank_fusion([dense, sparse], k=60)
    # A: 1/60 + 1/61, B: 1/61 + 1/60 → 동점. 둘 다 존재하고 score>0
    ids = {f["chunk_id"] for f in fused}
    assert ids == {"A", "B"}
    assert all(f["score"] > 0 for f in fused)
    # 정렬 확인: score 내림차순
    assert fused[0]["score"] >= fused[1]["score"]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_fusion.py -v`
Expected: FAIL

- [ ] **Step 3: fusion.py 구현**

```python
def reciprocal_rank_fusion(result_lists: list[list[dict]], k: int = 60) -> list[dict]:
    scores: dict[str, dict] = {}
    for results in result_lists:
        for hit in results:
            cid = hit["chunk_id"]
            if cid not in scores:
                scores[cid] = {"chunk_id": cid, "page": hit["page"],
                               "content": hit["content"], "score": 0.0}
            scores[cid]["score"] += 1.0 / (hit["rank"] + k)
    return sorted(scores.values(), key=lambda x: x["score"], reverse=True)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_fusion.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/retrieve/fusion.py backend/tests/test_fusion.py
git commit -m "feat: RRF fusion (dense+sparse)"
```

---

### Task 9: 리랭킹 (rerank.py) — mock + graceful fallback

**Files:**
- Create: `backend/app/retrieve/rerank.py`
- Test: `backend/tests/test_rerank.py`

**Interfaces:**
- Consumes: `list[FusedHit]`, 원 질문 `query`.
- Produces:
  - `app.retrieve.rerank.rerank(query: str, hits: list[dict], top_n=3) -> list[dict]` — 각 hit에 `score`를 리랭커 점수로 덮어써 정렬, 상위 top_n 반환. 모델 로드 실패 시 입력 순서 유지한 채 상위 top_n 반환(graceful degradation).

- [ ] **Step 1: 실패 테스트 작성 (CrossEncoder mock)**

```python
from unittest.mock import patch
from app.retrieve import rerank

def test_rerank_orders_by_model_score():
    hits = [
        {"chunk_id": "A", "page": 1, "content": "환불 안내", "score": 0.1},
        {"chunk_id": "B", "page": 2, "content": "배송 안내", "score": 0.9},
    ]
    with patch.object(rerank, "_get_model") as gm:
        gm.return_value.predict.return_value = [5.0, 1.0]  # A가 더 관련
        out = rerank.rerank("환불", hits, top_n=1)
    assert out[0]["chunk_id"] == "A"

def test_rerank_falls_back_when_model_unavailable():
    hits = [{"chunk_id": "A", "page": 1, "content": "x", "score": 0.5}]
    with patch.object(rerank, "_get_model", side_effect=RuntimeError("no model")):
        out = rerank.rerank("q", hits, top_n=3)
    assert out == hits[:3]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_rerank.py -v`
Expected: FAIL

- [ ] **Step 3: rerank.py 구현**

```python
_model = None

def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder
        _model = CrossEncoder("BAAI/bge-reranker-v2-m3")
    return _model

def rerank(query: str, hits: list[dict], top_n: int = 3) -> list[dict]:
    if not hits:
        return []
    try:
        model = _get_model()
        pairs = [(query, h["content"]) for h in hits]
        scores = model.predict(pairs)
        for h, s in zip(hits, scores):
            h["score"] = float(s)
        ranked = sorted(hits, key=lambda x: x["score"], reverse=True)
        return ranked[:top_n]
    except Exception:
        # 리랭커 로드/추론 실패 → RRF 순위 그대로 사용
        return hits[:top_n]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_rerank.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/retrieve/rerank.py backend/tests/test_rerank.py
git commit -m "feat: bge reranker with graceful fallback"
```

---

### Task 10: 인용 답변 생성 (answer.py) — OpenAI mock

**Files:**
- Create: `backend/app/generate/__init__.py` (빈 파일)
- Create: `backend/app/generate/answer.py`
- Test: `backend/tests/test_answer.py`

**Interfaces:**
- Consumes: `settings.CHAT_MODEL`, `settings.SIMILARITY_THRESHOLD`, 리랭크된 `list[hit]`(각 `page, content, score`).
- Produces: `app.generate.answer.generate_answer(query: str, hits: list[dict]) -> dict` returning `{"answer": str, "citations": [{"page","snippet","score"}]}`. hits가 비었거나 최고 score < 임계값이면 answer="문서에 근거가 없습니다.", citations=[].

- [ ] **Step 1: 실패 테스트 작성**

```python
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_answer.py -v`
Expected: FAIL

- [ ] **Step 3: answer.py 구현**

```python
from openai import OpenAI
from app.config import settings

_client = OpenAI(api_key=settings.OPENAI_API_KEY)

_SYSTEM = (
    "너는 업로드된 문서에 근거해서만 답하는 어시스턴트야. "
    "아래 [근거] 각 항목은 (p.페이지) 형식으로 출처가 있어. "
    "답변에 사용한 근거의 출처를 문장 끝에 [p.페이지]로 표기해. "
    "근거에 없는 내용은 지어내지 말고 '문서에 근거가 없습니다.'라고만 답해."
)

def generate_answer(query: str, hits: list[dict]) -> dict:
    if not hits or hits[0]["score"] < settings.SIMILARITY_THRESHOLD:
        return {"answer": "문서에 근거가 없습니다.", "citations": []}

    context = "\n".join(f"(p.{h['page']}) {h['content']}" for h in hits)
    resp = _client.chat.completions.create(
        model=settings.CHAT_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": f"{_SYSTEM}\n\n[근거]\n{context}"},
            {"role": "user", "content": query},
        ],
    )
    text = resp.choices[0].message.content.strip()
    citations = [
        {"page": h["page"], "snippet": h["content"][:120], "score": round(float(h["score"]), 4)}
        for h in hits
    ]
    return {"answer": text, "citations": citations}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_answer.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/generate/answer.py backend/tests/test_answer.py
git commit -m "feat: answer generation with citations + fallback"
```

---

### Task 11: 파이프라인 조립 + FastAPI 라우터 + 앱

**Files:**
- Create: `backend/app/retrieve/pipeline.py`
- Create: `backend/app/routers/__init__.py` (빈 파일)
- Create: `backend/app/routers/documents.py`
- Create: `backend/app/routers/chat.py`
- Create: `backend/app/main.py`
- Create: `backend/app/deps.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: 모든 이전 태스크(`parse_pdf, chunk_pages, embed_texts, store_document, dense_search, sparse_search, reciprocal_rank_fusion, rerank, generate_answer`).
- Produces:
  - `app.retrieve.pipeline.hybrid_answer(query: str, db) -> dict` — 질의 파이프라인 전체(embed→dense+sparse→RRF→rerank→generate).
  - HTTP: `POST /documents` (multipart file) → `{"document_id","chunks"}`; `POST /chat` (`{"query"}`) → `{"answer","citations"}`.

- [ ] **Step 1: deps.py (DB 세션 의존성)**

```python
from app.db.session import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: pipeline.py 구현**

```python
from app.ingest.embed import embed_texts
from app.retrieve.dense import dense_search
from app.retrieve.sparse import sparse_search
from app.retrieve.fusion import reciprocal_rank_fusion
from app.retrieve.rerank import rerank
from app.generate.answer import generate_answer

def hybrid_answer(query: str, db) -> dict:
    q_emb = embed_texts([query])[0]
    dense_hits = dense_search(q_emb, db, k=10)
    sparse_hits = sparse_search(query, db, k=10)
    fused = reciprocal_rank_fusion([dense_hits, sparse_hits], k=60)
    top = rerank(query, fused, top_n=3)
    return generate_answer(query, top)
```

- [ ] **Step 3: documents.py 라우터**

```python
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.ingest.parse import parse_pdf
from app.ingest.chunk import chunk_pages
from app.ingest.embed import embed_texts
from app.ingest.store import store_document

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    try:
        pages = parse_pdf(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    chunks = chunk_pages(pages)
    embeddings = embed_texts([c["content"] for c in chunks])
    doc_id = store_document(file.filename, len(pages), chunks, embeddings, db)
    return {"document_id": str(doc_id), "chunks": len(chunks)}
```

- [ ] **Step 4: chat.py 라우터**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.deps import get_db
from app.retrieve.pipeline import hybrid_answer

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    query: str

@router.post("")
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    return hybrid_answer(body.query, db)
```

- [ ] **Step 5: main.py**

```python
from fastapi import FastAPI
from app.db.init_db import init_db
from app.routers import documents, chat

app = FastAPI(title="PDF-RAG")

@app.on_event("startup")
def _startup():
    init_db()

app.include_router(documents.router)
app.include_router(chat.router)
```

- [ ] **Step 6: 실패 테스트 작성 (파이프라인 mock으로 API 계약 검증)**

```python
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
```

- [ ] **Step 7: 테스트 실패 확인 후 통과 확인**

Run: `cd backend && python -m pytest tests/test_api.py -v`
Expected: 구현 후 PASS

- [ ] **Step 8: 수동 스모크 (선택)**

```bash
cd backend && uvicorn app.main:app --reload
# 다른 터미널:
curl -F "file=@tests/fixtures/sample.pdf" http://localhost:8000/documents
curl -X POST http://localhost:8000/chat -H "content-type: application/json" -d '{"query":"환불 언제 가능해?"}'
```

- [ ] **Step 9: 커밋**

```bash
git add backend/app/retrieve/pipeline.py backend/app/routers backend/app/main.py backend/app/deps.py backend/tests/test_api.py
git commit -m "feat: assemble hybrid RAG pipeline + FastAPI endpoints"
```

---

## 후속 계획 (별도 문서로 작성 예정)

- **Plan 2 — RAGAS 평가**: `eval/qa_set.json` golden set, `eval/ragas_runner.py`(Dense-only vs 하이브리드+리랭크 A/B), `POST /eval`·`GET /eval/latest`.
- **Plan 3 — Next.js 프론트**: 업로드 화면, 채팅+출처 카드, 평가 대시보드(비교 차트).

---

## Self-Review (스펙 대비 점검)

- 스펙 §4 인제스트 → Task 2~5 커버 ✓
- 스펙 §4 질의(Dense/Sparse/RRF/rerank/폴백) → Task 6~10 커버 ✓
- 스펙 §5 데이터 모델(documents/chunks, embedding+tsvector) → Task 1 커버 ✓
- 스펙 §6 출처 인용 → Task 10 커버 ✓
- 스펙 §10 에러/폴백(잘못된 PDF 400, 근거 없음, 리랭커 실패) → Task 2/9/10 커버 ✓
- 스펙 §7 RAGAS, §8 프론트 → Plan 2/3로 분리(의도된 범위 결정) ✓
- 타입 일관성: Hit 구조(`chunk_id,page,content,rank`)가 dense/sparse/fusion에서 일치, FusedHit(`score`)→rerank→answer의 `page/content/score` 일치 ✓
- 플레이스홀더 스캔: 없음 ✓
