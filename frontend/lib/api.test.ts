import { describe, it, expect, vi, beforeEach } from "vitest";
import { ask, getLatestEval } from "./api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("api", () => {
  it("ask posts query and returns parsed json", async () => {
    const body = { answer: "30 days [p.1].", citations: [{ page: 1, snippet: "…", score: 0.9 }] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => body } as Response);
    const out = await ask("refund?");
    expect(out.citations[0].page).toBe(1);
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(call[0]).toContain("/chat");
    expect(JSON.parse(call[1]?.body as string).query).toBe("refund?");
    // node 환경에서는 getKey()가 항상 null이라 헤더가 붙지 않아야 해요.
    expect(
      (call[1]?.headers as Record<string, string> | undefined)?.[
        "X-OpenAI-Key"
      ]
    ).toBeUndefined();
  });
  it("getLatestEval returns null on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as Response);
    expect(await getLatestEval()).toBeNull();
  });
});
