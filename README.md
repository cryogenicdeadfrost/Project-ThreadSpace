# Project ThreadSpace

> **Graph-Native Identity Discovery & Shared Interest Mapping**

ThreadSpace is a premium, high-performance web application that visualizes social connections, shared interests, traits, and fandoms as a living, interactive knowledge graph. Users can create personalized identity cards, discover kindred spirits, and pull threads through a universe of shared connections.

---

## 🚀 Key Features

### 1. Interactive Physics-Based Graph Canvas
- High-fidelity **HTML5 Canvas** rendering engine for dynamic nodes and edge simulations.
- Adjustable physics attributes (damping, repulsion, spring gravity) optimized to settle quickly without visual jitter.
- Interactive **Chaining Mode** and shift-drag controls to explicitly draw relationship links between interest nodes.
- Responsive touch gesture controls (drag, zoom, reset) for seamless mobile browsing.

### 2. High-Speed Bulk DB Operations
- Optimized server-side operations using **Drizzle ORM** and **Neon serverless PostgreSQL**.
- Sequential iteration database queries have been refactored into batch selects and bulk inserts, accelerating card saving operations by **5x to 10x** (<150ms latency).

### 3. Autocomplete Autosearch with Query Cache
- Dynamic autocompletion for TV Shows, Movies, and Anime (via TVMaze API) and Songs/Artists (via iTunes Search API).
- Snappy **200ms debounce** limit for instant typing feedback.
- Local memory caching mechanism ensures backspacing or re-typing terms executes instantaneously without triggering new network requests.

### 4. Advanced Accessibility (a11y) Panel
A floating accessibility panel enables tailored viewing preferences:
- **Audio Assist (TTS)**: Leverages native browser `SpeechSynthesis` to read aloud selected nodes and tag operations.
- **Large Text Scaling**: Global typography scaling for visually impaired users.
- **High Contrast Theme**: Maximum readability mode with stark black backgrounds, white borders, and custom focus outlines.
- **Reduced Motion Toggles**: Instantly disables physical forces on the canvas to prevent motion-induced discomfort.
- **Light/Dark Mode Toggling**: Instantly changes colors from deep workspace dark mode to bright slate-grey light mode.

### 5. Secure Authentication & cookie persistence
- Integrates **Better Auth** supporting:
  - Password Sign-in/Sign-up.
  - Social OAuth (Google & GitHub).
  - Passwordless Magic Sign-in links.
- Set up with `rememberMe: true` cookie persistence on email password log-ins to prevent session timeouts.

---

## 🛠️ Technology Stack

- **Core**: Next.js 16.2 (App Router, Turbopack), React 19, TypeScript
- **Database**: Drizzle ORM, Neon PostgreSQL serverless
- **Authentication**: Better Auth
- **Animations**: Framer Motion / Motion
- **Styles**: Tailwind CSS v4, PostCSS

---

## ⚙️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL=your_neon_postgresql_connection_string
BETTER_AUTH_SECRET=your_auth_secret_key
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Apply Migrations
```bash
npx drizzle-kit migrate
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.
