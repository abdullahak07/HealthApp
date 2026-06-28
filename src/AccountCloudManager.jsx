import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  getSupabase,
  getSupabaseConfigStatus,
  isSupabaseConfigured,
} from "./supabaseClient";

const STORAGE_KEY = "healthai-mvp-v1";
const OWNER_KEY = "healthai-cloud-owner";
const SYNCED_AT_KEY = "healthai-cloud-synced-at";
const HYDRATED_KEY_PREFIX = "healthai-cloud-hydrated";

function readLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function AuthScreen({ supabase, onSession }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          onSession(data.session);
        } else {
          setMessage("Account created. Check your email and confirm the sign-up link, then return here to sign in.");
          setMode("signin");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onSession(data.session);
      }
    } catch (submitError) {
      setError(submitError.message || "The account request could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="account-auth-page">
      <section className="account-auth-card">
        <div className="account-auth-brand">
          <div className="account-auth-logo"><Cloud size={28} /></div>
          <div><strong>HealthAI</strong><span>Your plan, saved securely</span></div>
        </div>

        <div className="account-auth-heading">
          <span>PERSONAL HEALTH ACCOUNT</span>
          <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p>Your meals, workouts, profile and progress will be available after every refresh and across your devices.</p>
        </div>

        <div className="account-auth-tabs">
          <button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); setMessage(""); }}><LogIn size={16} /> Sign in</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}><UserPlus size={16} /> Create account</button>
        </div>

        <form onSubmit={submit} className="account-auth-form">
          {mode === "signup" && (
            <label>
              <span>Name</span>
              <div><UserRound size={17} /><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></div>
            </label>
          )}

          <label>
            <span>Email address</span>
            <div><Mail size={17} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
          </label>

          <label>
            <span>Password</span>
            <div>
              <ShieldCheck size={17} />
              <input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
              <button type="button" className="account-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </label>

          {error && <div className="account-auth-error">{error}</div>}
          {message && <div className="account-auth-message"><CheckCircle2 size={17} /> {message}</div>}

          <button className="account-auth-submit" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="account-spin" size={18} /> : mode === "signin" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {busy ? "Please wait" : mode === "signin" ? "Sign in securely" : "Create my account"}
          </button>
        </form>

        <div className="account-auth-safety"><ShieldCheck size={16} /><span>Each account can access only its own HealthAI row through Supabase Row Level Security.</span></div>
      </section>
    </main>
  );
}

function SetupRequired({ children }) {
  const status = getSupabaseConfigStatus();
  return (
    <>
      {children}
      <div className="cloud-setup-banner">
        <CloudOff size={18} />
        <div><strong>Cloud accounts are ready in the code</strong><span>Add {status.hasUrl ? "" : "VITE_SUPABASE_URL"}{!status.hasUrl && !status.hasPublishableKey ? " and " : ""}{status.hasPublishableKey ? "" : "VITE_SUPABASE_PUBLISHABLE_KEY"} in Vercel to activate them.</span></div>
      </div>
    </>
  );
}

function SyncLoading({ message }) {
  return (
    <main className="account-auth-page">
      <section className="cloud-loading-card">
        <LoaderCircle className="account-spin" size={28} />
        <strong>{message}</strong>
        <span>Your personal HealthAI data is being prepared.</span>
      </section>
    </main>
  );
}

function AccountButton({ session, syncStatus, onSync, onSignOut }) {
  const [open, setOpen] = useState(false);
  const email = session?.user?.email || "Account";
  const name = session?.user?.user_metadata?.full_name || email.split("@")[0];
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="cloud-account-wrap">
      <button className="cloud-account-button" onClick={() => setOpen((current) => !current)}>
        <span className="cloud-account-avatar">{initial}</span>
        <span className="cloud-account-copy"><strong>{name}</strong><small className={`sync-${syncStatus}`}>{syncStatus === "saving" ? "Saving…" : syncStatus === "error" ? "Sync problem" : "Saved to cloud"}</small></span>
      </button>

      {open && (
        <div className="cloud-account-menu">
          <div className="cloud-account-email"><Cloud size={17} /><span><strong>Personal account</strong><small>{email}</small></span></div>
          <button onClick={() => { onSync(); setOpen(false); }}><RefreshCw size={16} /> Sync now</button>
          <button className="cloud-signout" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function AccountCloudManager({ children }) {
  const configured = isSupabaseConfigured();
  const [supabase, setSupabase] = useState(null);
  const [session, setSession] = useState(null);
  const [initialising, setInitialising] = useState(configured);
  const [hydrating, setHydrating] = useState(false);
  const [syncStatus, setSyncStatus] = useState("saved");
  const [portalTarget, setPortalTarget] = useState(null);
  const lastRawRef = useRef(localStorage.getItem(STORAGE_KEY) || "");
  const saveTimerRef = useRef(null);
  const readyUserRef = useRef(null);

  useEffect(() => {
    if (!configured) return undefined;
    let mounted = true;
    let subscription;

    getSupabase().then(async (client) => {
      if (!mounted) return;
      setSupabase(client);
      const { data } = await client.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      setInitialising(false);

      const authListener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) setSession(nextSession || null);
      });
      subscription = authListener.data.subscription;
    }).catch((error) => {
      console.error("Supabase startup failed", error);
      if (mounted) {
        setInitialising(false);
        setSyncStatus("error");
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!session?.user || !supabase) {
      readyUserRef.current = null;
      return;
    }

    let cancelled = false;
    const userId = session.user.id;

    const hydrate = async () => {
      setHydrating(true);
      setSyncStatus("saving");
      const owner = localStorage.getItem(OWNER_KEY);
      const localState = readLocalState();
      const hydrationKey = `${HYDRATED_KEY_PREFIX}:${userId}`;

      const { data, error } = await supabase
        .from("user_app_state")
        .select("state, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Cloud state load failed", error);
        setSyncStatus("error");
        setHydrating(false);
        return;
      }

      if (data?.state) {
        const cloudRaw = JSON.stringify(data.state);
        const alreadyHydrated = sessionStorage.getItem(hydrationKey) === "1";
        if ((!alreadyHydrated || owner !== userId) && cloudRaw !== localStorage.getItem(STORAGE_KEY)) {
          localStorage.setItem(STORAGE_KEY, cloudRaw);
          localStorage.setItem(OWNER_KEY, userId);
          localStorage.setItem(SYNCED_AT_KEY, data.updated_at || new Date().toISOString());
          sessionStorage.setItem(hydrationKey, "1");
          window.location.reload();
          return;
        }
      } else {
        if (owner && owner !== userId) {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(OWNER_KEY, userId);
          sessionStorage.setItem(hydrationKey, "1");
          window.location.reload();
          return;
        }

        if (localState) {
          const { error: insertError } = await supabase.from("user_app_state").upsert({
            user_id: userId,
            state: localState,
            updated_at: new Date().toISOString(),
          });
          if (insertError) {
            console.error("Initial cloud state creation failed", insertError);
            setSyncStatus("error");
            setHydrating(false);
            return;
          }
        }
      }

      localStorage.setItem(OWNER_KEY, userId);
      sessionStorage.setItem(hydrationKey, "1");
      lastRawRef.current = localStorage.getItem(STORAGE_KEY) || "";
      readyUserRef.current = userId;
      setSyncStatus("saved");
      setHydrating(false);
    };

    hydrate();
    return () => { cancelled = true; };
  }, [session?.user?.id, supabase]);

  const saveToCloud = async () => {
    if (!session?.user || !supabase || readyUserRef.current !== session.user.id) return;
    const state = readLocalState();
    if (!state) return;

    setSyncStatus("saving");
    const now = new Date().toISOString();
    const { error } = await supabase.from("user_app_state").upsert({
      user_id: session.user.id,
      state,
      updated_at: now,
    });

    if (error) {
      console.error("Cloud save failed", error);
      setSyncStatus("error");
      return;
    }

    localStorage.setItem(SYNCED_AT_KEY, now);
    lastRawRef.current = localStorage.getItem(STORAGE_KEY) || "";
    setSyncStatus("saved");
  };

  useEffect(() => {
    if (!session?.user || hydrating) return undefined;

    const interval = window.setInterval(() => {
      const raw = localStorage.getItem(STORAGE_KEY) || "";
      if (!raw || raw === lastRawRef.current) return;
      lastRawRef.current = raw;
      setSyncStatus("saving");
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(saveToCloud, 900);
    }, 500);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(saveTimerRef.current);
    };
  }, [session?.user?.id, hydrating, supabase]);

  useEffect(() => {
    const locateTarget = () => setPortalTarget(document.querySelector(".topbar-actions"));
    locateTarget();
    const observer = new MutationObserver(locateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [session?.user?.id]);

  const signOut = async () => {
    await saveToCloud();
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OWNER_KEY);
    localStorage.removeItem(SYNCED_AT_KEY);
    window.location.reload();
  };

  if (!configured) return <SetupRequired>{children}</SetupRequired>;
  if (initialising || !supabase) return <SyncLoading message="Connecting your account" />;
  if (!session) return <AuthScreen supabase={supabase} onSession={setSession} />;
  if (hydrating) return <SyncLoading message="Loading your saved plan" />;

  return (
    <>
      {children}
      {portalTarget && createPortal(
        <AccountButton session={session} syncStatus={syncStatus} onSync={saveToCloud} onSignOut={signOut} />,
        portalTarget,
      )}
    </>
  );
}
