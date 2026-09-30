<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Node.js 22 and npm are already available. Install with `npm ci` from the lockfile. The `postinstall` script copies the MapLibre worker into `public/maplibre/`.
- Start the site with `npm run dev` on port 3000. The homepage, `/properties`, and `/blog` load live listings and posts from `https://api.myacresapp.com/api`.
- Login, signup, and favorites read `NEXT_PUBLIC_FIREBASE_*` from `.env.example`. Put those values in `.env.local` when you need to exercise auth.
- `npm run build` is the production check. `npm run lint` currently fails on existing `react-hooks` findings in account, feed, favorites, header, and map code.
