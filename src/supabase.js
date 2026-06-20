import { createClient } from "@supabase/supabase-js";

// E2E / credential-free local dev: route all DB calls to the in-memory seed.
// VITE_E2E_MOCK is never set in the Vercel production build, so these branches
// (and the dynamic import of the fixtures) are statically dead code and are
// dropped from prod bundles — the fixtures never ship to production.
const E2E_MOCK = import.meta.env.VITE_E2E_MOCK === "1";

const supabase = E2E_MOCK
  ? null
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_KEY
    );

export async function loadFromDB(key) {
  if (E2E_MOCK) {
    const mockDB = await import("./e2e-fixtures");
    return mockDB.load(key);
  }
  const { data, error } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", key)
    .single();
  // PGRST116 = "no rows found" — expected on first run, not an error
  if (error && error.code !== "PGRST116") {
    console.error("[supabase] loadFromDB failed:", error);
  }
  return data?.value ?? null;
}

// Caller passes in the timestamp so it can be registered in pendingTimestamps
// before the async save starts — preventing echo-overwrite races.
export async function saveToDB(key, value, updatedAt) {
  if (E2E_MOCK) {
    const mockDB = await import("./e2e-fixtures");
    return mockDB.save(key, value);
  }
  const { error } = await supabase
    .from("app_data")
    .upsert({ key, value, updated_at: updatedAt });
  if (error) throw error;
}

// Subscribe to real-time changes on a key.
// callback receives (value, updatedAt) so callers can filter their own saves.
// Returns an object with an unsubscribe() method.
export function subscribeToKey(key, callback) {
  if (E2E_MOCK) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`app_data:${key}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "app_data",
        filter: `key=eq.${key}`,
      },
      (payload) => {
        callback(payload.new?.value, payload.new?.updated_at);
      }
    )
    .subscribe((status, err) => {
      if (err) console.error("[supabase] realtime subscribe error:", err);
    });
  return { unsubscribe: () => supabase.removeChannel(channel) };
}
