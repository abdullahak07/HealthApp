# HealthAI Supabase setup

This adds personal accounts and cloud persistence to the Vercel deployment.

## 1. Create the free Supabase project

1. Open Supabase and create a new project.
2. Choose a strong database password and keep it private.
3. Wait for the project to finish provisioning.

## 2. Create the private user-state table

Open **SQL Editor → New query** and paste the complete contents of:

```text
supabase/schema.sql
```

Press **Run**.

The script creates `public.user_app_state` and enables Row Level Security. Each authenticated user can select, insert, update and delete only the row where `user_id = auth.uid()`.

## 3. Copy the browser-safe project values

Open **Project Settings → API** and copy:

```text
Project URL
Publishable key
```

Depending on the Supabase dashboard wording, an older project may display an `anon` public key instead of a publishable key. Do not copy the `service_role` or secret key.

## 4. Add the values to Vercel

Open the Vercel HealthApp project:

```text
Settings → Environment Variables
```

Add:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

Apply both variables to **Production**, **Preview** and **Development**.

Redeploy the latest production deployment.

## 5. Configure authentication URLs

In Supabase open:

```text
Authentication → URL Configuration
```

Set:

```text
Site URL:
https://health-app-lac-nu.vercel.app
```

Add this Redirect URL:

```text
https://health-app-lac-nu.vercel.app/**
```

This allows email-confirmation links to return to HealthAI.

## 6. Choose email-confirmation behaviour

In:

```text
Authentication → Providers → Email
```

For production, keep email confirmation enabled.

For quick private testing, confirmation can temporarily be disabled. Re-enable it before public launch.

## 7. Verify

Open:

```text
https://health-app-lac-nu.vercel.app
```

Expected flow:

1. Create an account.
2. Confirm the email when confirmation is enabled.
3. Sign in.
4. Select a meal or add food.
5. Wait until the account button says **Saved to cloud**.
6. Refresh the page.
7. The data should remain.
8. Sign in from another browser with the same account; the saved plan should load.

## Security model

The Vite application contains only the Supabase project URL and publishable key. These values are designed for browser use.

Security depends on the Row Level Security policies in `schema.sql`. Never expose any of these values in the frontend:

```text
service_role key
secret key
database password
```

## Stored data

Each user has one JSON row containing the current HealthAI state:

- profile and goals
- meals and extra foods
- meal completion
- workout routine
- exercise completion
- weight history

The app continues to keep a local browser copy for fast loading and synchronises changes to Supabase after sign-in.
