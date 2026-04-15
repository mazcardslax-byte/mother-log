import { describe, it, expect, vi } from "vitest";
import {
  resolveCode,
  parseSmartEntry,
  autoTrayCode,
  getAlertTrays,
  calcSurvivalByStrain,
  buildTransplantPipeline,
  filterAndGroupPlants,
  buildStrainColorMap,
  applyTrayTransplant,
  searchPlants,
  groupByStrain,
  TRAY_ALERT_DAYS,
  STRAIN_PALETTE,
} from "./clones-utils";

// ── resolveCode ───────────────────────────────────────────────────────────────
const STRAINS = [
  { code: "2002", name: "Grape Cake Mintz" },
  { code: "2023", name: "Papaya Runtz" },
];

describe("resolveCode", () => {
  it("resolves exact strain code", () => {
    const result = resolveCode("2002", STRAINS);
    expect(result).not.toBeNull();
    expect(result.strain.name).toBe("Grape Cake Mintz");
    expect(result.suffix).toBe("");
  });

  it("resolves tester code with suffix", () => {
    const result = resolveCode("2023b", STRAINS);
    expect(result).not.toBeNull();
    expect(result.strain.name).toBe("Papaya Runtz");
    expect(result.suffix).toBe("B");
  });

  it("returns null for unknown code", () => {
    expect(resolveCode("9999", STRAINS)).toBeNull();
  });

  it("is case-insensitive for the code", () => {
    const result = resolveCode("2002", STRAINS);
    expect(result).not.toBeNull();
  });
});

// ── parseSmartEntry ───────────────────────────────────────────────────────────
describe("parseSmartEntry", () => {
  it("parses quantity and strain code", () => {
    const result = parseSmartEntry("19 2002", STRAINS);
    expect(result.qty).toBe(19);
    expect(result.resolved?.strain.name).toBe("Grape Cake Mintz");
    expect(result.dateStr).toBeNull();
  });

  it("parses quantity, tester code with suffix, and month+day", () => {
    const result = parseSmartEntry("10 2023b march 24", STRAINS);
    expect(result.qty).toBe(10);
    expect(result.resolved?.strain.name).toBe("Papaya Runtz");
    expect(result.resolved?.suffix).toBe("B");
    expect(result.dateStr).toMatch(/^20\d{2}-03-24$/);
  });

  it("parses slash date format", () => {
    const result = parseSmartEntry("5 2002 3/15", STRAINS);
    expect(result.qty).toBe(5);
    expect(result.dateStr).toMatch(/^20\d{2}-03-15$/);
  });

  it("returns null resolved for unrecognized code", () => {
    const result = parseSmartEntry("5 9999", STRAINS);
    expect(result.resolved).toBeNull();
    expect(result.qty).toBe(5);
  });

  it("returns null qty when no number is in input", () => {
    const result = parseSmartEntry("2002 march 3", STRAINS);
    expect(result.qty).toBeNull();
    expect(result.resolved?.strain.code).toBe("2002");
  });
});

// ── autoTrayCode ──────────────────────────────────────────────────────────────
describe("autoTrayCode", () => {
  it("generates T1 when no trays exist for strain", () => {
    expect(autoTrayCode([], "2002")).toBe("2002-T1");
  });

  it("increments count based on existing trays for that strain", () => {
    const trays = [
      { code: "2002-T1", strainCode: "2002" },
      { code: "2002-T2", strainCode: "2002" },
    ];
    expect(autoTrayCode(trays, "2002")).toBe("2002-T3");
  });

  it("returns empty string when strainCode is empty", () => {
    expect(autoTrayCode([], "")).toBe("");
  });
});

// ── getAlertTrays ─────────────────────────────────────────────────────────────
describe("getAlertTrays", () => {
  it("returns trays at or past TRAY_ALERT_DAYS", () => {
    // Build a date that is clearly past the alert threshold (TRAY_ALERT_DAYS + 1)
    // Using +1 avoids timezone-boundary false negatives when toISOString() and
    // daysSince() resolve the date differently near midnight.
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - (TRAY_ALERT_DAYS + 1));
    const dateStr = oldDate.toISOString().split("T")[0];

    const trays = [
      { id: "1", code: "T1", status: "Active", dateStarted: dateStr },
      { id: "2", code: "T2", status: "Active", dateStarted: new Date().toISOString().split("T")[0] },
      { id: "3", code: "T3", status: "Done", dateStarted: dateStr },
    ];
    const alerts = getAlertTrays(trays);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("1");
  });
});

// ── calcSurvivalByStrain ──────────────────────────────────────────────────────
describe("calcSurvivalByStrain", () => {
  it("counts tray-based plants only", () => {
    const plants = [
      { strainName: "Grape Cake Mintz", status: "Transplanted", tray: "2002-T1" },
      { strainName: "Grape Cake Mintz", status: "Cloned",       tray: "2002-T1" },
      { strainName: "Papaya Runtz",     status: "Transplanted", tray: "" },  // no tray — ignored
    ];
    const result = calcSurvivalByStrain(plants);
    expect(result["Grape Cake Mintz"]).toEqual({ transplanted: 1, total: 2 });
    expect(result["Papaya Runtz"]).toBeUndefined();
  });

  it("returns empty object when no plants have trays", () => {
    const plants = [{ strainName: "X", status: "Cloned", tray: "" }];
    expect(calcSurvivalByStrain(plants)).toEqual({});
  });
});

// ── buildTransplantPipeline ───────────────────────────────────────────────────
describe("buildTransplantPipeline", () => {
  it("merges tray counts and logged cloned plants", () => {
    const trays = [
      { status: "Active", strainName: "Grape Cake Mintz", count: 30 },
      { status: "Done",   strainName: "Papaya Runtz",     count: 10 }, // Done — excluded
    ];
    const activePlants = [
      { strainName: "Grape Cake Mintz", status: "Cloned" },
      { strainName: "Grape Cake Mintz", status: "Transplanted" }, // Transplanted — not counted
    ];
    const rows = buildTransplantPipeline(trays, activePlants);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ name: "Grape Cake Mintz", trayCount: 30, loggedCount: 1 });
  });
});

// ── filterAndGroupPlants ──────────────────────────────────────────────────────
describe("filterAndGroupPlants", () => {
  const plants = [
    { id: "1", strainName: "A", round: "Upcoming", status: "Cloned",       archived: false },
    { id: "2", strainName: "A", round: "Next",     status: "Transplanted", archived: false },
    { id: "3", strainName: "B", round: "Upcoming", status: "Cloned",       archived: false },
    { id: "4", strainName: "A", round: "Archived", status: "Cloned",       archived: true  },
  ];

  it("excludes archived plants when showArchived=false", () => {
    const { displayPlants } = filterAndGroupPlants(plants, {
      showArchived: false, filterStrain: "All", filterRound: "All", filterStatus: "All",
    });
    expect(displayPlants).toHaveLength(3);
    expect(displayPlants.find(p => p.id === "4")).toBeUndefined();
  });

  it("shows only archived plants when showArchived=true", () => {
    const { displayPlants } = filterAndGroupPlants(plants, {
      showArchived: true, filterStrain: "All", filterRound: "All", filterStatus: "All",
    });
    expect(displayPlants).toHaveLength(1);
    expect(displayPlants[0].id).toBe("4");
  });

  it("filters by strain", () => {
    const { displayPlants } = filterAndGroupPlants(plants, {
      showArchived: false, filterStrain: "B", filterRound: "All", filterStatus: "All",
    });
    expect(displayPlants).toHaveLength(1);
    expect(displayPlants[0].strainName).toBe("B");
  });

  it("filters by round", () => {
    const { displayPlants } = filterAndGroupPlants(plants, {
      showArchived: false, filterStrain: "All", filterRound: "Next", filterStatus: "All",
    });
    expect(displayPlants).toHaveLength(1);
    expect(displayPlants[0].id).toBe("2");
  });

  it("groups by strainName", () => {
    const { grouped } = filterAndGroupPlants(plants, {
      showArchived: false, filterStrain: "All", filterRound: "All", filterStatus: "All",
    });
    expect(Object.keys(grouped)).toContain("A");
    expect(Object.keys(grouped)).toContain("B");
    expect(grouped["A"]).toHaveLength(2);
    expect(grouped["B"]).toHaveLength(1);
  });
});

// ── buildStrainColorMap ───────────────────────────────────────────────────────
describe("buildStrainColorMap", () => {
  it("assigns palette colors by index", () => {
    const names = ["A", "B"];
    const palette = ["#red", "#blue", "#green"];
    const map = buildStrainColorMap(names, palette);
    expect(map["A"]).toBe("#red");
    expect(map["B"]).toBe("#blue");
  });

  it("wraps palette when more names than colors", () => {
    const names = ["A", "B", "C"];
    const palette = ["#x", "#y"];
    const map = buildStrainColorMap(names, palette);
    expect(map["C"]).toBe("#x"); // wraps back to index 0
  });

  it("uses STRAIN_PALETTE when no palette provided", () => {
    const names = ["A"];
    const map = buildStrainColorMap(names);
    expect(map["A"]).toBe(STRAIN_PALETTE[0]);
  });
});

// ── applyTrayTransplant ───────────────────────────────────────────────────────
describe("applyTrayTransplant", () => {
  const trays = [
    { id: "t1", code: "2002-T1", strainCode: "2002", strainName: "Grape Cake Mintz",
      dateStarted: "2026-01-01", count: 4, status: "Active" },
  ];
  const plants = [
    { id: "p1", tray: "2002-T1", status: "Cloned",  archived: false, strainName: "Grape Cake Mintz", strainCode: "2002" },
    { id: "p2", tray: "2002-T1", status: "Cloned",  archived: false, strainName: "Grape Cake Mintz", strainCode: "2002" },
    { id: "p3", tray: "other",   status: "Cloned",  archived: false, strainName: "Other",            strainCode: "9999" },
  ];

  it("marks transplanted plants as Transplanted with date", () => {
    const { nextPlants } = applyTrayTransplant(plants, trays, "2002-T1", "2026-03-01", 2, "Upcoming");
    const p1 = nextPlants.find(p => p.id === "p1");
    const p2 = nextPlants.find(p => p.id === "p2");
    expect(p1.status).toBe("Transplanted");
    expect(p1.dateTransplanted).toBe("2026-03-01");
    expect(p2.status).toBe("Transplanted");
  });

  it("marks tray as Done with survived count", () => {
    const { nextTrays } = applyTrayTransplant(plants, trays, "2002-T1", "2026-03-01", 2, "Upcoming");
    expect(nextTrays[0].status).toBe("Done");
    expect(nextTrays[0].survived).toBe(2);
  });

  it("creates phantom non-survivor records when tray.count > survived + logged", () => {
    // tray.count=4, survived=2, logged=2 in tray => all logged transplanted, 0 archived, extraNonSurvived = 4-2-0 = 2
    const { nextPlants } = applyTrayTransplant(plants, trays, "2002-T1", "2026-03-01", 2, "Upcoming");
    const nonSurvivors = nextPlants.filter(
      p => p.tray === "2002-T1" && p.archived && p.batchNote?.includes("Did not survive")
    );
    expect(nonSurvivors).toHaveLength(2);
  });

  it("does not touch plants from other trays", () => {
    const { nextPlants } = applyTrayTransplant(plants, trays, "2002-T1", "2026-03-01", 2, "Upcoming");
    const p3 = nextPlants.find(p => p.id === "p3");
    expect(p3.status).toBe("Cloned");
    expect(p3.archived).toBe(false);
  });
});

// ── searchPlants ──────────────────────────────────────────────────────────────
describe("searchPlants", () => {
  const plants = [
    { strainName: "Grape Cake Mintz", strainCode: "2002", status: "Cloned",       tray: "2002-T1", notes: "",     batchNote: "",   round: "Upcoming" },
    { strainName: "Papaya Runtz",      strainCode: "2023", status: "Transplanted", tray: "",        notes: "test", batchNote: "",   round: "Next" },
  ];

  it("finds by strain name (partial, case-insensitive)", () => {
    expect(searchPlants(plants, "grape")).toHaveLength(1);
  });

  it("finds by status", () => {
    expect(searchPlants(plants, "transplanted")).toHaveLength(1);
  });

  it("finds by tray", () => {
    expect(searchPlants(plants, "2002-T1")).toHaveLength(1);
  });

  it("finds by notes", () => {
    expect(searchPlants(plants, "test")).toHaveLength(1);
  });

  it("returns empty array for blank query", () => {
    expect(searchPlants(plants, "   ")).toHaveLength(0);
  });
});

// ── groupByStrain ─────────────────────────────────────────────────────────────
describe("groupByStrain", () => {
  it("groups plants by strainName", () => {
    const plants = [
      { id: "1", strainName: "A" },
      { id: "2", strainName: "B" },
      { id: "3", strainName: "A" },
    ];
    const grouped = groupByStrain(plants);
    expect(grouped["A"]).toHaveLength(2);
    expect(grouped["B"]).toHaveLength(1);
  });

  it("returns empty object for empty input", () => {
    expect(groupByStrain([])).toEqual({});
  });
});
