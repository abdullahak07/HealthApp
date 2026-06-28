const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY
    || "",
).trim();

let clientPromise;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function getSupabaseConfigStatus() {
  return {
    hasUrl: Boolean(supabaseUrl),
    hasPublishableKey: Boolean(supabaseKey),
  };
}

export async function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not configured.");
  }

  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ SUPABASE_CDN).then(({ createClient }) => createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "healthai-auth-session",
        },
      },
    ));
  }

  return clientPromise;
}
