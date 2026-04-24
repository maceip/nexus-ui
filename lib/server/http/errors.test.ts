import { describe, it, expect } from "vitest";

import { withWallTimeout } from "@/lib/server/http/errors";

describe("withWallTimeout", () => {
  it("returns ok:true when work completes in time", async () => {
    const result = await withWallTimeout(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 42;
    }, 200);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("returns ok:false,timedOut:true when work exceeds the wall", async () => {
    const result = await withWallTimeout(
      () => new Promise((r) => setTimeout(() => r("late"), 100)),
      10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.timedOut).toBe(true);
  });
});
