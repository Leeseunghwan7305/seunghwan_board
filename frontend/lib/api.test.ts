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
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/chat");
    expect(JSON.parse(call[1].body).query).toBe("refund?");
  });
  it("getLatestEval returns null on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as Response);
    expect(await getLatestEval()).toBeNull();
  });
});
