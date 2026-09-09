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
