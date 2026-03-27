import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export async function loadFromDB(key) {
  const { data } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}

export async function saveToDB(key, value) {
  const { error } = await supabase
    .from("app_data")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Subscribe to real-time changes on a key made by OTHER clients.
// Returns an object with an unsubscribe() method.
export function subscribeToKey(key, callback) {
  const channel = supabase
    .channel(`realtime:app_data:${key}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_data", filter: `key=eq.${key}` },
      (payload) => { callback(payload.new?.value); }
    )
    .subscribe();
  return { unsubscribe: () => supabase.removeChannel(channel) };
}
