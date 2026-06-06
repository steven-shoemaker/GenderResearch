# Gender Research

Personal app to analyze job descriptions for masculine/feminine coded language. Data and PDFs are stored in **Vercel Blob** (cloud), not only in the browser.

## Design docs

- [`docs/design/conceptual-model.md`](docs/design/conceptual-model.md)
- [`docs/design/interaction-flow.md`](docs/design/interaction-flow.md)
- [`docs/design/surface.md`](docs/design/surface.md)

## Storage

| Data | Location |
|------|----------|
| Entries (JSON) | Blob `gender-research/entries.json` |
| Word list (JSON) | Blob `gender-research/lexicon.json` |
| PDF attachments | Blob `gender-research/attachments/{entryId}/…` |

Analysis still runs in the browser; only persistence uses the API.

## Repository

https://github.com/steven-shoemaker/GenderResearch

```bash
git clone https://github.com/steven-shoemaker/GenderResearch.git
cd GenderResearch
npm install
```

## Local development

1. Link the project on [Vercel](https://vercel.com) and create a **Blob** store (Storage tab).
2. Pull env vars:

```bash
npm install
npx vercel link
npx vercel env pull .env.local
```

3. Run the full stack (Vite + API routes):

```bash
npm run dev
```

Open the URL `vercel dev` prints (usually http://localhost:3000).

Frontend-only (no API / no blob): `npm run dev:vite` — saves will fail without the API.

## Deploy to Vercel

1. Push to GitHub and import in Vercel, **or** run `npx vercel --prod`.
2. In the project → **Storage** → connect **Blob**.
3. Redeploy so `BLOB_READ_WRITE_TOKEN` is set.

Build settings (auto-detected for Vite):

- Build command: `npm run build` (generates self-contained API routes, then Vite)
- Output directory: `dist`

`vercel.json` rewrites non-API routes to `index.html` for client routing.

Share the production URL with your wife — entries and PDFs are shared for everyone using that deployment (no login). For a private deployment, use Vercel authentication or add an API key later.

## Usage

1. **New entry** → paste text → **Analyze** → optional PDF (uploads on **Save entry**).
2. **Import** → search [Fantastic.jobs](https://fantastic.jobs/api) → select postings → import with analysis and industry metadata (requires `FANTASTIC_JOBS_API_KEY`).
3. **Save entry** — stays on the saved view; data written to Blob.
4. **Word list** → edit → **Save word list** → **Recompute entry** on older postings.
5. **Entries** — search, open, download PDF, archive, delete.
