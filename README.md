# Wall

Wall is a small public message board built with Next.js, React, Tailwind CSS, shadcn/ui and Supabase. Visitors can post without signing in. Every post uses the shared display name **Anthony Mendoza**; that label is a product convention, not an authorship claim.

## Deployment

Production URL: <https://wall-anthony.vercel.app>

Source: <https://github.com/hakdogins27/wall> (private). Vercel project `wall-anthony` uses the free Hobby plan and deploys the `main` branch. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured in Vercel; `.env.local` stays outside Git.

Post editing/deletion credentials are browser- and origin-specific. Keys saved on localhost do not transfer automatically to the production domain.

## Run locally

Use Node.js 22.20.0 and npm 10.9 or newer.

```sh
npm ci
cp .env.example .env.local
```

Add a Supabase project URL and its public anon or publishable key to `.env.local`, then start the app:

```sh
npm run dev
```

Open <http://localhost:3000>. Without Supabase settings, the page shows an honest unavailable state and does not display sample posts or claim to save messages.

Follow [the Supabase setup guide](docs/setup.md) before adding credentials. The eight SQL migrations in `supabase/migrations/` are applied to the configured Wall project. For a new Supabase project, follow the setup guide and apply them in filename order.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The automated data tests use a mocked fetch transport with the Supabase JavaScript client. They cover requests and merge logic but do not verify live RLS, database persistence or a Realtime connection.

## Project notes

- [Setup and Supabase instructions](docs/setup.md)
- [React, SQL and Realtime learning guide](docs/learning-guide.md)
- [Submission and release checklist](docs/submission.md)
- [Approved implementation architecture](docs/architecture.md)
- [Approved design reference](docs/design.html)

Anonymous posting is intentionally open for this assessment. RLS protects the table shape and allowed operations, but it does not prevent spam or abusive content.
