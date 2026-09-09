import { getKey } from "./key";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// 등록된 키가 있으면 X-OpenAI-Key 헤더로 실어 보내고, 없으면 빈 객체를 반환해요.
// (getKey()는 node/SSR에서 항상 null이라 헤더가 붙지 않아요.)
function keyHeader(): Record<string, string> {
  const key = getKey();
  return key ? { "X-OpenAI-Key": key } : {};
}

export type Citation = { page: number; snippet: string; score: number };
export type ChatResponse = { answer: string; citations: Citation[] };
export type Metrics = {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
};
export type EvalResult = { dense: Metrics; hybrid: Metrics };
export type UploadResponse = { document_id: string; chunks: number };

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let d = res.statusText;
    try {
      d = (await res.json()).detail ?? d;
    } catch {
      // response body wasn't JSON; fall back to statusText
    }
    throw new Error(d);
  }
  return res.json();
}

export async function ask(query: string): Promise<ChatResponse> {
  return j(
    await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...keyHeader() },
      body: JSON.stringify({ query }),
    })
  );
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  return j(
    await fetch(`${API_BASE}/documents`, {
      method: "POST",
      headers: { ...keyHeader() },
      body: fd,
    })
  );
}

export async function runEval(): Promise<EvalResult> {
  return j(
    await fetch(`${API_BASE}/eval`, {
      method: "POST",
      headers: { ...keyHeader() },
    })
  );
}

export async function getLatestEval(): Promise<EvalResult | null> {
  const res = await fetch(`${API_BASE}/eval/latest`, {
    headers: { ...keyHeader() },
  });
  if (res.status === 404) return null;
  return j(res);
}
