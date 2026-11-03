# Project rules - Jewellery Variation Studio
- Follow PLAN.md.
- TypeScript everywhere. Frontend: Vite + React + Tailwind CSS. Backend: Node + Express.
- The OpenAI API key lives only in server/.env. Never import it in the client, log it or send it to the browser.
- Model names, image size, quality and parallel limit come from server/.env, never hard-coded.
- One React component per file in client/src/components; keep each file short.
- Validate every request and every model reply on the server with zod and return clear JSON errors.
- After each milestone run npm run build and npm run lint, fix all errors, then test the flow in the browser.
- Never commit .env, uploads or generated images; keep them in .gitignore.
