# Video2PDF Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `video2pdf-site` from static HTML to a Next.js (App Router) app on Vercel with a role-aware analytics dashboard that aggregates App Store Connect, Google Play, PostHog, AppsFlyer, Meta, and TikTok data, while preserving the existing landing, privacy, and terms pages.

**Architecture:** Next.js App Router on Vercel, same domain (`video2pdf.ai`). Public marketing pages are ported to route segments. A `/login` page authenticates two env-seeded users (bcrypt + JWT in an httpOnly cookie). `middleware.ts` gates `/dashboard` and `/api/metrics/*`. Each provider is a server-only connector behind an `/api/metrics/<provider>` route that fetches, normalizes, caches in-memory with a TTL and "as of" stamp, and redacts admin-only fields (`mrr`, `arr`) for the marketing role before the response leaves the server. The dashboard client only ever calls its own API routes.

**Tech Stack:** Next.js 15 (App Router), React 18, TypeScript (strict), Tailwind CSS, Recharts, `jose` (JWT), `bcryptjs`, `vitest` + `@testing-library/react`.

## Global Constraints

- **No em dashes (—)** in any text: copy, comments, docs, commit messages, JSX, string literals. Use comma, colon, parentheses, or two sentences. En dashes (–) in numeric ranges are fine.
- **No commit attribution.** Never add `Co-Authored-By` or any attribution trailer to commits or PRs.
- **TypeScript strict mode.** No `any` without a comment explaining why.
- **Absolute imports** via `@/...` path alias.
- **Business logic lives in `lib/`** (services), not in React components or route handlers.
- **Never commit `.env*` files** with real secrets.
- **Brand tokens (from existing `index.html`):** primary teal `#0d9488`, primary-dark `#0b7c72`, primary-light `#34d399`, pro purple `#7c3aed`, bg `#0f172a`, bg-alt `#0b1120`, bg-card `#1e293b`, text `#f8fafc`, text-secondary `#94a3b8`, border `#334155`. Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif`.
- **Redaction is exactly two fields:** only `mrr` and `arr` are admin-only. Everything else (churn, ad spend, ROAS, subscriber counts, revenue detail) is visible to both roles.
- **Charts follow the dataviz skill** for color and accessibility in both light and dark.
- **Domain deploy caution:** `video2pdf.ai` is already live as a static site on Vercel. Do not change production DNS/build settings as part of any task; deploy verification is a manual step the user performs.

---

## File Structure

```
video2pdf-site/
├─ package.json                app deps + scripts
├─ next.config.mjs
├─ tsconfig.json               strict, @/* alias
├─ tailwind.config.ts          brand tokens
├─ postcss.config.mjs
├─ vitest.config.ts
├─ vitest.setup.ts
├─ middleware.ts               gate /dashboard + /api/metrics/*
├─ app/
│  ├─ layout.tsx               root layout, global styles
│  ├─ globals.css              Tailwind + brand CSS vars
│  ├─ page.tsx                 landing (port of index.html)
│  ├─ privacy/page.tsx         port of privacy/index.html
│  ├─ terms/page.tsx           port of terms/index.html
│  ├─ login/page.tsx           email + password form
│  ├─ dashboard/
│  │  ├─ page.tsx              role-aware dashboard (server component)
│  │  └─ components/           KpiTile, TrendChart, FunnelSection, AdSection, FreshnessLine, AwaitingCard
│  └─ api/
│     ├─ auth/login/route.ts
│     ├─ auth/logout/route.ts
│     └─ metrics/
│        ├─ appstore/route.ts
│        ├─ play/route.ts
│        ├─ posthog/route.ts
│        ├─ appsflyer/route.ts
│        ├─ meta/route.ts
│        └─ tiktok/route.ts
├─ lib/
│  ├─ auth.ts                  sign/verify JWT, seeded-user lookup, role gate
│  ├─ cache.ts                 in-memory TTL cache + asOf stamp
│  ├─ redact.ts                strip mrr/arr for marketing
│  ├─ types.ts                 shared metric/connector types
│  └─ connectors/
│     ├─ types.ts              ConnectorResult, ConnectorStatus
│     ├─ appstore.ts
│     ├─ play.ts
│     ├─ posthog.ts
│     ├─ appsflyer.ts
│     ├─ meta.ts
│     └─ tiktok.ts
├─ index.html                  KEEP until Task 3 ports it, then delete
├─ privacy/index.html          KEEP until Task 3
├─ terms/index.html            KEEP until Task 3
└─ assets/                      icon.png, bindy.png (served from /public after Task 1)
```

---

## Task 1: Next.js scaffold with brand tokens and preserved static pages

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `public/assets/icon.png`, `public/assets/bindy.png` (move from `assets/`)
- Test: `vitest.config.ts`, `vitest.setup.ts`, `app/__tests__/smoke.test.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable Next.js app; `@/*` path alias resolving to repo root; Tailwind classes bound to brand tokens (`bg-brand-bg`, `text-brand-text`, `bg-brand-primary`, etc.); a root layout other pages render into.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "video2pdf-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "recharts": "2.15.0",
    "jose": "5.9.6",
    "bcryptjs": "2.4.3"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "@types/node": "22.10.2",
    "@types/bcryptjs": "2.4.6",
    "tailwindcss": "3.4.17",
    "postcss": "8.4.49",
    "autoprefixer": "10.4.20",
    "vitest": "2.1.8",
    "@vitejs/plugin-react": "4.3.4",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "jsdom": "25.0.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated, `package-lock.json` created, no error exit.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 5: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `tailwind.config.ts` with brand tokens**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0d9488",
          "primary-dark": "#0b7c72",
          "primary-light": "#34d399",
          pro: "#7c3aed",
          bg: "#0f172a",
          "bg-alt": "#0b1120",
          "bg-card": "#1e293b",
          text: "#f8fafc",
          "text-secondary": "#94a3b8",
          border: "#334155",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Oxygen", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 7: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #0d9488;
  --primary-dark: #0b7c72;
  --primary-light: #34d399;
  --pro: #7c3aed;
  --bg: #0f172a;
  --bg-alt: #0b1120;
  --bg-card: #1e293b;
  --text: #f8fafc;
  --text-secondary: #94a3b8;
  --border: #334155;
}

body {
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 8: Create `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video2PDF: Film Any Book, Get a Searchable PDF",
  description:
    "Film any textbook, note, or handout and get a searchable, shareable PDF in seconds. Meet Bindy, your bookworm guide.",
  icons: { icon: "/assets/icon.png", apple: "/assets/icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Move image assets into `public/`**

Run: `mkdir -p public/assets && git mv assets/icon.png public/assets/icon.png && git mv assets/bindy.png public/assets/bindy.png`
Expected: files tracked under `public/assets/`.

- [ ] **Step 10: Create a placeholder `app/page.tsx`** (full landing port happens in Task 3; this proves the build)

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center">
      <h1 className="text-2xl font-bold text-brand-primary">Video2PDF</h1>
    </main>
  );
}
```

- [ ] **Step 11: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 12: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 13: Write the smoke test `app/__tests__/smoke.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the brand name", () => {
    render(<HomePage />);
    expect(screen.getByText("Video2PDF")).toBeInTheDocument();
  });
});
```

- [ ] **Step 14: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 15: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, `/` route listed in output.

- [ ] **Step 16: Add `.next` and env files to `.gitignore`**

Append to `.gitignore`:

```
.next
next-env.d.ts
.env
.env.local
```

- [ ] **Step 17: Commit**

```bash
git add package.json package-lock.json next.config.mjs tsconfig.json tailwind.config.ts postcss.config.mjs app lib public vitest.config.ts vitest.setup.ts .gitignore
git commit -m "Scaffold Next.js app with brand tokens and smoke test"
```

---

## Task 2: Shared types, in-memory TTL cache, and redaction

**Files:**
- Create: `lib/types.ts`, `lib/cache.ts`, `lib/redact.ts`, `lib/connectors/types.ts`
- Test: `lib/__tests__/cache.test.ts`, `lib/__tests__/redact.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces:
  - `lib/connectors/types.ts`: `type ConnectorStatus = "ok" | "awaiting_credentials" | "error"`; `interface ConnectorResult<T> { data: T | null; asOf: string | null; status: ConnectorStatus; error?: string }`.
  - `lib/types.ts`: `interface Metrics { downloads?: number; dau?: number; paidSubs?: number; arpu?: number; churnRate?: number; mrr?: number; arr?: number; adSpend?: number; roas?: number; [k: string]: unknown }` and `type Role = "admin" | "marketing"`.
  - `lib/cache.ts`: `getCached<T>(key: string): { value: T; asOf: string } | null`; `setCached<T>(key: string, value: T, ttlMs?: number): string` (returns the asOf ISO stamp); `clearCache(): void`.
  - `lib/redact.ts`: `redactForRole<T extends Record<string, unknown>>(data: T, role: Role): T` (removes `mrr` and `arr` when role is `"marketing"`).

- [ ] **Step 1: Write the failing test `lib/__tests__/redact.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { redactForRole } from "@/lib/redact";

describe("redactForRole", () => {
  const payload = { downloads: 100, churnRate: 0.05, mrr: 5000, arr: 60000 };

  it("removes mrr and arr for marketing", () => {
    const out = redactForRole(payload, "marketing");
    expect(out).not.toHaveProperty("mrr");
    expect(out).not.toHaveProperty("arr");
    expect(out.downloads).toBe(100);
    expect(out.churnRate).toBe(0.05);
  });

  it("keeps mrr and arr for admin", () => {
    const out = redactForRole(payload, "admin");
    expect(out.mrr).toBe(5000);
    expect(out.arr).toBe(60000);
  });

  it("does not mutate the input", () => {
    redactForRole(payload, "marketing");
    expect(payload.mrr).toBe(5000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/__tests__/redact.test.ts`
Expected: FAIL, cannot resolve `@/lib/redact`.

- [ ] **Step 3: Create `lib/types.ts`**

```ts
export type Role = "admin" | "marketing";

export interface Metrics {
  downloads?: number;
  dau?: number;
  paidSubs?: number;
  arpu?: number;
  churnRate?: number;
  mrr?: number;
  arr?: number;
  adSpend?: number;
  roas?: number;
  [key: string]: unknown;
}
```

- [ ] **Step 4: Create `lib/redact.ts`**

```ts
import type { Role } from "@/lib/types";

const ADMIN_ONLY_FIELDS = ["mrr", "arr"] as const;

export function redactForRole<T extends Record<string, unknown>>(data: T, role: Role): T {
  if (role === "admin") return { ...data };
  const copy = { ...data };
  for (const field of ADMIN_ONLY_FIELDS) {
    delete copy[field];
  }
  return copy;
}
```

- [ ] **Step 5: Run the redact test to verify it passes**

Run: `npx vitest run lib/__tests__/redact.test.ts`
Expected: PASS, 3 tests passed.

- [ ] **Step 6: Write the failing test `lib/__tests__/cache.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getCached, setCached, clearCache } from "@/lib/cache";

describe("cache", () => {
  beforeEach(() => clearCache());

  it("returns null for a missing key", () => {
    expect(getCached("nope")).toBeNull();
  });

  it("stores and retrieves a value with an asOf stamp", () => {
    const asOf = setCached("k", { n: 1 });
    const hit = getCached<{ n: number }>("k");
    expect(hit?.value.n).toBe(1);
    expect(hit?.asOf).toBe(asOf);
    expect(new Date(asOf).toString()).not.toBe("Invalid Date");
  });

  it("expires an entry after its ttl", () => {
    setCached("k", { n: 1 }, 0);
    expect(getCached("k")).toBeNull();
  });
});
```

- [ ] **Step 7: Run the cache test to verify it fails**

Run: `npx vitest run lib/__tests__/cache.test.ts`
Expected: FAIL, cannot resolve `@/lib/cache`.

- [ ] **Step 8: Create `lib/cache.ts`**

```ts
interface Entry {
  value: unknown;
  asOf: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const store = new Map<string, Entry>();

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): string {
  const now = Date.now();
  const asOf = new Date(now).toISOString();
  store.set(key, { value, asOf, expiresAt: now + ttlMs });
  return asOf;
}

export function getCached<T>(key: string): { value: T; asOf: string } | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { value: entry.value as T, asOf: entry.asOf };
}

export function clearCache(): void {
  store.clear();
}
```

- [ ] **Step 9: Create `lib/connectors/types.ts`**

```ts
export type ConnectorStatus = "ok" | "awaiting_credentials" | "error";

export interface ConnectorResult<T> {
  data: T | null;
  asOf: string | null;
  status: ConnectorStatus;
  error?: string;
}
```

- [ ] **Step 10: Run all lib tests to verify they pass**

Run: `npx vitest run lib`
Expected: PASS, 6 tests passed (3 redact + 3 cache).

- [ ] **Step 11: Commit**

```bash
git add lib
git commit -m "Add shared types, TTL cache, and role redaction"
```

---

## Task 3: Port landing, privacy, and terms pages; remove static HTML

**Files:**
- Modify: `app/page.tsx` (replace placeholder with full landing port)
- Create: `app/privacy/page.tsx`, `app/terms/page.tsx`
- Delete: `index.html`, `privacy/index.html`, `terms/index.html`
- Test: `app/__tests__/pages.test.tsx`

**Interfaces:**
- Consumes: root layout and brand tokens from Task 1.
- Produces: three public routes (`/`, `/privacy`, `/terms`) rendering the existing content. No new exported symbols other than default page components.

- [ ] **Step 1: Read the existing static HTML to port its content**

Run: `cat index.html privacy/index.html terms/index.html`
Expected: full markup printed; note the landing sections (hero, features, pricing, footer), the store links, and the full privacy/terms copy.

- [ ] **Step 2: Write the failing test `app/__tests__/pages.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HomePage from "@/app/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("public pages", () => {
  it("landing shows the hero headline", () => {
    render(<HomePage />);
    expect(screen.getByText(/searchable/i)).toBeInTheDocument();
  });
  it("privacy shows a privacy heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /privacy/i })).toBeInTheDocument();
  });
  it("terms shows a terms heading", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { name: /terms/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run app/__tests__/pages.test.tsx`
Expected: FAIL, cannot resolve `@/app/privacy/page` and `@/app/terms/page`.

- [ ] **Step 4: Port the landing page into `app/page.tsx`**

Translate `index.html`'s `<body>` content to JSX in `app/page.tsx`. Rules:
- Move the inline `<style>` rules into Tailwind classes using the brand tokens, or keep them as a scoped `<style jsx global>` block if a rule has no clean Tailwind equivalent (keep it verbatim, just wrapped).
- Replace `class=` with `className=`, `for=` with `htmlFor=`, self-close void elements.
- Keep the store-link `href` values exactly as they are in the current HTML (placeholders included).
- Reference images as `/assets/icon.png` and `/assets/bindy.png`.
- Preserve all copy verbatim (do not introduce em dashes).
- Ensure the hero contains the word "searchable" so the test matches (it is in the current headline).

- [ ] **Step 5: Port privacy into `app/privacy/page.tsx`**

Translate `privacy/index.html` body to JSX the same way. Ensure there is a heading element whose text includes "Privacy".

- [ ] **Step 6: Port terms into `app/terms/page.tsx`**

Translate `terms/index.html` body to JSX the same way. Ensure there is a heading element whose text includes "Terms".

- [ ] **Step 7: Run the pages test to verify it passes**

Run: `npx vitest run app/__tests__/pages.test.tsx`
Expected: PASS, 3 tests passed.

- [ ] **Step 8: Delete the static HTML files**

Run: `git rm index.html privacy/index.html terms/index.html`
Expected: three files staged for deletion.

- [ ] **Step 9: Verify the build and full test suite**

Run: `npm run build && npm test`
Expected: build lists `/`, `/privacy`, `/terms`; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add app package-lock.json
git commit -m "Port landing, privacy, and terms to Next.js pages"
```

---

## Task 4: Auth library (JWT sign/verify, seeded-user login, role)

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/__tests__/auth.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: `Role` from `lib/types.ts`.
- Produces:
  - `interface SessionPayload { email: string; role: Role }`.
  - `async function verifyCredentials(email: string, password: string): Promise<SessionPayload | null>` (checks against env-seeded users, bcrypt-compares the password).
  - `async function signSession(payload: SessionPayload): Promise<string>` (JWT via `jose`, 7-day expiry, `JWT_SECRET`).
  - `async function verifySession(token: string): Promise<SessionPayload | null>` (returns null on invalid/expired).
  - `const SESSION_COOKIE = "v2p_session"`.

- [ ] **Step 1: Create `.env.example`**

```
JWT_SECRET=replace-with-a-long-random-string
ADMIN_EMAIL=admin@video2pdf.ai
ADMIN_PASSWORD_HASH=$2a$10$examplebcrypthashadmin
MARKETING_EMAIL=marketing@video2pdf.ai
MARKETING_PASSWORD_HASH=$2a$10$examplebcrypthashmarketing
```

- [ ] **Step 2: Write the failing test `lib/__tests__/auth.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { verifyCredentials, signSession, verifySession } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.ADMIN_EMAIL = "admin@video2pdf.ai";
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("adminpass", 10);
  process.env.MARKETING_EMAIL = "marketing@video2pdf.ai";
  process.env.MARKETING_PASSWORD_HASH = bcrypt.hashSync("mktpass", 10);
});

describe("auth", () => {
  it("verifies admin credentials and assigns the admin role", async () => {
    const s = await verifyCredentials("admin@video2pdf.ai", "adminpass");
    expect(s).toEqual({ email: "admin@video2pdf.ai", role: "admin" });
  });

  it("verifies marketing credentials and assigns the marketing role", async () => {
    const s = await verifyCredentials("marketing@video2pdf.ai", "mktpass");
    expect(s?.role).toBe("marketing");
  });

  it("rejects a wrong password", async () => {
    const s = await verifyCredentials("admin@video2pdf.ai", "wrong");
    expect(s).toBeNull();
  });

  it("rejects an unknown email", async () => {
    const s = await verifyCredentials("nobody@video2pdf.ai", "x");
    expect(s).toBeNull();
  });

  it("signs and verifies a session round-trip", async () => {
    const token = await signSession({ email: "admin@video2pdf.ai", role: "admin" });
    const payload = await verifySession(token);
    expect(payload).toEqual({ email: "admin@video2pdf.ai", role: "admin" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ email: "admin@video2pdf.ai", role: "admin" });
    expect(await verifySession(token + "tamper")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/__tests__/auth.test.ts`
Expected: FAIL, cannot resolve `@/lib/auth`.

- [ ] **Step 4: Create `lib/auth.ts`**

```ts
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/types";

export const SESSION_COOKIE = "v2p_session";

export interface SessionPayload {
  email: string;
  role: Role;
}

interface SeededUser {
  email: string | undefined;
  hash: string | undefined;
  role: Role;
}

function seededUsers(): SeededUser[] {
  return [
    { email: process.env.ADMIN_EMAIL, hash: process.env.ADMIN_PASSWORD_HASH, role: "admin" },
    { email: process.env.MARKETING_EMAIL, hash: process.env.MARKETING_PASSWORD_HASH, role: "marketing" },
  ];
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function verifyCredentials(email: string, password: string): Promise<SessionPayload | null> {
  const user = seededUsers().find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.hash) return null;
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) return null;
  return { email: user.email as string, role: user.role };
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email = payload.email;
    const role = payload.role;
    if (typeof email !== "string") return null;
    if (role !== "admin" && role !== "marketing") return null;
    return { email, role };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the auth test to verify it passes**

Run: `npx vitest run lib/__tests__/auth.test.ts`
Expected: PASS, 6 tests passed.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts lib/__tests__/auth.test.ts .env.example
git commit -m "Add auth library: seeded-user login and JWT sessions"
```

---

## Task 5: Login and logout API routes + login page

**Files:**
- Create: `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/login/page.tsx`
- Test: `app/api/auth/__tests__/login.test.ts`

**Interfaces:**
- Consumes: `verifyCredentials`, `signSession`, `SESSION_COOKIE` from `lib/auth.ts`.
- Produces: `POST /api/auth/login` (JSON `{ email, password }` → sets httpOnly cookie, returns `{ role }` or 401); `POST /api/auth/logout` (clears cookie, returns 200); a `/login` client page that posts to the login route and redirects to `/dashboard`.

- [ ] **Step 1: Write the failing test `app/api/auth/__tests__/login.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/auth/login/route";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.ADMIN_EMAIL = "admin@video2pdf.ai";
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("adminpass", 10);
});

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("sets a session cookie on valid credentials", async () => {
    const res = await POST(req({ email: "admin@video2pdf.ai", password: "adminpass" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("v2p_session=");
    const json = await res.json();
    expect(json.role).toBe("admin");
  });

  it("returns 401 on a wrong password", async () => {
    const res = await POST(req({ email: "admin@video2pdf.ai", password: "wrong" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/auth/__tests__/login.test.ts`
Expected: FAIL, cannot resolve `@/app/api/auth/login/route`.

- [ ] **Step 3: Create `app/api/auth/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import { verifyCredentials, signSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  const session = await verifyCredentials(body.email, body.password);
  if (!session) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = await signSession(session);
  const res = NextResponse.json({ role: session.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
```

- [ ] **Step 4: Create `app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 5: Run the login test to verify it passes**

Run: `npx vitest run app/api/auth/__tests__/login.test.ts`
Expected: PASS, 2 tests passed.

- [ ] **Step 6: Create `app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError("Invalid email or password.");
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-brand-bg-card border border-brand-border rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-bold text-brand-primary">Video2PDF Dashboard</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-brand-bg-alt border border-brand-border px-3 py-2 text-brand-text"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-brand-bg-alt border border-brand-border px-3 py-2 text-brand-text"
          required
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-primary px-3 py-2 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Verify build and full suite**

Run: `npm run build && npm test`
Expected: build lists `/login` and the two auth API routes; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/auth app/login
git commit -m "Add login and logout routes and the login page"
```

---

## Task 6: Middleware gating for /dashboard and /api/metrics

**Files:**
- Create: `middleware.ts`
- Test: `__tests__/middleware.test.ts`

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE` from `lib/auth.ts`.
- Produces: `middleware.ts` with a `config.matcher` for `/dashboard/:path*` and `/api/metrics/:path*`; unauthenticated page requests redirect to `/login`, unauthenticated API requests return 401.

- [ ] **Step 1: Write the failing test `__tests__/middleware.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
});

function reqFor(path: string, token?: string): NextRequest {
  const url = `http://localhost${path}`;
  const headers = new Headers();
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new NextRequest(url, { headers });
}

describe("middleware", () => {
  it("redirects an unauthenticated dashboard request to /login", async () => {
    const res = await middleware(reqFor("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 for an unauthenticated metrics API request", async () => {
    const res = await middleware(reqFor("/api/metrics/appstore"));
    expect(res.status).toBe(401);
  });

  it("allows an authenticated dashboard request through", async () => {
    const token = await signSession({ email: "admin@video2pdf.ai", role: "admin" });
    const res = await middleware(reqFor("/dashboard", token));
    // NextResponse.next() has no redirect location and a 200 status.
    expect(res.headers.get("location")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/middleware.test.ts`
Expected: FAIL, cannot resolve `@/middleware`.

- [ ] **Step 3: Create `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set("x-user-role", session.role);
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/metrics/:path*"],
};
```

- [ ] **Step 4: Run the middleware test to verify it passes**

Run: `npx vitest run __tests__/middleware.test.ts`
Expected: PASS, 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts __tests__/middleware.test.ts
git commit -m "Gate dashboard and metrics routes with session middleware"
```

---

## Task 7: Connector modules (all six providers, shared shape)

**Files:**
- Create: `lib/connectors/appstore.ts`, `lib/connectors/play.ts`, `lib/connectors/posthog.ts`, `lib/connectors/appsflyer.ts`, `lib/connectors/meta.ts`, `lib/connectors/tiktok.ts`
- Test: `lib/connectors/__tests__/connectors.test.ts`

**Interfaces:**
- Consumes: `ConnectorResult`, `ConnectorStatus` from `lib/connectors/types.ts`; `getCached`, `setCached` from `lib/cache.ts`; `Metrics` from `lib/types.ts`.
- Produces: each module exports `async function fetchMetrics(): Promise<ConnectorResult<Metrics>>` and a pure `function normalize(raw: unknown): Metrics`. When the provider's required env var(s) are missing, `fetchMetrics` returns `{ data: null, asOf: null, status: "awaiting_credentials" }` WITHOUT calling the network. Required env vars per provider:
  - appstore: `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY`
  - play: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
  - posthog: `POSTHOG_API_KEY`, `POSTHOG_HOST`
  - appsflyer: `APPSFLYER_API_TOKEN`
  - meta: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`
  - tiktok: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`

**Note on scope:** This task delivers the connector CONTRACT and normalization with the awaiting-credentials path fully working and tested. The live network fetch for each provider is stubbed behind a `fetchRaw()` that is only called when credentials are present; wiring each provider's real endpoint is done when its credentials arrive (no code change to the route or dashboard, per the spec). Each `normalize` is written to a documented response shape and unit-tested against a representative mock.

- [ ] **Step 1: Write the failing test `lib/connectors/__tests__/connectors.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";
import * as appstore from "@/lib/connectors/appstore";
import * as posthog from "@/lib/connectors/posthog";
import * as meta from "@/lib/connectors/meta";

const ALL_ENV = [
  "APPSTORE_KEY_ID", "APPSTORE_ISSUER_ID", "APPSTORE_PRIVATE_KEY",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "POSTHOG_API_KEY", "POSTHOG_HOST",
  "APPSFLYER_API_TOKEN",
  "META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID",
  "TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID",
];

beforeEach(() => {
  clearCache();
  for (const k of ALL_ENV) delete process.env[k];
});

describe("connectors: awaiting-credentials path", () => {
  it("appstore returns awaiting_credentials with no keys", async () => {
    const r = await appstore.fetchMetrics();
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
    expect(r.asOf).toBeNull();
  });

  it("posthog returns awaiting_credentials with no keys", async () => {
    const r = await posthog.fetchMetrics();
    expect(r.status).toBe("awaiting_credentials");
  });
});

describe("connectors: normalize", () => {
  it("meta.normalize maps spend and roas from a raw insights row", () => {
    const raw = { data: [{ spend: "120.50", purchase_roas: [{ value: "3.2" }], impressions: "1000", clicks: "40" }] };
    const m = meta.normalize(raw);
    expect(m.adSpend).toBeCloseTo(120.5);
    expect(m.roas).toBeCloseTo(3.2);
  });

  it("posthog.normalize maps dau from a trends result", () => {
    const raw = { result: [{ data: [10, 20, 30], count: 60 }] };
    const m = posthog.normalize(raw);
    expect(m.dau).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/connectors/__tests__/connectors.test.ts`
Expected: FAIL, cannot resolve the connector modules.

- [ ] **Step 3: Create `lib/connectors/appstore.ts`**

```ts
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:appstore";

function hasCredentials(): boolean {
  return Boolean(
    process.env.APPSTORE_KEY_ID &&
      process.env.APPSTORE_ISSUER_ID &&
      process.env.APPSTORE_PRIVATE_KEY,
  );
}

export function normalize(raw: unknown): Metrics {
  // App Store Connect Sales/Subscription report rows. Wired when credentials arrive.
  const r = raw as { downloads?: number; proceeds?: number; paidSubs?: number } | null;
  return {
    downloads: r?.downloads ?? 0,
    paidSubs: r?.paidSubs ?? 0,
    mrr: r?.proceeds ?? 0,
    arr: r?.proceeds ? r.proceeds * 12 : 0,
  };
}

async function fetchRaw(): Promise<unknown> {
  // Real App Store Connect API call is wired when credentials are provided.
  throw new Error("appstore fetch not yet wired");
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Create `lib/connectors/play.ts`**

```ts
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:play";

function hasCredentials(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { installs?: number; revenue?: number; paidSubs?: number } | null;
  return {
    downloads: r?.installs ?? 0,
    paidSubs: r?.paidSubs ?? 0,
    mrr: r?.revenue ?? 0,
    arr: r?.revenue ? r.revenue * 12 : 0,
  };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("play fetch not yet wired");
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 5: Create `lib/connectors/posthog.ts`**

```ts
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:posthog";

function hasCredentials(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { result?: Array<{ data?: number[]; count?: number }> } | null;
  const series = r?.result?.[0]?.data ?? [];
  const dau = series.length ? series[series.length - 1] : 0;
  return { dau };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("posthog fetch not yet wired");
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 6: Create `lib/connectors/appsflyer.ts`**

```ts
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:appsflyer";

function hasCredentials(): boolean {
  return Boolean(process.env.APPSFLYER_API_TOKEN);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { installs?: number; cost?: number } | null;
  const installs = r?.installs ?? 0;
  const cost = r?.cost ?? 0;
  return { downloads: installs, adSpend: cost };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("appsflyer fetch not yet wired");
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 7: Create `lib/connectors/meta.ts`**

```ts
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:meta";

function hasCredentials(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export function normalize(raw: unknown): Metrics {
  const row = (raw as { data?: Array<Record<string, unknown>> } | null)?.data?.[0];
  const spend = row ? Number(row.spend ?? 0) : 0;
  const roasArr = row?.purchase_roas as Array<{ value?: string }> | undefined;
  const roas = roasArr?.[0]?.value ? Number(roasArr[0].value) : 0;
  const impressions = row ? Number(row.impressions ?? 0) : 0;
  const clicks = row ? Number(row.clicks ?? 0) : 0;
  return { adSpend: spend, roas, impressions, clicks };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("meta fetch not yet wired");
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 8: Create `lib/connectors/tiktok.ts`**

```ts
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:tiktok";

function hasCredentials(): boolean {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID);
}

export function normalize(raw: unknown): Metrics {
  const metrics = (raw as { data?: { list?: Array<{ metrics?: Record<string, unknown> }> } } | null)
    ?.data?.list?.[0]?.metrics;
  const spend = metrics ? Number(metrics.spend ?? 0) : 0;
  const impressions = metrics ? Number(metrics.impressions ?? 0) : 0;
  const clicks = metrics ? Number(metrics.clicks ?? 0) : 0;
  return { adSpend: spend, impressions, clicks };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("tiktok fetch not yet wired");
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 9: Run the connectors test to verify it passes**

Run: `npx vitest run lib/connectors/__tests__/connectors.test.ts`
Expected: PASS, 4 tests passed.

- [ ] **Step 10: Commit**

```bash
git add lib/connectors
git commit -m "Add six provider connectors with awaiting-credentials path and normalize"
```

---

## Task 8: Metrics API routes (role-aware, redacted)

**Files:**
- Create: `app/api/metrics/appstore/route.ts`, `app/api/metrics/play/route.ts`, `app/api/metrics/posthog/route.ts`, `app/api/metrics/appsflyer/route.ts`, `app/api/metrics/meta/route.ts`, `app/api/metrics/tiktok/route.ts`
- Create: `lib/session-role.ts` (reads role from request cookie server-side)
- Test: `app/api/metrics/__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: each connector's `fetchMetrics`; `verifySession`, `SESSION_COOKIE` from `lib/auth.ts`; `redactForRole` from `lib/redact.ts`.
- Produces: `lib/session-role.ts` exporting `async function roleFromRequest(request: Request): Promise<Role | null>`. Each metrics route exports `GET(request)` returning `{ status, asOf, data }` where `data` is redacted for the marketing role. A marketing response never contains `mrr` or `arr`.

- [ ] **Step 1: Write the failing test `app/api/metrics/__tests__/metrics.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { clearCache } from "@/lib/cache";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  // Provide appstore creds so it returns data (fetchRaw throws -> status error, but redaction still must apply to any data).
});

beforeEach(() => clearCache());

async function getWithRole(routePost: (r: Request) => Promise<Response>, role: "admin" | "marketing") {
  const token = await signSession({ email: "x@video2pdf.ai", role });
  const req = new Request("http://localhost/api/metrics/appstore", {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
  return routePost(req);
}

describe("metrics route redaction", () => {
  it("marketing never receives mrr or arr even when present in connector data", async () => {
    const { GET } = await import("@/app/api/metrics/appstore/route");
    // Force the connector to yield data with mrr/arr via a cache seed.
    const { setCached } = await import("@/lib/cache");
    process.env.APPSTORE_KEY_ID = "x";
    process.env.APPSTORE_ISSUER_ID = "x";
    process.env.APPSTORE_PRIVATE_KEY = "x";
    setCached("connector:appstore", { downloads: 10, mrr: 500, arr: 6000 });
    const res = await getWithRole(GET, "marketing");
    const json = await res.json();
    expect(json.data).not.toHaveProperty("mrr");
    expect(json.data).not.toHaveProperty("arr");
    expect(json.data.downloads).toBe(10);
  });

  it("admin receives mrr and arr", async () => {
    const { GET } = await import("@/app/api/metrics/appstore/route");
    const { setCached } = await import("@/lib/cache");
    process.env.APPSTORE_KEY_ID = "x";
    process.env.APPSTORE_ISSUER_ID = "x";
    process.env.APPSTORE_PRIVATE_KEY = "x";
    setCached("connector:appstore", { downloads: 10, mrr: 500, arr: 6000 });
    const res = await getWithRole(GET, "admin");
    const json = await res.json();
    expect(json.data.mrr).toBe(500);
    expect(json.data.arr).toBe(6000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/metrics/__tests__/metrics.test.ts`
Expected: FAIL, cannot resolve `@/app/api/metrics/appstore/route`.

- [ ] **Step 3: Create `lib/session-role.ts`**

```ts
import type { Role } from "@/lib/types";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export async function roleFromRequest(request: Request): Promise<Role | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await verifySession(token);
  return session?.role ?? null;
}
```

- [ ] **Step 4: Create a shared route helper and the appstore route `app/api/metrics/appstore/route.ts`**

```ts
import { NextResponse } from "next/server";
import { fetchMetrics } from "@/lib/connectors/appstore";
import { roleFromRequest } from "@/lib/session-role";
import { redactForRole } from "@/lib/redact";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await fetchMetrics();
  const data = result.data ? redactForRole(result.data as Record<string, unknown>, role) : null;
  return NextResponse.json({ status: result.status, asOf: result.asOf, data });
}
```

- [ ] **Step 5: Create the other five routes**

Create `app/api/metrics/play/route.ts`, `posthog/route.ts`, `appsflyer/route.ts`, `meta/route.ts`, `tiktok/route.ts`. Each is identical to Step 4 except the connector import path. For example `app/api/metrics/meta/route.ts`:

```ts
import { NextResponse } from "next/server";
import { fetchMetrics } from "@/lib/connectors/meta";
import { roleFromRequest } from "@/lib/session-role";
import { redactForRole } from "@/lib/redact";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await fetchMetrics();
  const data = result.data ? redactForRole(result.data as Record<string, unknown>, role) : null;
  return NextResponse.json({ status: result.status, asOf: result.asOf, data });
}
```

Repeat verbatim for `play` (import `@/lib/connectors/play`), `posthog` (`@/lib/connectors/posthog`), `appsflyer` (`@/lib/connectors/appsflyer`), and `tiktok` (`@/lib/connectors/tiktok`).

- [ ] **Step 6: Run the metrics test to verify it passes**

Run: `npx vitest run app/api/metrics/__tests__/metrics.test.ts`
Expected: PASS, 2 tests passed.

- [ ] **Step 7: Verify build and full suite**

Run: `npm run build && npm test`
Expected: build lists all six `/api/metrics/*` routes; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/metrics lib/session-role.ts
git commit -m "Add role-aware, redacted metrics API routes for all providers"
```

---

## Task 9: Dashboard UI (server page + client components)

**Files:**
- Create: `app/dashboard/page.tsx`, `app/dashboard/components/DashboardClient.tsx`, `app/dashboard/components/KpiTile.tsx`, `app/dashboard/components/TrendChart.tsx`, `app/dashboard/components/AwaitingCard.tsx`, `app/dashboard/components/FreshnessLine.tsx`, `app/dashboard/components/AdSection.tsx`
- Create: `lib/chart-theme.ts` (dataviz palette)
- Test: `app/dashboard/components/__tests__/kpi.test.tsx`, `app/dashboard/components/__tests__/awaiting.test.tsx`

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE` (via `next/headers` cookies) to read the role server-side; the `/api/metrics/*` routes client-side; `Role` from `lib/types.ts`.
- Produces:
  - `KpiTile({ label, value, freshness }: { label: string; value: string; freshness?: string })`.
  - `AwaitingCard({ provider }: { provider: string })` rendering a "Connect <provider>" placeholder with the text "Awaiting credentials".
  - `FreshnessLine({ asOf, source }: { asOf: string | null; source: string })` rendering "as of <time> · <source>" (use a middot, not an em dash).
  - `TrendChart` and `AdSection` using Recharts with the `lib/chart-theme.ts` palette.
  - `DashboardClient({ role }: { role: Role })` fetching all six routes and laying out KPI row, trends, funnel, ad section. Admin-only MRR tile is rendered ONLY when `role === "admin"`.
  - `app/dashboard/page.tsx` is a server component that reads the role from the cookie and passes it to `DashboardClient`.

- [ ] **Step 1: Write the failing test `app/dashboard/components/__tests__/kpi.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KpiTile from "@/app/dashboard/components/KpiTile";

describe("KpiTile", () => {
  it("renders label and value", () => {
    render(<KpiTile label="Downloads" value="1,234" />);
    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing test `app/dashboard/components/__tests__/awaiting.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AwaitingCard from "@/app/dashboard/components/AwaitingCard";

describe("AwaitingCard", () => {
  it("prompts to connect the named provider", () => {
    render(<AwaitingCard provider="TikTok" />);
    expect(screen.getByText(/awaiting credentials/i)).toBeInTheDocument();
    expect(screen.getByText(/TikTok/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run app/dashboard/components/__tests__`
Expected: FAIL, cannot resolve the components.

- [ ] **Step 4: Create `lib/chart-theme.ts`**

```ts
// Palette derived from the site's brand tokens, validated for dark-background contrast.
export const CHART_COLORS = {
  primary: "#0d9488",
  primaryLight: "#34d399",
  pro: "#7c3aed",
  grid: "#334155",
  axis: "#94a3b8",
  series: ["#34d399", "#0d9488", "#7c3aed", "#f59e0b", "#38bdf8"],
};
```

- [ ] **Step 5: Create `app/dashboard/components/KpiTile.tsx`**

```tsx
export default function KpiTile({
  label,
  value,
  freshness,
}: {
  label: string;
  value: string;
  freshness?: string;
}) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="text-sm text-brand-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-bold text-brand-text">{value}</div>
      {freshness ? <div className="mt-2 text-xs text-brand-text-secondary">{freshness}</div> : null}
    </div>
  );
}
```

- [ ] **Step 6: Create `app/dashboard/components/AwaitingCard.tsx`**

```tsx
export default function AwaitingCard({ provider }: { provider: string }) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-dashed border-brand-border p-4">
      <div className="text-sm font-semibold text-brand-text">Connect {provider}</div>
      <div className="mt-1 text-xs text-brand-text-secondary">Awaiting credentials</div>
    </div>
  );
}
```

- [ ] **Step 7: Create `app/dashboard/components/FreshnessLine.tsx`**

```tsx
export default function FreshnessLine({ asOf, source }: { asOf: string | null; source: string }) {
  const when = asOf ? new Date(asOf).toLocaleString() : "no data yet";
  return (
    <div className="text-xs text-brand-text-secondary">
      as of {when} · {source}
    </div>
  );
}
```

- [ ] **Step 8: Run the KPI and awaiting tests to verify they pass**

Run: `npx vitest run app/dashboard/components/__tests__`
Expected: PASS, 2 tests passed.

- [ ] **Step 9: Create `app/dashboard/components/TrendChart.tsx`**

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";

export interface TrendPoint {
  label: string;
  value: number;
}

export default function TrendChart({ title, data }: { title: string; data: TrendPoint[] }) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={CHART_COLORS.axis} fontSize={12} />
          <YAxis stroke={CHART_COLORS.axis} fontSize={12} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }}
          />
          <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primaryLight} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 10: Create `app/dashboard/components/AdSection.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";

export interface ChannelSpend {
  channel: string;
  spend: number;
  roas: number;
}

export default function AdSection({ data }: { data: ChannelSpend[] }) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">Ad performance</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="channel" stroke={CHART_COLORS.axis} fontSize={12} />
          <YAxis stroke={CHART_COLORS.axis} fontSize={12} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }}
          />
          <Bar dataKey="spend" fill={CHART_COLORS.primary} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 11: Create `app/dashboard/components/DashboardClient.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import KpiTile from "./KpiTile";
import AwaitingCard from "./AwaitingCard";
import FreshnessLine from "./FreshnessLine";
import TrendChart from "./TrendChart";
import AdSection from "./AdSection";

interface MetricResponse {
  status: "ok" | "awaiting_credentials" | "error";
  asOf: string | null;
  data: Record<string, number> | null;
}

const PROVIDERS = ["appstore", "play", "posthog", "appsflyer", "meta", "tiktok"] as const;
type Provider = (typeof PROVIDERS)[number];
const PROVIDER_LABEL: Record<Provider, string> = {
  appstore: "App Store",
  play: "Google Play",
  posthog: "PostHog",
  appsflyer: "AppsFlyer",
  meta: "Meta",
  tiktok: "TikTok",
};

export default function DashboardClient({ role }: { role: Role }) {
  const [metrics, setMetrics] = useState<Record<Provider, MetricResponse | null>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p, null])) as Record<Provider, MetricResponse | null>,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PROVIDERS.map((p) =>
        fetch(`/api/metrics/${p}`)
          .then((r) => r.json() as Promise<MetricResponse>)
          .then((res) => [p, res] as const)
          .catch(() => [p, { status: "error", asOf: null, data: null } as MetricResponse] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setMetrics(Object.fromEntries(entries) as Record<Provider, MetricResponse | null>);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function num(p: Provider, key: string): number | undefined {
    const d = metrics[p]?.data;
    return d && typeof d[key] === "number" ? d[key] : undefined;
  }

  const downloads = (num("appstore", "downloads") ?? 0) + (num("play", "downloads") ?? 0);
  const dau = num("posthog", "dau");
  const mrr = (num("appstore", "mrr") ?? 0) + (num("play", "mrr") ?? 0);

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand-primary">Analytics</h1>
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-brand-text-secondary underline" formAction="/api/auth/logout">
              Sign out
            </button>
          </form>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Downloads" value={downloads.toLocaleString()} />
          <KpiTile label="DAU" value={dau != null ? dau.toLocaleString() : "n/a"} />
          <KpiTile label="Paid subscribers" value={(num("appstore", "paidSubs") ?? 0).toLocaleString()} />
          <KpiTile label="Ad spend" value={`$${(num("meta", "adSpend") ?? 0).toLocaleString()}`} />
          {role === "admin" ? <KpiTile label="MRR" value={`$${mrr.toLocaleString()}`} /> : null}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <TrendChart title="Downloads over time" data={[]} />
          <TrendChart title="DAU over time" data={[]} />
        </section>

        <AdSection
          data={[
            { channel: "Meta", spend: num("meta", "adSpend") ?? 0, roas: num("meta", "roas") ?? 0 },
            { channel: "TikTok", spend: num("tiktok", "adSpend") ?? 0, roas: 0 },
          ]}
        />

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PROVIDERS.filter((p) => metrics[p]?.status === "awaiting_credentials").map((p) => (
            <AwaitingCard key={p} provider={PROVIDER_LABEL[p]} />
          ))}
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => (
            <FreshnessLine key={p} asOf={metrics[p]?.asOf ?? null} source={PROVIDER_LABEL[p]} />
          ))}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Create `app/dashboard/page.tsx` (server component)**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import DashboardClient from "./components/DashboardClient";

export default async function DashboardPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");
  return <DashboardClient role={session.role} />;
}
```

- [ ] **Step 13: Run the component tests to verify they pass**

Run: `npx vitest run app/dashboard/components/__tests__`
Expected: PASS, 2 tests passed.

- [ ] **Step 14: Verify build and full suite**

Run: `npm run build && npm test`
Expected: build lists `/dashboard`; all tests pass; no TypeScript errors.

- [ ] **Step 15: Commit**

```bash
git add app/dashboard lib/chart-theme.ts
git commit -m "Add role-aware dashboard UI with KPI tiles, charts, and freshness"
```

---

## Task 10: Integration test, README, and env documentation

**Files:**
- Create: `app/api/metrics/__tests__/integration.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the login route and a metrics route end to end.
- Produces: an integration test proving a marketing session's `/api/metrics/appstore` response omits `mrr`/`arr`; updated README documenting local dev, env vars, and the deploy note.

- [ ] **Step 1: Write the integration test `app/api/metrics/__tests__/integration.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { clearCache, setCached } from "@/lib/cache";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as appstoreGet } from "@/app/api/metrics/appstore/route";
import { SESSION_COOKIE } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.MARKETING_EMAIL = "marketing@video2pdf.ai";
  process.env.MARKETING_PASSWORD_HASH = bcrypt.hashSync("mktpass", 10);
  process.env.APPSTORE_KEY_ID = "x";
  process.env.APPSTORE_ISSUER_ID = "x";
  process.env.APPSTORE_PRIVATE_KEY = "x";
});

beforeEach(() => {
  clearCache();
  setCached("connector:appstore", { downloads: 42, mrr: 999, arr: 11988 });
});

function cookieFromSetCookie(setCookie: string): string {
  return setCookie.split(";")[0];
}

describe("marketing end-to-end redaction", () => {
  it("logs in as marketing and gets a redacted appstore payload", async () => {
    const loginRes = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "marketing@video2pdf.ai", password: "mktpass" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);

    const metricsRes = await appstoreGet(
      new Request("http://localhost/api/metrics/appstore", {
        headers: { cookie: cookieFromSetCookie(setCookie) },
      }),
    );
    const json = await metricsRes.json();
    expect(json.data.downloads).toBe(42);
    expect(json.data).not.toHaveProperty("mrr");
    expect(json.data).not.toHaveProperty("arr");
  });
});
```

- [ ] **Step 2: Run the integration test to verify it passes**

Run: `npx vitest run app/api/metrics/__tests__/integration.test.ts`
Expected: PASS, 1 test passed.

- [ ] **Step 3: Rewrite `README.md`**

```markdown
# video2pdf.ai

Next.js (App Router) site for Video2PDF: public marketing pages plus a role-aware internal analytics dashboard.

## Pages

- `/` landing
- `/privacy` privacy policy
- `/terms` terms of service
- `/login` dashboard sign-in
- `/dashboard` role-aware analytics (admin, marketing)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Generate a bcrypt hash for a password:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" "yourpassword"
```

## Environment variables

Auth: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `MARKETING_EMAIL`, `MARKETING_PASSWORD_HASH`.

Connectors (each optional; a missing one shows an "awaiting credentials" card):
- App Store Connect: `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY`
- Google Play: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- PostHog: `POSTHOG_API_KEY`, `POSTHOG_HOST`
- AppsFlyer: `APPSFLYER_API_TOKEN`
- Meta: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`
- TikTok: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`

## Roles

Only MRR and ARR are admin-only. Everything else is visible to both admin and marketing. Redaction happens server-side in the metrics API routes.

## Testing

```bash
npm test
```

## Deploy

Vercel, same project and domain (`video2pdf.ai`). Set all environment variables in the Vercel project settings. The first deploy converts the output from a static site to a Next.js build, so verify the domain serves correctly before and after.
```

- [ ] **Step 4: Run the full suite one last time**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass across every task.

- [ ] **Step 5: Commit**

```bash
git add app/api/metrics/__tests__/integration.test.ts README.md
git commit -m "Add end-to-end redaction integration test and update README"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (Task 1, 3), auth and roles (Task 4, 5, 6), role metric split / redaction (Task 2, 8, 10), connectors and awaiting-credentials/error/ok statuses (Task 7), caching with asOf (Task 2, 7), dashboard UI with brand tokens + Recharts + freshness (Task 9), secrets via env (Task 4, 10 README), testing including the marketing integration assertion (Task 2, 4, 8, 10). All spec sections map to a task.
- **Deferred by design (per spec "ships today vs after credentials"):** each connector's live network `fetchRaw` is wired when its credentials arrive; the contract, normalize, caching, redaction, and awaiting-credentials rendering all ship and are tested now.
- **Type consistency:** `ConnectorResult<T>`, `Metrics`, `Role`, `SessionPayload`, `fetchMetrics`, `normalize`, `redactForRole`, `verifySession`, `SESSION_COOKIE`, `roleFromRequest` are named identically everywhere they appear.
- **Em dashes:** none. The one KPI fallback uses `"n/a"`.
