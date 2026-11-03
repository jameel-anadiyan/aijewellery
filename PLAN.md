# Jewellery Variation Studio — Antigravity Build Plan
**Oct 23, 2026 · SWA Diamonds**

Build a React web app where you upload one jewellery photo, type the diamond count, and get back 10 new design sketches, each on its own card with a name, description and specs, ready to download. Antigravity builds it from this plan in 7 milestones, and your OpenAI key stays on a small Node server.

## How the app works
1. **Upload**: drop a product photo (JPG, PNG or WebP, up to 10 MB) and enter the diamond count. Optional: SKU, stone size, metal and notes on what must stay the same.
2. **Analyse**: the server sends the photo and count to an OpenAI text model. It studies the design and returns 10 variation concepts as JSON: name, description, stone layout, setting, size estimate and an image prompt.
3. **Generate**: the server makes 10 separate GPT Image 2.5 requests, each with your photo as the reference and one concept's prompt. It runs 3 at a time, and each card fills in as its image arrives.
4. **Review**: each card shows the sketch, name, description, stone count and specs. Regenerate any card, or star the best ones.
5. **Download**: save a single PNG, or download the starred or all cards as a ZIP with a CSV of names and descriptions.
6. Every prompt repeats the exact diamond count you entered. Image models can still add or drop a stone, so check each card before downloading.
7. **Close Cluster & Rhodium Gap Fill**: When ticked in the upload panel, prompts enforce tight cluster or line cluster seating with bright white rhodium plating filling all diamond gaps to create an unbroken, seamless diamond surface.

## Tech stack and architecture
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Node.js 20+ with Express and TypeScript
- **Uploads**: multer (memory storage)
- **Validation**: zod (Checks inputs and the model's JSON reply)
- **OpenAI**: Official `openai` npm package (Responses/Chat API for planning, Images API for sketches)
- **Parallel calls**: `p-limit` (Caps image calls at 3 at once)
- **Downloads**: `jszip` + `file-saver` (Builds the ZIP and CSV in the browser)
- **Saved results**: IndexedDB (`idb-keyval`) + Supabase Cloud History
- **Dev runner**: `concurrently` (npm run dev starts client and server together)

## Server Environment Variables
```env
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-6-luna
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst
IMAGE_QUALITY=medium
IMAGE_SIZE=1024x1024
IMAGE_FORMAT=png
MAX_PARALLEL=3
PORT=8787
SUPABASE_URL=https://eylkbycxhptmmqcpvloz.supabase.co
SUPABASE_ANON_KEY=
```

## Backend API Endpoints
- `GET /api/health`: `{ ok: true }`
- `POST /api/analyze`: Multipart form (`image`, `diamondCount`, `countFor`, `sku`, `stoneSize`, `metal`, `mustKeep`) -> `{ jobId, original, variations: [...] }`
- `POST /api/generate`: JSON (`jobId`, `index`, `quality`) -> `{ index, imageBase64 }`
- `GET /api/history`: Returns saved runs
