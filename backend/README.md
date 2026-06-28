# HealthAI Gemini Backend

This service keeps the Gemini API key off the public GitHub Pages frontend and provides one endpoint:

```text
POST /api/food/estimate
```

## Environment variables

Copy `.env.example` and configure:

```text
GEMINI_API_KEY=<private Gemini key>
GEMINI_MODEL=gemini-3.5-flash
ALLOWED_ORIGINS=https://abdullahak07.github.io,http://localhost:5173
RATE_LIMIT_PER_MINUTE=30
```

Never place `GEMINI_API_KEY` in the React app, a Vite variable, GitHub source code, or a public repository variable.

## Deploy on Railway

1. Create a new Railway project from `abdullahak07/HealthApp`.
2. Set the service **Root Directory** to `/backend`.
3. Add the environment variables above in Railway Variables.
4. Generate a public Railway domain.
5. Confirm this URL returns JSON:

```text
https://YOUR-BACKEND-DOMAIN/health
```

6. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables**.
7. Create this repository variable:

```text
Name: VITE_AI_API_URL
Value: https://YOUR-BACKEND-DOMAIN
```

8. Run the `Deploy HealthApp to GitHub Pages` workflow again or push a new commit.

The frontend build reads only the backend URL. The Gemini key remains private inside Railway.

## Run locally

```bash
cd backend
npm install
cp .env.example .env
npm start
```

The frontend can then be started with:

```bash
VITE_AI_API_URL=http://localhost:8080 npm run dev
```

On Windows PowerShell:

```powershell
$env:VITE_AI_API_URL="http://localhost:8080"
npm run dev
```

## Response behaviour

Gemini returns structured JSON containing:

- interpreted food name and serving
- best calorie estimate
- plausible calorie range
- protein, carbohydrate and fat estimates
- confidence level
- assumptions affecting accuracy
- component breakdown for mixed meals
- one clarification question when a useful estimate is impossible

The frontend shows the estimate for review before saving it to the day.
