// Deterministic in-memory seed for e2e tests and credential-free local dev.
// Activated only when VITE_E2E_MOCK === "1" (see supabase.js). Never ships to prod.

const SEED = {
  mothers_v1: [
    {
      id: "m-2002",
      strainCode: "2002", // Grape Cake Mintz
      status: "Active",
      location: "A1",
      healthLevel: 4,
      healthLog: [],
      notes: "",
      transplantHistory: [],
      amendmentLog: [],
      cloneLog: [],
      feedingLog: [],
      reductionLog: [],
      photos: [],
      createdAt: "2026-01-15",
    },
    {
      id: "m-2009",
      strainCode: "2009", // Larry Bird Mintz
      status: "Active",
      location: "A2",
      healthLevel: 3,
      healthLog: [],
      notes: "",
      transplantHistory: [],
      amendmentLog: [],
      cloneLog: [],
      feedingLog: [],
      reductionLog: [],
      photos: [],
      createdAt: "2026-02-01",
    },
  ],
  clone_trays_v1: [
    {
      id: "2002-T1",
      strainCode: "2002",
      strainName: "Grape Cake Mintz",
      count: 50,
      survived: 34,
      status: "Done",
    },
    {
      id: "2009-T1",
      strainCode: "2009",
      strainName: "Larry Bird Mintz",
      count: 40,
      survived: null,
      status: "Active",
    },
  ],
  clone_plants_v1: [],
};

let store = structuredClone(SEED);

export async function load(key) {
  return key in store ? store[key] : null;
}

export async function save(key, value) {
  store[key] = value;
}

export function reset() {
  store = structuredClone(SEED);
}
