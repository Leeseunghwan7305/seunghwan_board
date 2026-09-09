# PDF-RAG 프론트엔드 (Next.js) — Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FastAPI 백엔드를 소비하는 Next.js 프론트를 만든다 — PDF 업로드, 질문→인용 답변, dense vs hybrid 평가 대시보드 3화면.

**Architecture:** Next.js(App Router, TS) 클라이언트가 백엔드(`/documents`, `/chat`, `/eval`, `/eval/latest`)를 타입드 API 클라이언트로 호출한다. 순수 TS 로직(API 클라이언트·포맷 헬퍼)만 Vitest(node)로 테스트하고, 컴포넌트·레이아웃은 `next build`(타입체크/컴파일) + 수동 시각확인으로 검증한다. 백엔드에는 CORS 미들웨어 한 개만 추가한다.

**Tech Stack:** Next.js 15(App Router), TypeScript, Tailwind CSS v4, next/font(Google), Vitest(node env). 백엔드: FastAPI CORS.

**Spec:** `docs/superpowers/specs/2026-09-09-pdf-rag-service-design.md` (§8 프론트엔드)

## Global Constraints

- 프론트는 `frontend/` 디렉토리(리포 루트 하위)에 생성. 백엔드(`backend/`)와 분리.
- 백엔드 API 베이스 URL은 환경변수 `NEXT_PUBLIC_API_BASE` (기본 `http://localhost:8000`).
- 백엔드 응답 계약(고정):
  - `POST /documents` (multipart `file`) → `{ "document_id": string, "chunks": number }`; 잘못된 PDF → 400 `{detail}`.
  - `POST /chat` (`{ "query": string }`) → `{ "answer": string, "citations": [{ "page": number, "snippet": string, "score": number }] }`.
  - `POST /eval` → `{ "dense": Metrics, "hybrid": Metrics }` where `Metrics = { faithfulness:number, answer_relevancy:number, context_precision:number, context_recall:number }`.
  - `GET /eval/latest` → 위와 동일 or 404.
- 테스트: 순수 TS만(Vitest node) — API 클라이언트(전역 `fetch` mock)와 `lib/format.ts` 헬퍼. 컴포넌트 렌더 테스트는 범위 밖(setup 비용 회피). 각 태스크는 `npm run build` 성공(타입/컴파일)도 통과 기준에 포함.
- 커밋 메시지 트레일러 2줄(모든 커밋):
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013Z9AF9oVehUqCiKzWJxm2N

### 디자인 시스템 (이 토큰/폰트/시그니처를 정확히 구현 — 기본 Tailwind 룩 금지)

컨셉: **"증거 계측기(evidence instrument)"** — 검색 도구답게 답변마다 근거를 눈으로 확인·계량한다. 챗버블 UI 금지.

- **색 (globals.css의 CSS 변수 + Tailwind @theme 매핑):**
  - `--paper:#F5F6F8` (cool paper 배경; 크림 #F4F1EA 금지)
  - `--ink:#14181F` (본문 텍스트)
  - `--muted:#6B7280` (보조)
  - `--line:#E2E5EA` (헤어라인/보더)
  - `--primary:#3538CD` (electric indigo; 액션·링크·강조)
  - `--evidence:#B45309` (burnt amber; **관련도 미터 전용** — 다른 곳에 쓰지 말 것)
  - 다크 모드: `@media (prefers-color-scheme: dark)`로 `--paper:#0E1117 --ink:#E7E9EE --line:#232833 --muted:#8A93A2` (primary/evidence 유지). 라이트/다크 둘 다 성립해야 함.
- **타이포 (next/font/google):**
  - Display: **Space Grotesk** (헤딩·히어로; 절제해서 사용)
  - Body: **IBM Plex Sans** (본문)
  - Data/Mono: **IBM Plex Mono** (점수·페이지번호·지표값 — "계측기" 느낌의 핵심)
  - 세리프 디스플레이(크림+세리프 클리셰) 금지, Inter 금지.
- **레이아웃:** 중앙 1컬럼 챗 금지. 상단에 얇은 유틸리티 헤더(제품명 좌측, 3화면 네비 우측). 질문 화면은 **답변(좌) + 근거 패널(우)** 2컬럼(모바일에선 세로 스택).
- **시그니처 1 — 근거 카드(EvidenceCard):** 각 인용을 카드로. 왼쪽에 **페이지 탭**(물리 문서 탭 느낌, mono로 `p.3`), 본문에 snippet, 하단에 **관련도 미터**(가로 막대, `--evidence` 색, mono로 점수). 점수 0~1을 폭 %로.
- **시그니처 2 — 평가 덤벨(MetricDumbbell):** 4지표 각각을 한 줄로: 지표명(좌) · **dense 점(회색)과 hybrid 점(primary)을 선으로 이은 덤벨** · 우측에 개선폭 `+0.12`(mono). 일반 그룹 막대 금지 — "dense→hybrid가 얼마나 개선됐나"를 델타로 직접 보여줄 것.
- 품질 바닥선: 모바일 반응형, 키보드 포커스 가시화, `prefers-reduced-motion` 존중. 과한 애니메이션 금지(로드 시 은은한 페이드/상승 1회 정도).
- 카피: 시스템 용어가 아니라 사용자 언어. 액션은 동작 그대로("Ask", "Upload PDF", "Run evaluation"). 빈 상태·에러는 방향 제시("No document yet — upload a PDF to start.").

---

### Task 0: 백엔드 CORS + Next.js 스캐폴드 + 디자인 토큰 + API 클라이언트(테스트)

**Files:**
- Modify: `backend/app/main.py` (CORS 미들웨어)
- Create: `frontend/` (create-next-app 산출물) — 주요: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css`, `vitest.config.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/format.ts`
- Create: `frontend/lib/api.test.ts`
- Create: `frontend/lib/format.test.ts`
- Create: `frontend/.env.local.example`

**Interfaces:**
- Produces (`frontend/lib/api.ts`):
  - `type Citation = { page:number; snippet:string; score:number }`
  - `type ChatResponse = { answer:string; citations:Citation[] }`
  - `type Metrics = { faithfulness:number; answer_relevancy:number; context_precision:number; context_recall:number }`
  - `type EvalResult = { dense:Metrics; hybrid:Metrics }`
  - `type UploadResponse = { document_id:string; chunks:number }`
  - `uploadDocument(file:File):Promise<UploadResponse>` (POST multipart)
  - `ask(query:string):Promise<ChatResponse>`
  - `runEval():Promise<EvalResult>`
  - `getLatestEval():Promise<EvalResult|null>` (404 → null)
  - 모든 호출은 `API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"` 사용. 비-2xx(404 제외 규칙은 getLatestEval만)면 `Error(detail)` throw.
- Produces (`frontend/lib/format.ts`):
  - `scoreToPct(score:number):number` — 0..1 클램프 후 0..100 정수.
  - `metricDelta(dense:number, hybrid:number):string` — `hybrid-dense`를 부호포함 소수 2자리 문자열(`"+0.12"`, `"-0.03"`, `"0.00"`).
  - `METRIC_LABELS: {key:keyof Metrics; label:string}[]` — 4지표의 사람이 읽는 라벨(`faithfulness→"Faithfulness"` 등).

- [ ] **Step 1: 백엔드 CORS 추가 (`backend/app/main.py`)**

기존 main.py의 app 생성 직후에 추가(기존 라우터 include·startup 유지):
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
확인: `cd backend && ./.venv/bin/python -m pytest -q` 여전히 GREEN(29 passed).

- [ ] **Step 2: Next.js 스캐폴드 (비대화형)**

리포 루트에서:
```bash
npx --yes create-next-app@latest frontend --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```
(대화형 프롬프트가 남으면 위 플래그로 모두 지정되어야 함. `--turbopack` 여부는 기본값 수용.)

- [ ] **Step 3: Vitest(node) 셋업**

`cd frontend && npm install -D vitest`. `frontend/package.json`의 scripts에 `"test": "vitest run"` 추가. `frontend/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 4: 디자인 토큰 (`app/globals.css`)**

Tailwind v4 기준. 기존 globals.css의 Tailwind import는 유지하고, 위 "디자인 시스템"의 색 변수(라이트+다크)와 폰트 변수 매핑을 `:root`/`@media`로 정의. 배경 `--paper`, 텍스트 `--ink` 적용. (구체 값은 위 디자인 시스템 절의 hex를 그대로.)

- [ ] **Step 5: 폰트 (`app/layout.tsx`)**

next/font/google로 Space Grotesk / IBM Plex Sans / IBM Plex Mono 로드, CSS 변수(`--font-display`, `--font-body`, `--font-mono`)로 노출하고 body에 body 폰트 적용. `<html lang="en">`. metadata title `"PDF Evidence — ask your documents"`.

- [ ] **Step 6: `.env.local.example`**

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

- [ ] **Step 7: 실패 테스트 작성 (`lib/format.test.ts`, `lib/api.test.ts`)**

format.test.ts:
```typescript
import { describe, it, expect } from "vitest";
import { scoreToPct, metricDelta } from "./format";
describe("format", () => {
  it("scoreToPct clamps and scales", () => {
    expect(scoreToPct(0.5)).toBe(50);
    expect(scoreToPct(1.5)).toBe(100);
    expect(scoreToPct(-1)).toBe(0);
  });
  it("metricDelta is signed 2dp", () => {
    expect(metricDelta(0.6, 0.72)).toBe("+0.12");
    expect(metricDelta(0.5, 0.47)).toBe("-0.03");
    expect(metricDelta(0.5, 0.5)).toBe("0.00");
  });
});
```
api.test.ts (전역 fetch mock):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ask, getLatestEval } from "./api";
beforeEach(() => { vi.restoreAllMocks(); });
describe("api", () => {
  it("ask posts query and returns parsed json", async () => {
    const body = { answer: "30 days [p.1].", citations: [{ page: 1, snippet: "…", score: 0.9 }] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => body } as Response);
    const out = await ask("refund?");
    expect(out.citations[0].page).toBe(1);
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/chat");
    expect(JSON.parse(call[1].body).query).toBe("refund?");
  });
  it("getLatestEval returns null on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as Response);
    expect(await getLatestEval()).toBeNull();
  });
});
```

- [ ] **Step 8: 테스트 실패 확인 → `lib/api.ts` + `lib/format.ts` 구현 → 통과**

api.ts 구현 요지:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
async function j<T>(res: Response): Promise<T> {
  if (!res.ok) { let d = res.statusText; try { d = (await res.json()).detail ?? d; } catch {} throw new Error(d); }
  return res.json();
}
export async function ask(query: string): Promise<ChatResponse> {
  return j(await fetch(`${API_BASE}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }));
}
export async function uploadDocument(file: File): Promise<UploadResponse> {
  const fd = new FormData(); fd.append("file", file);
  return j(await fetch(`${API_BASE}/documents`, { method: "POST", body: fd }));
}
export async function runEval(): Promise<EvalResult> { return j(await fetch(`${API_BASE}/eval`, { method: "POST" })); }
export async function getLatestEval(): Promise<EvalResult | null> {
  const res = await fetch(`${API_BASE}/eval/latest`);
  if (res.status === 404) return null;
  return j(res);
}
```
(타입들도 export.) format.ts는 위 Interfaces대로.

Run: `cd frontend && npm test` → PASS. 그리고 `npm run build` → 성공(타입/컴파일).

- [ ] **Step 9: 커밋**

```bash
git add backend/app/main.py frontend
git commit -m "feat(web): scaffold Next.js app, design tokens, typed API client + backend CORS"
```
(`frontend/.gitignore`는 create-next-app이 node_modules/.next 등 무시하도록 생성함 — 확인.)

---

### Task 1: 셰어드 레이아웃/네비 + 업로드 화면

**Files:**
- Modify: `frontend/app/layout.tsx` (헤더/네비 셸)
- Create: `frontend/components/Header.tsx`
- Create: `frontend/app/page.tsx` (업로드 = 홈)
- Create: `frontend/components/UploadDropzone.tsx`

**Interfaces:**
- Consumes: `uploadDocument` from `@/lib/api`.
- Produces: 홈(`/`)에서 PDF drag&drop 또는 파일선택 → `uploadDocument` 호출 → 성공 시 `{chunks}` 반영한 확인 메시지 + "Ask a question →"(`/ask`) CTA. 에러(400 등)는 인라인 메시지.

- [ ] **Step 1: Header 컴포넌트**

얇은 유틸리티 헤더: 좌측 워드마크(제품명, display 폰트), 우측 네비 3개 링크(`Upload` `/`, `Ask` `/ask`, `Evaluation` `/eval`). 현재 경로 활성표시(usePathname). `--line` 하단 보더. 클라이언트 컴포넌트.

- [ ] **Step 2: layout.tsx에 Header 삽입**

body 안에서 `<Header/>` + `<main>{children}</main>` 구조. main에 페이지 패딩/최대폭.

- [ ] **Step 3: UploadDropzone (클라이언트)**

- drag&drop 영역 + `<input type="file" accept="application/pdf">`.
- 상태: idle / uploading / done / error.
- done: "Indexed <n> passages. Ask a question →" (링크 `/ask`).
- error: 백엔드 detail 표시(예: 잘못된 PDF).
- 디자인: 큰 점선 영역이 아니라, `--line` 실선 + hover 시 `--primary` 보더. 계측기 느낌으로 상태를 mono 캡션으로.

- [ ] **Step 4: app/page.tsx**

히어로: 제품 한 줄 설명(무엇을 하는지 사용자 언어로) + UploadDropzone. 히어로 카피는 "Upload a PDF and ask it anything — every answer shows the passage it came from." 수준.

- [ ] **Step 5: 빌드 검증 + 커밋**

Run: `cd frontend && npm run build` → 성공. (컴포넌트 로직 테스트는 범위 밖.)
```bash
git add frontend/app/layout.tsx frontend/components/Header.tsx frontend/app/page.tsx frontend/components/UploadDropzone.tsx
git commit -m "feat(web): app shell/nav + PDF upload screen"
```

---

### Task 2: 질문 화면 + 근거 카드(시그니처 1)

**Files:**
- Create: `frontend/app/ask/page.tsx`
- Create: `frontend/components/EvidenceCard.tsx`
- Create: `frontend/components/RelevanceMeter.tsx`
- Test: `frontend/lib/format.test.ts` (RelevanceMeter가 쓰는 scoreToPct는 Task0에서 테스트됨 — 추가 순수 헬퍼 있으면 여기서 테스트)

**Interfaces:**
- Consumes: `ask` from `@/lib/api`, `scoreToPct` from `@/lib/format`.
- Produces: `/ask`에서 질문 입력 → `ask()` → 좌측에 답변 텍스트, 우측 패널에 `citations`를 EvidenceCard 리스트로. 근거 없으면("문서에 근거가 없습니다." 또는 빈 citations) 우측은 비어있고 안내.

- [ ] **Step 1: RelevanceMeter (순수 프레젠테이션)**

props `{ score:number }`. `scoreToPct(score)`로 폭 % 계산, 가로 막대(`--evidence` 색), 우측에 mono로 `score.toFixed(2)`. `role="meter"` + aria-valuenow/min/max. reduced-motion 존중.

- [ ] **Step 2: EvidenceCard (순수 프레젠테이션)**

props `{ citation:Citation }`. 좌측 페이지 탭(mono `p.{page}`), 본문 snippet, 하단 RelevanceMeter. 카드 보더 `--line`, hover 시 살짝 상승.

- [ ] **Step 3: app/ask/page.tsx (클라이언트)**

- 상단 질문 입력(큰 텍스트 인풋 + "Ask" 버튼, Enter 제출). 상태 idle/asking/answered/error.
- 2컬럼: 좌 = 답변(asking 중 스켈레톤/펄스 1회), 우 = "Evidence" 라벨 + EvidenceCard 리스트.
- 답변이 "문서에 근거가 없습니다." 이거나 citations 빈 배열이면 우측에 "No supporting passage found." 안내.
- 모바일: 세로 스택(답변 위, 근거 아래).

- [ ] **Step 4: 빌드 검증 + 커밋**

Run: `cd frontend && npm test && npm run build` → 모두 성공.
```bash
git add frontend/app/ask frontend/components/EvidenceCard.tsx frontend/components/RelevanceMeter.tsx
git commit -m "feat(web): ask screen with cited answers (evidence cards + relevance meters)"
```

---

### Task 3: 평가 대시보드 + 덤벨 비교(시그니처 2)

**Files:**
- Create: `frontend/app/eval/page.tsx`
- Create: `frontend/components/MetricDumbbell.tsx`
- Modify: `frontend/lib/format.ts` (필요 헬퍼 있으면; metricDelta는 Task0)
- Test: `frontend/lib/format.test.ts` (metricDelta는 Task0에서 테스트; 신규 헬퍼 추가 시 테스트)

**Interfaces:**
- Consumes: `runEval`, `getLatestEval` from `@/lib/api`, `metricDelta`, `scoreToPct`, `METRIC_LABELS` from `@/lib/format`.
- Produces: `/eval`에서 최초 진입 시 `getLatestEval()`로 기존 결과 로드(없으면 안내), "Run evaluation" 버튼으로 `runEval()` 실행 후 결과 표시. 각 4지표를 MetricDumbbell로.

- [ ] **Step 1: MetricDumbbell (순수 프레젠테이션)**

props `{ label:string; dense:number; hybrid:number }`. 한 줄: 좌 라벨, 중앙 트랙(0~1) 위에 dense 점(`--muted` 회색)과 hybrid 점(`--primary`)을 선으로 이어 표시(각 점 위치 = scoreToPct%), 우측에 `metricDelta(dense,hybrid)`(mono; 양수면 `--primary`, 음수면 `--muted`). aria 라벨로 두 값·델타 서술.

- [ ] **Step 2: app/eval/page.tsx (클라이언트)**

- 진입 시 `getLatestEval()`; null이면 "No evaluation yet. Run one to compare retrieval strategies." + 버튼.
- "Run evaluation" → 로딩("Scoring dense vs hybrid…") → 결과 오면 4개 MetricDumbbell(METRIC_LABELS 순).
- 상단에 한 줄 설명: dense(vector-only) vs hybrid(dense+keyword+rerank)를 RAGAS로 비교한다는 사용자 언어 카피.
- 실 평가가 느릴 수 있음(백엔드가 OpenAI/RAGAS 호출) — 버튼 disabled + 로딩 표시. 에러 시 detail 인라인.

- [ ] **Step 3: 빌드 검증 + 커밋**

Run: `cd frontend && npm test && npm run build` → 성공.
```bash
git add frontend/app/eval frontend/components/MetricDumbbell.tsx frontend/lib/format.ts
git commit -m "feat(web): evaluation dashboard with dense-vs-hybrid dumbbell comparison"
```

---

### Task 4: 프론트 README (실행법)

**Files:**
- Create: `frontend/README.md`

- [ ] **Step 1: 실행 절차 문서화**

```markdown
# PDF Evidence — frontend

Next.js UI for the PDF-RAG backend.

## Run
1. Start the backend (see ../backend): `uvicorn app.main:app --reload` (needs Postgres + OPENAI_API_KEY)
2. `cd frontend && npm install`
3. `cp .env.local.example .env.local` (set NEXT_PUBLIC_API_BASE if backend isn't on :8000)
4. `npm run dev` → http://localhost:3000

## Screens
- `/`      Upload a PDF
- `/ask`   Ask questions; answers show cited passages with relevance meters
- `/eval`  Run RAGAS evaluation; compare dense vs hybrid retrieval

## Test / build
- `npm test`        (Vitest: API client + format helpers)
- `npm run build`   (type-check + compile)
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/README.md
git commit -m "docs(web): frontend run instructions"
```

---

## Self-Review (스펙 §8 대비 점검)

- §8 업로드 화면 → Task 1 ✓
- §8 채팅+출처 카드 → Task 2 (EvidenceCard/RelevanceMeter) ✓
- §8 평가 대시보드(비교 차트) → Task 3 (MetricDumbbell dense vs hybrid) ✓
- 백엔드 계약 소비 정확성: 업로드/chat/eval 응답 타입이 Plan 1·2 라우터 반환과 일치 ✓
- CORS: 프론트(localhost:3000)가 백엔드 호출 가능 → Task 0 ✓
- 테스트 결정성: 순수 TS만 Vitest node로(fetch mock), 컴포넌트는 build로 검증 — 백엔드/키 불필요 ✓
- 디자인: 토큰·폰트·2시그니처를 Global Constraints에 확정(기본 Tailwind 룩 회피) ✓
- 플레이스홀더 스캔: 컴포넌트 세부 마크업은 디자인 시스템 제약 안에서 구현자 재량이나, 데이터 계약·핵심 로직·시그니처 정의는 명시 — 의도된 경계 ✓
