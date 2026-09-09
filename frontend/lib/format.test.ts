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
