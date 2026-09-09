# PDF-QA RAG 서비스 — 설계 문서

- 작성일: 2026-09-09
- 목적: **취업 포트폴리오**용 RAG 서비스
- 대상 도메인: 사용자가 업로드한 **PDF 문서**(이력서/논문/계약서 등)에 대한 질의응답
- 한 줄 정의: PDF를 업로드하면 그 문서에 근거해 답하고, **출처를 인용**하며, 검색 품질을 **RAGAS로 수치 검증**하는 하이브리드 RAG 서비스.

---

## 1. 목표와 성공 기준

### 목표
1. "OpenAI API만 호출" 수준을 명확히 넘는, 검색 원리를 직접 조립한 RAG를 보여준다.
2. 면접에서 말할 수 있는 차별화 스토리 4개를 코드로 증명한다:
   - 출처 인용(hallucination 방어)
   - 하이브리드 검색(Dense+Sparse) + RRF 융합 + 리랭킹
   - RAGAS 기반 검색 품질 평가 및 A/B 비교
   - 데모 가능한 프론트엔드
3. 참조 프로젝트(`kimseonguk197/ai_agent_chatbot`)의 약점을 정면으로 개선한다:
   - 그 프로젝트는 BM25용으로 전체 문서를 매 요청마다 메모리에 로드했다 → 본 프로젝트는 **Postgres 인덱스(tsvector)** 로 처리.
   - 그 프로젝트는 하이브리드/RRF를 구현만 하고 주석 처리했다 → 본 프로젝트는 **실제로 활성화**하고 효과를 수치로 비교.

### 성공 기준 (Definition of Done)
- PDF 업로드 → 청킹 → 임베딩 → 저장이 동작한다.
- 질문 시 Dense+Sparse 검색 결과가 RRF로 융합되고 리랭커로 재정렬되어 top-3가 선택된다.
- 답변에 `[p.N]` 형태의 출처가 붙고, 응답 JSON에 citations 배열이 포함된다.
- 근거가 임계값 미만이면 "문서에 근거가 없습니다"로 폴백한다(억지 답변 금지).
- RAGAS 4지표가 측정되고, "Dense만" vs "하이브리드+리랭크" 점수가 대시보드에 비교 표시된다.
- 3개 화면(업로드/채팅/평가)이 동작하는 데모 UI가 있다.

---

## 2. 기술 스택 (결정 사항)

| 레이어 | 선택 | 근거 |
|---|---|---|
| 백엔드 | FastAPI (Python) | 참조 프로젝트·학습 연속성 |
| 벡터/전문검색 저장소 | **PostgreSQL + pgvector + tsvector** | 하나의 DB에서 Dense+Sparse를 모두 처리 → 하이브리드 스토리 |
| 임베딩 | OpenAI `text-embedding-3-small` (1536차원) | 안정적 품질, 저비용 |
| 답변 생성 | OpenAI `gpt-4.1-mini` | 저비용, RAGAS 판정 안정 |
| 리랭커 | `BAAI/bge-reranker-v2-m3` (로컬, CPU 가능) | 무료, 하이브리드 결과 재정렬 |
| 평가 | RAGAS | 검색 품질 수치화 |
| 프론트엔드 | Next.js (React) | 지원자 강점(프론트엔드) 활용 |
| 인프라 | docker-compose (Postgres) | 로컬 재현성 |

> LLM/임베딩 제공자로 OpenAI를 택한 이유: RAGAS 판정 LLM이 안정적이어야 평가 수치가 신뢰를 얻고, 실시간 데모에서 로컬 모델의 지연을 피하기 위함. PDF QA 사용량 기준 비용은 무시할 수준.

---

## 3. 아키텍처

```
[Next.js 프론트]  ──HTTP──▶  [FastAPI 백엔드]  ──▶  [Postgres + pgvector]
  · PDF 업로드                  · 인제스트 API           · dense 벡터 (pgvector)
  · 채팅 + 스트리밍 답변        · 질의(RAG) API          · sparse 인덱스 (tsvector)
  · 출처 하이라이트            · 평가(RAGAS) API        · 청크 메타(page, doc_id)
  · RAGAS 점수 대시보드                │
                                       ├──▶ OpenAI (임베딩 · 답변생성 · RAGAS 판정)
                                       └──▶ bge-reranker (로컬 재정렬)
```

핵심 원칙: **바로 LLM에 던지지 않는다.** 검색 → 융합 → 재정렬 → 근거와 함께 생성.

---

## 4. 데이터 파이프라인

### 4.1 인제스트 (업로드 시 1회)
```
PDF → 파싱(PyMuPDF, 페이지번호 보존)
    → 청킹(RecursiveCharacterTextSplitter; 각 청크에 page 메타 부착)
    → 임베딩(text-embedding-3-small)
    → Postgres 저장(embedding 벡터 컬럼 + content의 tsvector 컬럼 동시 생성)
```

### 4.2 질의 (질문 시마다)
```
질문
 ├─ Dense:  pgvector 코사인 유사도 top-10
 └─ Sparse: Postgres 전문검색 ts_rank top-10
        ▼ RRF 융합: score += 1/(rank + 60)  (두 랭킹 합산)
        ▼ bge-reranker 재정렬 → 최종 top-3
        ▼ 최고 점수가 임계값 미만 → "문서에 근거가 없습니다" 폴백
        ▼ OpenAI 생성: 답변 + [p.N] 출처 인용
```

---

## 5. 데이터 모델 (Postgres)

```
documents
  id (uuid, pk), filename (text), page_count (int), created_at (timestamptz)

chunks
  id (uuid, pk)
  document_id (uuid, fk → documents.id)
  page (int)                  -- 출처 인용용
  chunk_index (int)
  content (text)
  content_tsv (tsvector)      -- sparse 검색 (GIN 인덱스)
  embedding (vector(1536))    -- dense 검색 (ivfflat/hnsw 인덱스)
```

- `content_tsv`는 `content`로부터 생성(트리거 또는 저장 시 계산).
- 인덱스: `embedding`에 vector 인덱스, `content_tsv`에 GIN 인덱스.

---

## 6. 출처 인용 설계

- 검색된 각 청크에 `[출처 id=doc_page]` 라벨을 붙여 프롬프트에 주입.
- 시스템 프롬프트: "답변에 사용한 근거의 출처를 문장 끝에 `[p.N]`으로 표기하라. 근거가 없으면 지어내지 말고 '문서에 근거가 없습니다'라고 답하라."
- 응답 스키마:
  ```
  {
    "answer": "환불은 30일 이내 가능합니다 [p.3].",
    "citations": [
      { "page": 3, "snippet": "환불은 구매 후 30일 이내...", "score": 0.87 }
    ]
  }
  ```
- 프론트는 citations를 클릭 가능한 근거 카드로 렌더.

---

## 7. RAGAS 평가 설계

- 대상 PDF에 대해 **질문-정답 셋(golden set) 10~15개**를 `eval/qa_set.json`에 준비.
- 측정 지표: **faithfulness, answer_relevancy, context_precision, context_recall**.
- **A/B 비교 실행**: 동일 질문 셋을 (a) Dense-only 파이프라인, (b) 하이브리드+리랭크 파이프라인으로 각각 돌려 지표를 나란히 산출.
- 결과를 JSON으로 저장하고 프론트 대시보드에서 막대그래프로 비교.
- 산출물 문장: "하이브리드+리랭크가 context_precision을 X%p 개선."

---

## 8. 프론트엔드 (Next.js, 3화면)

1. **업로드**: PDF drag&drop, 인제스트 진행 표시, 완료 시 문서 등록.
2. **채팅**: 질문 입력 → 스트리밍 답변 → 하단에 출처 카드(page + 발췌 + score).
3. **평가 대시보드**: RAGAS 4지표, Dense vs 하이브리드 비교 차트.

---

## 9. 모듈 구조 및 경계

```
backend/app/
  main.py            FastAPI 앱
  config.py          환경변수(OPENAI_API_KEY, DATABASE_URL 등)
  db/
    session.py       엔진/세션
    models.py        documents, chunks 스키마
  ingest/
    parse.py         PDF → 페이지별 텍스트
    chunk.py         텍스트 → 청크(+page 메타)
    embed.py         청크 → 임베딩
    store.py         Postgres 저장(embedding + tsvector)
  retrieve/
    dense.py         pgvector 코사인 top-k
    sparse.py        tsvector ts_rank top-k
    fusion.py        RRF 융합 (순수 함수)
    rerank.py        bge-reranker 재정렬
  generate/
    answer.py        컨텍스트+인용 프롬프트 → 답변 생성
  eval/
    ragas_runner.py  A/B 평가 실행
    qa_set.json      golden set
  routers/
    documents.py     POST /documents (업로드·인제스트)
    chat.py          POST /chat (질의·스트리밍)
    eval.py          POST /eval (RAGAS 실행), GET /eval/latest
frontend/            Next.js (업로드/채팅/대시보드)
docker-compose.yml   postgres + pgvector
```

원칙:
- 각 모듈은 **하나의 책임**만 진다(검색·융합·재정렬·생성 분리) → 독립 테스트·설명 용이.
- `fusion.py`(RRF), `chunk.py`는 순수 로직 → **유닛 테스트**.
- 검색/저장은 작은 픽스처 문서로 **통합 테스트**.

---

## 10. 에러 처리 / 폴백

- OpenAI 호출 실패: 사용자에게 명시적 오류 반환(무음 실패 금지).
- 검색 결과가 비었거나 최고 점수가 임계값 미만: "문서에 근거가 없습니다" 폴백.
- 잘못된/암호화 PDF: 파싱 단계에서 400 반환.
- 리랭커 로드 실패: 리랭킹을 건너뛰고 RRF 순위 그대로 사용(graceful degradation).

---

## 11. MVP 범위

### 포함 (MVP)
- PDF 업로드·인제스트
- 하이브리드 검색(Dense+Sparse) + RRF + 리랭킹
- 출처 인용
- RAGAS 평가 + Dense vs 하이브리드 A/B
- 데모 UI 3화면

### 제외 (스트레치, 이번엔 안 함)
- 인증/회원 관리
- 멀티턴 대화 메모리
- 다중 문서 동시 검색
- 시맨틱 캐시(Redis)
- 클라우드 배포

---

## 12. 리스크 / 열린 질문

- 리랭커(bge) CPU 추론 속도: 데모에서 허용 가능한지 확인 필요. 느리면 top-k를 줄이거나 리랭킹을 선택적으로.
- RAGAS golden set 품질: 정답 셋이 부실하면 지표가 왜곡됨 → 셋을 신중히 작성.
- PDF 표/다단 레이아웃: PyMuPDF 기본 추출이 깨지는 문서가 있을 수 있음 → 초기엔 텍스트 위주 PDF로 데모.
