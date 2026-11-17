# ThreadSpace

ThreadSpace is a social discovery app built around a simple idea: people are easier to understand through the things they connect with.

Create an identity card from your favourite shows, characters and traits. Explore those connections in a graph, search for familiar interests, and try a challenge link to see whether someone can find the profile behind a few clues.

## What it does

- **Identity cards** — create and edit a profile with a name, bio, avatar and selected interests.
- **Interactive graph** — explore nodes and relationships on a canvas, follow connections and build a traversal from selected interests.
- **Search and discovery** — look up nodes by name or slug and use them as starting points for graph exploration.
- **Challenge links** — choose three clues from your card and share a link that lets someone try to find it. Links expire after 72 hours.
- **Accounts** — sign in with email and password, Google or GitHub, or request a magic link.
- **Accessibility and themes** — use the accessibility panel for text scaling, contrast, speech and motion preferences, and switch between light and dark themes.

The graph also has a computation layer for TF-IDF vectors, co-occurrence analysis and clustering. It is an evolving part of the project, not a claim that every discovery path is already powered by a finished recommendation engine.

## Stack

- Next.js App Router, React and TypeScript
- PostgreSQL hosted on Neon
- Drizzle ORM and SQL migrations
- Better Auth
- React Flow and Motion
- Tailwind CSS

## Run locally

You will need Node.js, npm and a PostgreSQL database. The current database setup is configured for Neon.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   DATABASE_URL=your_postgresql_connection_string
   BETTER_AUTH_SECRET=your_auth_secret
   BETTER_AUTH_URL=http://localhost:3000
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   Add OAuth and email-provider credentials when using those sign-in options. The auth configuration reads `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` and `EMAIL_FROM`.

3. Apply the database migrations:

   ```bash
   npx drizzle-kit migrate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit generate` | Generate a migration from the Drizzle schema |
| `npx drizzle-kit migrate` | Apply pending migrations |
| `npx drizzle-kit studio` | Open Drizzle Studio |

## Project layout

```text
src/
  app/
    (auth)/       Login, registration and password reset
    actions/      Server Actions for cards, challenges and graph traversal
    api/          Auth, search and background-job endpoints
    card/         Identity card pages and editor
    challenge/    Shared challenge flow
    explore/      Graph explorer
  components/
    finder/       Search and traversal controls
    graph/        Graph canvas and shared graph state
    identity/     Identity and challenge UI
  lib/            Auth, database, schema and graph computations
drizzle/          SQL migrations and Drizzle metadata
public/           Static assets
```

## Notes

- Keep real credentials in local environment variables or your deployment's secret store. Do not commit `.env` files.
- The cron endpoint should be protected with `CRON_SECRET` in deployed environments.
- The finder currently includes a local sample dataset alongside the database search path. Treat the discovery UI as a work in progress rather than a fully live semantic search system.
- The SQL files and snapshots under `drizzle/` are migration history. Keep them in version control.

ThreadSpace is still being built. The graph is real; the roadmap is allowed to be less dramatic than the README used to be.
