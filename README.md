# Workman

**Study to be approved. — 2 Timothy 2:15**

Workman is a sermon preparation workspace for faithful pastors. It brings the lexicon, original languages, illustrations, and sermon archive into one focused place — so a pastor can spend their preparation time studying the Word rather than managing tools.

---

## What it is

- **Sermon editor** — outline, manuscript, and notes modes with auto-save and version history
- **Original language lexicon** — Hebrew, Aramaic, and Greek with Strong's concordance, interlinear view, and optional Logos integration
- **AI study assistant** — passage context, grammar explainers, cross-references, and commentary digests. Research and study only — Workman does not write sermons
- **Illustration library** — curated and personal illustrations, tagged by theme and tone
- **Sermon archive** — every sermon preserved and searchable, with a passage coverage map
- **Sermon import** — bring in existing sermons from .docx, .pages, .pdf, .txt, .rtf, or .zip
- **Bilingual** — full English (KJV) and Spanish (RVR60) support via a language toggle

---

## Scripture foundation

> *"Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth."*
> — 2 Timothy 2:15 (KJV)

---

## Tech stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Frontend     | Next.js 14, React, TypeScript, Tailwind CSS     |
| Editor       | Tiptap (ProseMirror)                            |
| Backend      | Node.js, Express, TypeScript                    |
| Database     | PostgreSQL 16 + Prisma ORM                      |
| Cache        | Redis 7                                         |
| Bible data   | KJV (public domain), RVR60 (public domain)      |
| Lexicon data | OSHB, SBLGNT, Strong's (open licensed)          |
| AI           | Anthropic Claude API                            |
| File storage | AWS S3                                          |
| Auth         | JWT (HttpOnly cookies)                          |
| i18n         | i18next                                         |
| Monorepo     | Turborepo                                       |
| Deployment   | Vercel (frontend), Railway (backend + DB)       |

---

## Project structure

```
workman/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Express backend
├── packages/
│   ├── database/     # Prisma schema + migrations + seeds
│   ├── bible-data/   # KJV, RVR60, lexicon JSON + import scripts
│   ├── ui/           # Shared React components
│   └── types/        # Shared TypeScript types
├── docker-compose.yml
├── turbo.json
└── .env.example
```

---

## Getting started (local development)

### Prerequisites

- Node.js 20+
- Docker Desktop
- `unoconv` (for .pages and .rtf import): `sudo apt-get install unoconv`

### 1. Clone and install

```bash
git clone https://github.com/your-org/workman.git
cd workman
npm install
```

### 2. Set up environment variables

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

Edit both files and fill in at minimum:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `ANTHROPIC_API_KEY`

### 3. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

### 4. Run database migrations

```bash
cd packages/database
npx prisma migrate dev
```

### 5. Seed the database

Download the required data files first:

**Bible texts:**
- KJV: https://github.com/aruljohn/Bible-kjv → save as `packages/bible-data/texts/kjv.json`
- RVR60: https://github.com/scrollmapper/bible_databases → save as `packages/bible-data/texts/rvr60.json`

**Lexicon:**
- Strong's Greek: https://github.com/openscriptures/strongs → save as `packages/bible-data/lexicon/strongs-greek.json`
- Strong's Hebrew: https://github.com/openscriptures/strongs → save as `packages/bible-data/lexicon/strongs-hebrew.json`
- OSHB: https://github.com/openscriptures/morphhb → save as `packages/bible-data/lexicon/oshb.json`
- SBLGNT: https://github.com/morphgnt/sblgnt → save as `packages/bible-data/lexicon/sblgnt.json`

Then run the seed scripts in order:

```bash
# Import Bible texts (KJV + RVR60)
npx ts-node packages/bible-data/scripts/import-texts.ts

# Seed Strong's concordance
npx ts-node packages/database/seed/strongs.ts

# Seed curated illustrations
npx ts-node packages/database/seed/illustrations.ts

# Validate everything
npx ts-node packages/bible-data/scripts/validate.ts
```

A passing validation report means the database is ready.

### 6. Start the development servers

```bash
# From the root — starts both api and web concurrently
npm run dev
```

Or individually:

```bash
# Backend (port 4000)
cd apps/api && npm run dev

# Frontend (port 3000)
cd apps/web && npm run dev
```

Open http://localhost:3000

---

## Build phases

| Phase | Focus                                         | Target   |
|-------|-----------------------------------------------|----------|
| 1     | Core loop — editor, archive, export           | 6–8 wks  |
| 2     | Lexicon — Hebrew, Aramaic, Greek, Logos       | 4–6 wks  |
| 3     | Illustrations, AI assistant, sermon import    | 5–7 wks  |
| 4     | Spanish mode, themes, polish, launch          | 4–5 wks  |

---

## Color themes

| Theme     | Base       | Accent     |
|-----------|------------|------------|
| Parchment | `#F8F7F4`  | `#C9A96E`  |
| Midnight  | `#16181C`  | `#7B8FBB`  |
| Linen     | `#F2EDE6`  | `#8B5E3C`  |
| Slate     | `#F4F6F8`  | `#3B5E8C`  |
| Olive     | `#F5F4EE`  | `#6B7A40`  |

Themes are applied via `data-theme` on the `<html>` element using CSS custom properties.

---

## Key design decisions

**AI guardrails** — The study assistant system prompt explicitly prohibits sermon writing, outline generation, and any form of sermon drafting. The restriction is enforced at the API level, not just in the UI. The disclaimer "Research and study only — Workman does not write sermons" is permanently visible in the assistant panel.

**KJV and RVR60 only** — All Scripture in the platform uses the 1611 KJV for English mode and the Reina-Valera 1960 for Spanish mode. Both translations are in the public domain and are hosted directly in the database.

**Latin American Spanish** — The Spanish interface uses neutral Latin American Spanish (no vosotros) to serve the broadest possible Spanish-speaking pastoral community.

**Import review queue** — Imported sermons never enter the archive automatically. Every file goes through a review queue where the pastor confirms metadata before anything is committed. Nothing is saved until the pastor explicitly approves it.

**Open lexicon first, Logos optional** — OSHB, SBLGNT, and Strong's are self-hosted open datasets that work for every pastor. Logos integration is an optional enhancement that unlocks deeper entries (BDAG, BDB, HALOT) for pastors with an active Logos license.

---

## Environment variables

See `.env.example` for all required and optional variables with descriptions.

**Required for Phase 1:**
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`

**Required before launch:**
- `AWS_*` (media storage), `LOGOS_*` (optional), `RESEND_API_KEY` (email)

**Required when billing launches:**
- `STRIPE_*`

---

## Domain

`theworkman.app`

---

*Built on 2 Timothy 2:15.*
