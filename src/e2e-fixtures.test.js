import { describe, it, expect, beforeEach } from "vitest";
import { load, save, reset } from "./e2e-fixtures";

describe("e2e-fixtures", () => {
  beforeEach(() => reset());

  it("returns seeded mothers for mothers_v1", async () => {
    const mothers = await load("mothers_v1");
    expect(Array.isArray(mothers)).toBe(true);
    expect(mothers.length).toBeGreaterThan(0);
    expect(mothers[0]).toHaveProperty("id");
    expect(mothers[0]).toHaveProperty("strainCode");
    expect(mothers[0]).toHaveProperty("status");
  });

  it("returns at least one Done tray with count and survived", async () => {
    const trays = await load("clone_trays_v1");
    const done = trays.filter(
      (t) => t.status === "Done" && t.count != null && t.survived != null
    );
    expect(done.length).toBeGreaterThan(0);
  });

  it("returns null for unknown keys (empty state)", async () => {
    expect(await load("room_v1")).toBeNull();
    expect(await load("facility_v1")).toBeNull();
  });

  it("save overwrites and load reflects it", async () => {
    await save("mothers_v1", []);
    expect(await load("mothers_v1")).toEqual([]);
  });

  it("reset restores the original seed", async () => {
    await save("mothers_v1", []);
    reset();
    const mothers = await load("mothers_v1");
    expect(mothers.length).toBeGreaterThan(0);
  });
});
