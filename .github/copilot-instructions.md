# 🧑‍💻 Copilot Instructions for PrHran

## Project Overview
- **PrHran** is a cross-platform grocery savings app with a TypeScript/React Native frontend (Expo), a Convex backend (TypeScript), and a Python-based automated scraper for ingesting grocery data.
- Key directories:
  - `app/`: Expo/React Native frontend (tabs, screens, auth, premium, etc.)
  - `convex/`: Convex backend functions, schema, and integrations
  - `automated_scraper/`: Python scripts for scraping and ingesting grocery data

## Architecture & Data Flow
- **Frontend** communicates with Convex backend via generated API clients (`convex/_generated/api.js`/`api.d.ts`).
- **Automated Scraper** (Python) fetches data from grocery sites, writes to Google Sheets, and ingests to Convex via REST API (`PRHRAN_INGEST_URL`).
- **Convex** handles user auth, shopping lists, coupons, and premium features. Auth uses `better-auth` and supports email/password, device fingerprinting, and family plans.

## Developer Workflows
- **Frontend:**
  - Start: `npx expo start`
  - Lint: `npx eslint .`
  - Typecheck: `npx tsc`
- **Backend (Convex):**
  - Dev server: `npx convex dev`
  - Regenerate API: `npx convex dev` (auto-regenerates `_generated/`)
- **Scraper:**
  - Install: `pip install -r automated_scraper/requirements_automated.txt`
  - First run: `python automated_scraper/initial_scrape.py`
  - Daily update: `python automated_scraper/daily_update.py`
  - Playwright: `playwright install chromium`
- **Environment:**
  - Set secrets in `.env.local` or system env vars (see `GROCERY_SCANNER.md`)
  - GitHub Actions use secrets: `GOOGLE_CREDENTIALS`, `CONVEX_INGEST_TOKEN`, etc. (see `GITHUB_SETUP.md`)

## Project-Specific Conventions
- **Convex Functions:** Use `authQuery`/`authMutation` wrappers for access control.
- **Admin Emails:** Set via `ADMIN_EMAILS` env var or fallback list in `userProfiles.ts`.
- **Premium/Family:** Managed in Convex (`familyPlan.ts`, `premium.ts`).
- **Scraper:** Google API credentials in `automated_scraper/credentials.json` (not committed).
- **Testing:** No formal test suite; manual testing via scripts and Expo app.

## Integration & Patterns
- **External APIs:**
  - Google Sheets/Drive (Python scraper)
  - Convex REST ingest endpoint
  - Stripe (premium, see `IMPLEMENTATION_GUIDE.md`)
  - Resend (email, see `SECURITY.md`)
- **Cross-component:**
  - Scraper → Convex: via `PRHRAN_INGEST_URL`/`PRHRAN_INGEST_TOKEN`
  - Convex → Email: via Resend API

## References
- See `GROCERY_SCANNER.md`, `IMPLEMENTATION_GUIDE.md`, `SECURITY.md`, `GITHUB_SETUP.md`, and `automated_scraper/README_SETUP.md` for detailed setup and troubleshooting.

---

**If any section is unclear or missing, please provide feedback for further refinement.**
