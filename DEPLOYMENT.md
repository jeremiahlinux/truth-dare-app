# Truth or Dare: Neon Nights - Production Deployment

This app is now structured for Vercel static hosting + serverless tRPC API.

## 1) Prerequisites

- A Vercel account (Hobby plan is enough)
- A free managed SQL database (Postgres or MySQL)
  - Recommended: Neon Postgres free tier
  - Alternative: PlanetScale free tier

## 2) Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL` (required): your managed SQL connection string
- `NODE_ENV=production`
- `ENABLE_PLATFORM_ROUTES=false`
- `OPENAI_API_KEY` (optional, not needed for template mode)

The game works without any LLM key (template prompts are used automatically).

## 3) Build and Runtime

- Frontend output: `dist/public`
- API handler: `api/trpc.ts`
- Vercel config: `vercel.json`

## 4) Database Notes

Use Drizzle migrations before first production run.

Suggested flow:

1. Set `DATABASE_URL` locally to the same target DB
2. Run:
   - `npm run db:push`
3. Deploy to Vercel

## 5) QA Checklist Before Going Live

- Create room with 2+ players
- Join room from another device/browser using room code
- Ready up and start game
- Verify truth/dare prompt appears
- Verify peer confirmation flow:
  - current player marks done
  - different player confirms
  - score updates only after confirmation
- Verify replay and new game from results
- Verify mobile layout on narrow screens

## 6) Operational Guardrails

- Global request body limit is 1MB
- API rate limiting is enabled
- Procedure-level throttles are enabled for high-risk actions
- Prompt generation gracefully falls back to local templates
