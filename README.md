# Acres Web

Public website for [Acres](https://myacresapp.com), built with Next.js and TypeScript. It uses the same Firebase Auth project and MongoDB property API as the mobile app.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Firebase web config (the same project as the mobile app: `acres-7f955`).
2. Confirm Firebase Authentication → Authorized domains includes `localhost`.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The property feed defaults to `https://api.myacresapp.com/api`. Override with `NEXT_PUBLIC_API_BASE_URL` if you are pointing at a local API.

## What is included

- **Home** — server-rendered property grid from `GET /api/feed`
- **Login / Sign up** — Firebase email and password
- **Favorites** — Firestore `users/{uid}/favorites`, hydrated with `POST /api/properties/batch`
- **Blog** — MDX posts in `content/blog/`

## SEO

- Metadata, Open Graph, `robots.ts`, and `sitemap.ts`
- First page of listings is rendered in the HTML
- Blog posts are statically generated

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
