# HealthAI MVP

A responsive React/Vite MVP for an AI-assisted health, nutrition and workout application.

## Implemented

- Personal profile and body-goal setup
- BMI screening value, BMR, maintenance calorie and macro estimates
- Abdullah's current meal routine preloaded as the demonstration plan
- Daily meal completion and extra-food logging
- Safe daily AI-style guidance based on calorie/protein status
- Full six-day Phase 3 workout routine plus recovery day
- Exercise completion tracking
- Routine file attachment and text/JSON import source storage
- Profile-based starter workout generation
- Weight check-ins and trend chart
- Browser persistence with `localStorage`
- Responsive desktop and mobile interface

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Current architecture

This first milestone is a client-side MVP. AI meal estimation, PDF/image extraction, authentication, cloud database, wearable integration and secure API services should be added as backend-connected milestones rather than exposing model/API keys in the browser.

## Health and safety

The app provides general wellness estimates, not medical diagnosis or emergency care. Calorie intake, expenditure and workout recommendations are estimates and should be adjusted using real progress, symptoms and professional advice where appropriate.
