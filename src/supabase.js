import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export async function loadFromDB(key) {
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

// Returns the updated_at timestamp used, so callers can compare against
// incoming realtime payloads to identify their own saves.
export async function saveToDB(key, value) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("app_data")
    .upsert({ key, value, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

// Subscribe to real-time changes on a key.
// callback receives (value, updatedAt) so callers can filter their own saves.
// Returns an object with an unsubscribe() method.
export function subscribeToKey(key, callback) {
  const channel = supabase
    .channel(`app_data:${key}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_data", filter: `key=eq.${key}` },
      (payload) => { callback(payload.new?.value, payload.new?.updated_at); }
    )
    .subscribe((status, err) => {
      if (err) console.error("[supabase] realtime subscribe error:", err);
    });
  return { unsubscribe: () => supabase.removeChannel(channel) };
}
