const SUPABASE_CDNS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm",
  "https://esm.sh/@supabase/supabase-js@2.57.4?bundle",
];

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

async function loadSupabaseModule() {
  let lastError;

  for (const url of SUPABASE_CDNS) {
    try {
      return await import(/* @vite-ignore */ url);
    } catch (error) {
      lastError = error;
      console.warn(`Supabase module load failed from ${url}`, error);
    }
  }

  throw lastError || new Error("Unable to load the Supabase client.");
}

export async function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not configured.");
  }

  if (!clientPromise) {
    clientPromise = loadSupabaseModule()
      .then(({ createClient }) => createClient(
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
      ))
      .catch((error) => {
        // Do not cache a failed dynamic import forever. A later refresh/retry should
        // get a fresh attempt instead of reusing the rejected promise.
        clientPromise = undefined;
        throw error;
      });
  }

  return clientPromise;
}
