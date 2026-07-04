# Plan 1 — Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a running Next.js 15 + Supabase PWA where a user can sign up (email+password or Google), create or join a group with a 8-character code, and get approved by the group master. Data is isolated per group via Postgres Row Level Security.

**Architecture:** Next.js 15 App Router with server components + server actions. Supabase Cloud (Tokyo region) provides auth, Postgres, and RLS. Every tenant table carries `group_id` + RLS policies. Two Supabase projects: one for dev/prod, one dedicated to RLS integration tests. Testing pyramid: Vitest for unit/integration, Playwright for the golden path E2E.

**Tech Stack:**
- Next.js 15 (App Router) · React 19 · TypeScript 5
- Tailwind CSS 3 + shadcn/ui · Pretendard font
- Supabase (@supabase/ssr) · Postgres 15
- Zod (validation) · React Hook Form (forms)
- Vitest (unit + integration) · @testing-library/react · Playwright (E2E)
- npm as package manager · Node 20.x LTS

**Prerequisites (Sarah does these manually before starting):**
1. Node 20.x LTS installed (`node -v` → v20.x)
2. GitHub account (for later deployment)
3. Vercel account signed in with GitHub
4. Supabase account signed in with GitHub
5. Google Cloud Console account (only needed at Task 6 for OAuth)

## Global Constraints

- **Package manager**: npm only. No pnpm/yarn/bun.
- **Node version**: 20.x LTS. Later versions may work but this is pinned in `package.json` `engines`.
- **Language**: TypeScript strict mode. No `any`, no `@ts-ignore` without a written justification comment.
- **UI language**: Korean throughout (all user-facing strings). Code identifiers and file names in English.
- **Font**: Pretendard for Korean readability.
- **Mobile-first**: All CSS starts mobile, uses `sm:`/`md:` breakpoints for larger screens.
- **Row Level Security**: EVERY tenant table has `group_id uuid NOT NULL` + RLS enabled. Never disable RLS. Never use `SUPABASE_SERVICE_ROLE_KEY` from the browser.
- **Environment variables**: Only `NEXT_PUBLIC_*` variables are safe in browser bundles. `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- **Commits**: One task = one or more focused commits. Never mix "add feature" with "reformat 40 files".
- **Test-first**: Every task writes the test before the implementation.

---

## File Structure

Foundation phase creates the following. Later plans extend this — do not add students/attendance/calendar tables here.

```
목장관리/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Login/signup shell (no tab bar)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx
│   ├── (onboarding)/                 # Post-login, pre-group shell
│   │   ├── join/page.tsx
│   │   ├── new-group/page.tsx
│   │   ├── pending/page.tsx
│   │   └── layout.tsx
│   ├── (app)/                        # Full app shell with tab bar
│   │   ├── layout.tsx
│   │   ├── attendance/page.tsx       # Placeholder for Plan 3
│   │   ├── calendar/page.tsx         # Placeholder for Plan 5
│   │   ├── dashboard/page.tsx        # Placeholder for Plan 4
│   │   └── settings/
│   │       ├── page.tsx              # Settings hub
│   │       ├── teachers/page.tsx     # Approval queue + list (master)
│   │       └── group/page.tsx        # Group name + code regenerate
│   ├── privacy/page.tsx              # Public policy page
│   ├── auth/callback/route.ts        # Supabase OAuth callback
│   ├── actions/                      # Server actions
│   │   ├── auth.ts
│   │   ├── groups.ts
│   │   └── memberships.ts
│   ├── layout.tsx                    # Root layout (font + metadata)
│   ├── globals.css
│   ├── manifest.json                 # PWA manifest (minimal — full PWA in Plan 6)
│   └── icon.png                      # 목장 logo
├── components/
│   ├── ui/                           # shadcn/ui components (added as needed)
│   ├── tab-bar.tsx
│   ├── privacy-gate.tsx
│   └── logo.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server component + action client
│   │   ├── middleware.ts             # Session refresh helper
│   │   └── database.types.ts         # Generated types (do not hand-edit)
│   ├── join-code.ts
│   ├── memberships.ts                # Server-side membership helpers
│   ├── constants.ts                  # Enums (roles, statuses)
│   └── utils.ts                      # cn() helper for Tailwind
├── supabase/
│   ├── config.toml                   # Supabase CLI config
│   └── migrations/
│       ├── 20260703000001_foundation_tables.sql
│       └── 20260703000002_foundation_rls.sql
├── tests/
│   ├── unit/
│   │   └── join-code.test.ts
│   ├── integration/
│   │   ├── rls-isolation.test.ts
│   │   └── setup.ts                  # Loads TEST project env
│   └── e2e/
│       ├── foundation.spec.ts
│       └── helpers.ts
├── middleware.ts                     # Next.js session middleware
├── next.config.js
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── playwright.config.ts
├── vitest.config.ts
├── vercel.json
├── DEPLOY.md                         # Manual deployment steps
├── README.md
├── .env.example                      # (already exists — will be extended)
├── .env.local.example                # Template for local dev
└── .gitignore                        # (already exists)
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `lib/utils.ts`, `README.md`
- Modify: (none)
- Test: (no test needed for scaffold — verified by successful `npm run dev`)

**Interfaces:**
- Consumes: nothing (this is the first task)
- Produces: A runnable Next.js 15 app with Tailwind + shadcn/ui base, Pretendard font, and a Korean-language landing page

- [ ] **Step 1: Scaffold Next.js 15 into the existing directory**

The project directory already exists with `.gitignore`, `.env.example`, and `docs/`. Run `create-next-app` in the current directory:

```bash
cd C:\Users\Sarah\Documents\목장관리
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --no-eslint --use-npm
```

When prompted about existing files, answer **Yes to overwrite** for `.gitignore` — then restore our version. Or answer **No** and manually delete `create-next-app`'s conflicting files.

After it finishes:
- Restore our `.gitignore` if it got overwritten: `git checkout .gitignore`
- Verify `git status` shows new files added (`package.json`, `app/`, `next.config.js`, etc.) but our design spec and `.env.example` are untouched.

- [ ] **Step 2: Verify baseline runs**

Run:
```bash
npm run dev
```
Expected: Server starts on `http://localhost:3100` and shows the default Next.js welcome page. Stop with Ctrl+C.

- [ ] **Step 3: Pin Node engine and lock package manager**

Edit `package.json` — add these fields:

```json
{
  "engines": {
    "node": "20.x"
  },
  "packageManager": "npm@10.0.0"
}
```

- [ ] **Step 4: Install additional dependencies**

Run:
```bash
npm install @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test jsdom @types/node
```

Verify installations by checking `package.json` — the four groups above should all appear.

- [ ] **Step 5: Add Pretendard font**

Edit `app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "목장 관리",
  description: "교회 고등부 출석·일정·생일·학적부 관리",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-pretendard antialiased">{children}</body>
    </html>
  );
}
```

Edit `tailwind.config.ts` — add Pretendard font and pastel palette:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pretendard: ['"Pretendard Variable"', "Pretendard", "system-ui", "sans-serif"],
      },
      colors: {
        // 파스텔 목장 팔레트
        pasture: {
          50: "#F0F9F0",
          100: "#DCEEDC",
          500: "#A3D9A5", // 출석 (파스텔 초록)
          600: "#7FC181",
        },
        wheat: {
          50: "#FDF9E7",
          500: "#F5D97B", // 사유입력 (파스텔 노랑)
        },
        coral: {
          50: "#FEF0EE",
          500: "#F08A80", // 미확인 (산호색)
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Replace the default landing page with a Korean welcome**

Overwrite `app/page.tsx`:

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-pasture-50 p-6">
      <h1 className="text-4xl font-bold text-pasture-600">🐑 목장 관리</h1>
      <p className="text-center text-lg text-gray-700">
        교회 고등부 출석·일정·생일 관리
      </p>
      <div className="flex flex-col gap-3 pt-6 sm:flex-row">
        <Link
          href="/login"
          className="rounded-lg bg-pasture-500 px-8 py-3 text-center text-white shadow hover:bg-pasture-600"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border-2 border-pasture-500 px-8 py-3 text-center text-pasture-600 hover:bg-pasture-100"
        >
          가입하기
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Add `lib/utils.ts` (Tailwind cn helper)**

Create `lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Install its dependencies:
```bash
npm install clsx tailwind-merge
```

- [ ] **Step 8: Write a project README**

Create `README.md`:

```markdown
# 목장 관리

교회 고등부 출석·일정·생일·학적부 관리 앱.

## 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local 을 Supabase 값으로 채운 뒤:
npm run dev
```

http://localhost:3100 접속.

## 문서
- 설계: `docs/superpowers/specs/2026-07-03-mokjang-design.md`
- 배포: `DEPLOY.md`
```

- [ ] **Step 9: Verify build and commit**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

Then:
```bash
git add package.json package-lock.json tsconfig.json next.config.js tailwind.config.ts postcss.config.js app/ lib/ README.md
git commit -m "Scaffold Next.js 15 app with Tailwind, Pretendard, and 목장 palette"
```

---

### Task 2: Supabase project + client wrappers

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `supabase/config.toml`, `.env.local.example`
- Modify: `.env.example`
- Test: (verification via smoke test in Task 3)

**Interfaces:**
- Consumes: Nothing from earlier tasks (independent setup)
- Produces:
  - `createBrowserClient()` from `@/lib/supabase/client`
  - `createServerClient()` from `@/lib/supabase/server` (for server components + server actions)
  - Session-refresh middleware exported from `@/lib/supabase/middleware`
  - Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 1: (Manual) Create Supabase projects**

Sarah does this in a browser at https://supabase.com:

1. Create a new project — name: `mokjang-dev`, region: **Northeast Asia (Tokyo)**, database password: (save to password manager)
2. Create a second project for RLS tests — name: `mokjang-test`, same region

For each project note down (Settings → API):
- Project URL (e.g., `https://xxxxx.supabase.co`)
- `anon` public key
- `service_role` secret key ⚠️ never commit

- [ ] **Step 2: Fill `.env.local.example` and `.env.local`**

Create `.env.local.example`:

```env
# === Supabase (dev project) ===
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# === Supabase (test project — for RLS tests only) ===
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_ANON_KEY=eyJhbGciOi...
TEST_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3100
```

Copy to `.env.local` and fill in real values from Step 1. `.env.local` is gitignored.

Update the top-level `.env.example` (which already exists from the initial commit) to match this structure.

- [ ] **Step 3: Install Supabase CLI as dev dependency**

Run:
```bash
npm install -D supabase
```

Initialize the Supabase folder:
```bash
npx supabase init
```
Expected: Creates `supabase/config.toml` and `supabase/.gitignore`. Answer "N" when asked about generating VS Code settings.

Then link to the dev project (get the ref from the project URL — the `xxxxx` in `xxxxx.supabase.co`):
```bash
npx supabase link --project-ref your-dev-project-ref
```
Enter the database password when prompted.

- [ ] **Step 4: Create browser client wrapper**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 5: Create server client wrapper**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies() is read-only there.
            // Middleware handles session refresh so we can safely ignore.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 6: Create session-refresh middleware helper**

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
```

Create `middleware.ts` at the project root:

```ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 7: Create a temporary stub for database.types.ts**

`lib/supabase/database.types.ts` doesn't exist yet — Task 3 generates it. Create a stub so imports don't break:

```ts
export type Database = { public: { Tables: Record<string, never> } };
```

- [ ] **Step 8: Verify the app still builds**

Run:
```bash
npm run build
```
Expected: Build succeeds. If Supabase env vars are missing, you'll get a runtime error at request time, not build time — that's fine for now.

- [ ] **Step 9: Commit**

```bash
git add lib/supabase/ middleware.ts supabase/config.toml .env.local.example .env.example package.json package-lock.json
git commit -m "Add Supabase SSR client wrappers and session middleware"
```

Also verify `.env.local` is **NOT** staged (`.gitignore` covers it, but double-check with `git status`).

---

### Task 3: DB schema — Foundation tables

**Files:**
- Create: `supabase/migrations/20260703000001_foundation_tables.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated)
- Test: `tests/integration/setup.ts` (helpers, no test yet)

**Interfaces:**
- Consumes: Supabase client wrappers from Task 2
- Produces:
  - Tables: `groups`, `profiles`, `memberships`, `audit_log`
  - Enums: `role_type` (`master`|`editor`|`viewer`), `membership_status` (`pending`|`active`|`removed`)
  - Constants in `lib/constants.ts` mirroring the enums

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260703000001_foundation_tables.sql`:

```sql
-- === Foundation tables ===
-- No RLS in this migration — see 20260703000002_foundation_rls.sql

CREATE TYPE role_type AS ENUM ('master', 'editor', 'viewer');
CREATE TYPE membership_status AS ENUM ('pending', 'active', 'removed');

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  join_code text NOT NULL UNIQUE CHECK (join_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  avatar_url text,
  birthday_month int CHECK (birthday_month BETWEEN 1 AND 12),
  birthday_day int CHECK (birthday_day BETWEEN 1 AND 31),
  privacy_consent_at timestamptz,  -- NULL until user accepts privacy policy
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role role_type NOT NULL,
  status membership_status NOT NULL DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users(id),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_memberships_user_status ON memberships(user_id, status);
CREATE INDEX idx_memberships_group_status ON memberships(group_id, status);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,   -- e.g. 'member_approved', 'role_changed'
  target_id uuid,
  target_type text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_group_time ON audit_log(group_id, created_at DESC);

-- Auto-create profile row on new auth.users
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();
```

- [ ] **Step 2: Apply migration to dev project**

Run:
```bash
npx supabase db push
```
Expected: `Applying migration 20260703000001_foundation_tables.sql...` succeeds.

If it fails with "database is not empty", you can inspect the current state at the Supabase dashboard → Database → Tables. Fix drift manually or use `db reset --linked` (destroys data — only if you're sure).

- [ ] **Step 3: Apply migration to test project**

Temporarily point at the test project:
```bash
npx supabase link --project-ref your-test-project-ref
npx supabase db push
# Re-link back to dev
npx supabase link --project-ref your-dev-project-ref
```

- [ ] **Step 4: Generate TypeScript types**

Run:
```bash
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```
Expected: `lib/supabase/database.types.ts` now contains generated types (`Database.public.Tables.groups.Row`, etc.). Do NOT hand-edit — regenerate every time schema changes.

- [ ] **Step 5: Add role/status constants**

Create `lib/constants.ts`:

```ts
export const ROLES = {
  MASTER: "master",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const MEMBERSHIP_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  REMOVED: "removed",
} as const;
export type MembershipStatus =
  (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export const ROLE_LABELS_KO: Record<Role, string> = {
  master: "마스터",
  editor: "편집 교사",
  viewer: "조회 교사",
};
```

- [ ] **Step 6: Verify types compile**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/ lib/supabase/database.types.ts lib/constants.ts
git commit -m "Add foundation tables (groups, profiles, memberships, audit_log) and TS types"
```

---

### Task 4: RLS policies + isolation integration test

**Files:**
- Create: `supabase/migrations/20260703000002_foundation_rls.sql`, `tests/integration/rls-isolation.test.ts`, `tests/integration/setup.ts`, `vitest.config.ts`
- Modify: `package.json` (add test scripts)
- Test: `tests/integration/rls-isolation.test.ts`

**Interfaces:**
- Consumes: Tables from Task 3
- Produces:
  - RLS policies enforcing per-group isolation
  - Vitest configured with `test:integration` script pointing at the test Supabase project
  - Helper `createTestUser()` for use in later tasks' tests

- [ ] **Step 1: Write the failing test first**

Create `tests/integration/setup.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function adminClient() {
  return createClient<Database>(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export function anonClient(accessToken?: string) {
  return createClient<Database>(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
    },
  );
}

let counter = 0;

export async function createTestUser(): Promise<{
  userId: string;
  email: string;
  accessToken: string;
}> {
  const admin = adminClient();
  const email = `test-${Date.now()}-${counter++}@example.test`;
  const password = "TestPass!23";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const { data: session, error: signInErr } =
    await anonClient().auth.signInWithPassword({ email, password });
  if (signInErr || !session.session) throw signInErr ?? new Error("signIn failed");

  return {
    userId: data.user.id,
    email,
    accessToken: session.session.access_token,
  };
}

export async function cleanup() {
  const admin = adminClient();
  // Cascade deletes handle memberships/profiles via FK
  await admin.from("groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { data: users } = await admin.auth.admin.listUsers();
  for (const u of users?.users ?? []) {
    if (u.email?.startsWith("test-")) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}
```

Create `tests/integration/rls-isolation.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

describe("RLS: cross-group isolation", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("user in group A cannot read group B's rows", async () => {
    const admin = adminClient();
    const userA = await createTestUser();
    const userB = await createTestUser();

    const { data: groupA } = await admin
      .from("groups")
      .insert({ name: "A", join_code: "AAAA1111", created_by: userA.userId })
      .select()
      .single();
    const { data: groupB } = await admin
      .from("groups")
      .insert({ name: "B", join_code: "BBBB2222", created_by: userB.userId })
      .select()
      .single();

    await admin.from("memberships").insert([
      { group_id: groupA!.id, user_id: userA.userId, role: "master", status: "active" },
      { group_id: groupB!.id, user_id: userB.userId, role: "master", status: "active" },
    ]);

    // userA queries groups — should only see A
    const asUserA = anonClient(userA.accessToken);
    const { data: visibleToA } = await asUserA.from("groups").select("id, name");
    expect(visibleToA?.map((g) => g.name).sort()).toEqual(["A"]);

    // userA queries memberships — should only see own group's
    const { data: membershipsA } = await asUserA
      .from("memberships")
      .select("group_id");
    expect(membershipsA?.every((m) => m.group_id === groupA!.id)).toBe(true);
  });

  it("viewer cannot update groups (role guard)", async () => {
    const admin = adminClient();
    const user = await createTestUser();

    const { data: group } = await admin
      .from("groups")
      .insert({ name: "V", join_code: "VVVV9999", created_by: user.userId })
      .select()
      .single();
    await admin.from("memberships").insert({
      group_id: group!.id,
      user_id: user.userId,
      role: "viewer",
      status: "active",
    });

    const asUser = anonClient(user.accessToken);
    const { error } = await asUser
      .from("groups")
      .update({ name: "renamed" })
      .eq("id", group!.id);

    // RLS returns 0 rows (silent block) OR error — both are acceptable pass paths
    const { data: after } = await admin
      .from("groups")
      .select("name")
      .eq("id", group!.id)
      .single();
    expect(after?.name).toBe("V");
  });

  it("pending members cannot read group data", async () => {
    const admin = adminClient();
    const master = await createTestUser();
    const pending = await createTestUser();

    const { data: group } = await admin
      .from("groups")
      .insert({ name: "P", join_code: "PPPP3333", created_by: master.userId })
      .select()
      .single();
    await admin.from("memberships").insert([
      { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
      { group_id: group!.id, user_id: pending.userId, role: "viewer", status: "pending" },
    ]);

    const asPending = anonClient(pending.accessToken);
    const { data: visible } = await asPending.from("groups").select("id");
    expect(visible ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    env: {
      // Load from .env.local at test time
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Install dotenv loader:
```bash
npm install -D dotenv-cli
```

Add scripts to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "dotenv -e .env.local -- vitest run",
  "test:watch": "dotenv -e .env.local -- vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npm test tests/integration/rls-isolation.test.ts
```
Expected: **FAIL** — RLS not enabled yet, userA sees both groups (or the query throws because policies don't exist yet and RLS is disabled by default → all rows visible).

- [ ] **Step 4: Write the RLS migration**

Create `supabase/migrations/20260703000002_foundation_rls.sql`:

```sql
-- === Enable RLS on foundation tables ===
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- === Helper: is the user an active member of this group? ===
CREATE OR REPLACE FUNCTION is_active_member(gid uuid, uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE group_id = gid AND user_id = uid AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION user_role_in_group(gid uuid, uid uuid)
RETURNS role_type LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM memberships
  WHERE group_id = gid AND user_id = uid AND status = 'active'
  LIMIT 1;
$$;

-- === groups ===
CREATE POLICY "members read own groups"
  ON groups FOR SELECT
  USING (is_active_member(id, auth.uid()));

-- Anyone signed in can INSERT (needed for group creation); trigger sets them as master via memberships.
CREATE POLICY "signed-in users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "master can update group"
  ON groups FOR UPDATE
  USING (user_role_in_group(id, auth.uid()) = 'master');

-- No DELETE policy — groups are never deleted from the app (only archived, in a later plan).

-- === profiles ===
CREATE POLICY "read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "read profiles of groupmates"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = auth.uid() AND m1.status = 'active'
        AND m2.user_id = profiles.id AND m2.status IN ('active', 'pending')
    )
  );

CREATE POLICY "update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- === memberships ===
CREATE POLICY "read memberships in own groups"
  ON memberships FOR SELECT
  USING (
    user_id = auth.uid()  -- own memberships (any status)
    OR is_active_member(group_id, auth.uid())  -- others' if active in that group
  );

CREATE POLICY "join group (create pending membership for self)"
  ON memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Master creation path: user is creating a master membership for a group they just created
      (role = 'master' AND status = 'active'
       AND EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid()))
      OR
      -- Regular join path: self-inserting a pending membership
      (status = 'pending')
    )
  );

CREATE POLICY "master can update memberships in own group"
  ON memberships FOR UPDATE
  USING (user_role_in_group(group_id, auth.uid()) = 'master');

-- === audit_log ===
CREATE POLICY "read own group's audit log"
  ON audit_log FOR SELECT
  USING (group_id IS NULL OR is_active_member(group_id, auth.uid()));

-- Audit inserts happen from server actions (service role) or via triggers — no user INSERT policy.
```

- [ ] **Step 5: Apply migration to both projects**

```bash
# Dev project (currently linked)
npx supabase db push

# Test project
npx supabase link --project-ref your-test-project-ref
npx supabase db push

# Re-link back to dev
npx supabase link --project-ref your-dev-project-ref
```

- [ ] **Step 6: Run the test — expect PASS**

```bash
npm test tests/integration/rls-isolation.test.ts
```
Expected: All 3 tests pass.

If any test fails, read the RLS policy carefully against the specific query being blocked. Common causes: missing `SECURITY DEFINER` on helper functions, wrong `auth.uid()` context, forgetting that `INSERT` needs `WITH CHECK` not `USING`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260703000002_foundation_rls.sql tests/ vitest.config.ts package.json package-lock.json
git commit -m "Enable RLS on foundation tables and add cross-group isolation tests"
```

---

### Task 5: Auth — email + password + Google OAuth

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/auth/callback/route.ts`, `app/actions/auth.ts`
- Modify: `app/page.tsx` (link to /login, /signup)
- Test: `tests/unit/auth-schemas.test.ts`

**Interfaces:**
- Consumes: Supabase clients from Task 2, profile trigger from Task 3
- Produces:
  - `signUpEmailPassword({ email, password, displayName })` server action
  - `signInEmailPassword({ email, password })` server action
  - `signOut()` server action
  - `/login`, `/signup` pages
  - OAuth callback at `/auth/callback`

- [ ] **Step 1: (Manual) Configure Google OAuth in Supabase**

Sarah does these steps in browsers:

1. In Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://your-dev-project-ref.supabase.co/auth/v1/callback`
2. Copy Client ID and Client Secret
3. In Supabase dashboard → Authentication → Providers → Google → paste both, save
4. In Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `http://localhost:3100`
   - Additional Redirect URLs: `http://localhost:3100/auth/callback`, and later the Vercel URL

Also disable email confirmation for now to speed up dev:
- Authentication → Providers → Email → uncheck "Confirm email"

- [ ] **Step 2: Write validation schemas + unit tests first**

Create `tests/unit/auth-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signUpSchema, signInSchema } from "@/app/actions/auth";

describe("signUpSchema", () => {
  it("rejects invalid email", () => {
    expect(
      signUpSchema.safeParse({
        email: "notanemail",
        password: "GoodPass1!",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(false);
  });

  it("rejects password under 8 chars", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "Short1!",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(false);
  });

  it("rejects missing consent", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "GoodPass1!",
        displayName: "홍길동",
        consent: false,
      }).success,
    ).toBe(false);
  });

  it("accepts a valid payload", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "GoodPass1!",
        displayName: "홍길동",
        consent: true,
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test tests/unit/auth-schemas.test.ts
```
Expected: FAIL — `@/app/actions/auth` does not exist.

- [ ] **Step 4: Create the server actions and schemas**

Create `app/actions/auth.ts`:

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const signUpSchema = z.object({
  email: z.string().email("이메일 형식이 맞지 않습니다"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .regex(/[A-Za-z]/, "영문 포함 필요")
    .regex(/[0-9]/, "숫자 포함 필요"),
  displayName: z
    .string()
    .min(1, "이름을 입력해주세요")
    .max(50, "이름이 너무 깁니다"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "개인정보 처리 방침에 동의해주세요" }),
  }),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

export async function signUpEmailPassword(
  input: SignUpInput,
): Promise<{ error?: string }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인해주세요" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.displayName } },
  });
  if (error || !data.user) return { error: error?.message ?? "가입 실패" };

  // Record consent (profile row is created by DB trigger; update it)
  await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      privacy_consent_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  redirect("/join");
}

export async function signInEmailPassword(
  input: SignInInput,
): Promise<{ error?: string }> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: "입력을 확인해주세요" };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "이메일 또는 비밀번호가 올바르지 않습니다" };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInWithGoogle() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error || !data.url) return { error: error?.message ?? "구글 로그인 실패" };
  redirect(data.url);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/unit/auth-schemas.test.ts
```
Expected: All 4 tests pass.

- [ ] **Step 6: Create the OAuth callback route**

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=oauth`);
    }
  }
  return NextResponse.redirect(`${origin}/`);
}
```

- [ ] **Step 7: Build the auth layout and login page**

Create `app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-pasture-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🐑</div>
          <h1 className="text-2xl font-bold text-pasture-600">목장 관리</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
```

Create `app/(auth)/login/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  signInEmailPassword,
  signInWithGoogle,
} from "@/app/actions/auth";

export default function LoginPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await signInEmailPassword({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="mb-6 text-xl font-semibold">로그인</h2>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border py-3 hover:bg-gray-50"
        >
          <span>🇬</span> 구글로 시작하기
        </button>
      </form>

      <div className="mb-4 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        <span>또는</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">이메일</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">비밀번호</span>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-coral-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600 disabled:opacity-50"
        >
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-pasture-600 underline">
          가입하기
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Build the signup page**

Create `app/(auth)/signup/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signUpEmailPassword } from "@/app/actions/auth";

export default function SignupPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await signUpEmailPassword({
        displayName: formData.get("displayName") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        consent: formData.get("consent") === "on" ? true : (false as never),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="mb-6 text-xl font-semibold">가입하기</h2>

      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">이름</span>
          <input
            name="displayName"
            required
            maxLength={50}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">이메일</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">비밀번호 (8자 이상, 영문+숫자)</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" required className="mt-1" />
          <span>
            <Link href="/privacy" className="text-pasture-600 underline">
              개인정보 처리 방침
            </Link>
            에 동의합니다
          </span>
        </label>
        {error && <p className="text-sm text-coral-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600 disabled:opacity-50"
        >
          {isPending ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-pasture-600 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 9: Smoke test the flow manually**

Run `npm run dev`, navigate to http://localhost:3100/signup, create an account. Then http://localhost:3100/login and sign in. Verify:

1. Signup succeeds and redirects to `/join` (which will 404 for now — Task 7 creates it)
2. Login succeeds and redirects to `/` landing page
3. Refresh — session persists

Google login: click "구글로 시작하기" and complete OAuth. Verify it redirects back through `/auth/callback` to `/`.

Fix any bugs before continuing.

- [ ] **Step 10: Commit**

```bash
git add app/actions/ app/\(auth\)/ app/auth/ tests/unit/
git commit -m "Add email/password + Google OAuth auth with consent gating"
```

---

### Task 6: Privacy consent + policy page

**Files:**
- Create: `app/privacy/page.tsx`, `components/privacy-gate.tsx`
- Modify: (none)
- Test: (manual smoke test — the consent field is exercised by Task 5's tests)

**Interfaces:**
- Consumes: `profiles.privacy_consent_at` from Task 3, signup flow from Task 5
- Produces: `/privacy` public page; `<PrivacyGate />` component for later layouts

- [ ] **Step 1: Create the privacy policy page**

Create `app/privacy/page.tsx`:

```tsx
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-pasture-600 underline">
        ← 홈
      </Link>
      <h1 className="mt-4 text-2xl font-bold">개인정보 처리 방침</h1>
      <p className="mt-2 text-sm text-gray-500">최종 개정일: 2026-07-03</p>

      <section className="mt-8 space-y-6 text-gray-700">
        <div>
          <h2 className="text-lg font-semibold">1. 수집 항목</h2>
          <ul className="ml-6 mt-2 list-disc">
            <li>가입 시: 이름, 이메일, 비밀번호(암호화 저장)</li>
            <li>선택: 생년월일(월/일)</li>
            <li>학생 정보(교사가 입력): 이름, 학년, 반, 생일, 본인/보호자 연락처</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold">2. 이용 목적</h2>
          <p>교회 그룹의 출석 관리 · 일정 공유 · 생일 알림 · 결석자 연락.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">3. 보관 및 파기</h2>
          <p>
            탈퇴 요청 시 개인 프로필 정보는 즉시 삭제합니다. 학생 정보는 교사가
            직접 삭제할 수 있으며, 소프트 삭제 후 30일이 지나면 완전 삭제됩니다.
            출석 이력의 감사 기록은 익명화되어 유지될 수 있습니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">4. 접근 통제</h2>
          <p>
            연락처 등 민감 정보는 편집 권한 교사에게만 완전 노출되며, 조회 권한
            교사에게는 마스킹 처리됩니다. 다른 그룹의 데이터는 원천 차단됩니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">5. 미성년자 정보</h2>
          <p>
            학생 개인정보 등록 시 보호자 동의를 반드시 확인해주세요. 앱은 최소
            수집 원칙에 따라 기능에 필요한 필드만 저장합니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">6. 문의</h2>
          <p>hyunkyu18@gmail.com</p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create the PrivacyGate component (used in later layouts)**

Create `components/privacy-gate.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export async function PrivacyGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("privacy_consent_at")
    .eq("id", user.id)
    .single();

  if (!profile?.privacy_consent_at) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-semibold">개인정보 동의 필요</h1>
          <p className="mt-3 text-sm text-gray-700">
            서비스를 계속 이용하려면{" "}
            <Link href="/privacy" className="text-pasture-600 underline">
              개인정보 처리 방침
            </Link>
            에 동의해주세요.
          </p>
          <form action="/api/consent" method="post" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600"
            >
              동의합니다
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

Create `app/api/consent/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));

  await supabase
    .from("profiles")
    .update({ privacy_consent_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
}
```

- [ ] **Step 3: Verify manually**

`npm run dev`, sign in with a Google account (which never went through the signup form's consent checkbox). Navigate to `/privacy` — should render the policy. Later tasks that use `<PrivacyGate>` will show the consent page for OAuth users.

- [ ] **Step 4: Commit**

```bash
git add app/privacy/ app/api/consent/ components/privacy-gate.tsx
git commit -m "Add privacy policy page and PrivacyGate component"
```

---

### Task 7: Group creation flow

**Files:**
- Create: `lib/join-code.ts`, `app/actions/groups.ts`, `app/(onboarding)/layout.tsx`, `app/(onboarding)/new-group/page.tsx`, `tests/unit/join-code.test.ts`
- Modify: (none)
- Test: `tests/unit/join-code.test.ts`

**Interfaces:**
- Consumes: `groups` and `memberships` tables, auth from Task 5
- Produces:
  - `generateJoinCode(): string` from `@/lib/join-code`
  - `createGroup({ name })` server action returning `{ groupId, joinCode }` on success
  - `/new-group` page

- [ ] **Step 1: Write the failing tests for join-code generator**

Create `tests/unit/join-code.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateJoinCode } from "@/lib/join-code";

describe("generateJoinCode", () => {
  it("returns exactly 8 characters", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateJoinCode()).toHaveLength(8);
    }
  });

  it("uses only unambiguous uppercase alphanumerics", () => {
    // Excludes: 0, O, 1, I, L (visually confusable)
    const ALLOWED = /^[A-HJ-KM-NP-Z2-9]{8}$/;
    for (let i = 0; i < 100; i++) {
      expect(generateJoinCode()).toMatch(ALLOWED);
    }
  });

  it("produces distinct codes across many calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) codes.add(generateJoinCode());
    expect(codes.size).toBeGreaterThan(990);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/unit/join-code.test.ts
```
Expected: FAIL — `@/lib/join-code` does not exist.

- [ ] **Step 3: Implement the join-code generator**

Create `lib/join-code.ts`:

```ts
// Excludes visually ambiguous: 0/O, 1/I/L
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
```

Note: the DB CHECK constraint uses `[A-Z0-9]{8}` which is broader — this generator produces a strict subset. That's intentional (generator conservative, storage permissive).

- [ ] **Step 4: Run tests — they must pass**

```bash
npm test tests/unit/join-code.test.ts
```
Expected: All 3 tests pass.

- [ ] **Step 5: Implement `createGroup` server action**

Create `app/actions/groups.ts`:

```ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/join-code";

const createGroupSchema = z.object({
  name: z.string().min(1, "그룹 이름을 입력해주세요").max(100),
});

export async function createGroup(
  input: z.infer<typeof createGroupSchema>,
): Promise<{ error?: string }> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  // Retry on join-code collision (extremely unlikely but defensible)
  let attempt = 0;
  while (attempt < 5) {
    const joinCode = generateJoinCode();
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .insert({
        name: parsed.data.name.trim(),
        join_code: joinCode,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (groupErr) {
      if (groupErr.code === "23505") {
        attempt++;
        continue;
      }
      return { error: groupErr.message };
    }

    // Master membership (self-insert allowed by RLS because created_by = auth.uid())
    const { error: memErr } = await supabase.from("memberships").insert({
      group_id: group.id,
      user_id: user.id,
      role: "master",
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    });
    if (memErr) return { error: memErr.message };

    redirect("/settings/group");
  }
  return { error: "그룹 코드 발급에 실패했습니다. 다시 시도해주세요." };
}
```

- [ ] **Step 6: Create onboarding layout and new-group page**

Create `app/(onboarding)/layout.tsx`:

```tsx
import { PrivacyGate } from "@/components/privacy-gate";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivacyGate>
      <div className="min-h-screen bg-pasture-50 px-6 py-12">
        <div className="mx-auto max-w-md">{children}</div>
      </div>
    </PrivacyGate>
  );
}
```

Create `app/(onboarding)/new-group/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createGroup } from "@/app/actions/groups";

export default function NewGroupPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createGroup({ name: formData.get("name") as string });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="mb-2 text-xl font-semibold">새 그룹 만들기</h2>
      <p className="mb-6 text-sm text-gray-600">
        그룹을 만들면 자동으로 마스터가 되고, 8자리 코드가 발급됩니다.
      </p>
      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">그룹 이름 (예: 고등부)</span>
          <input
            name="name"
            required
            maxLength={100}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-coral-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600 disabled:opacity-50"
        >
          {isPending ? "생성 중..." : "그룹 만들기"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        이미 그룹 코드를 받으셨다면{" "}
        <Link href="/join" className="text-pasture-600 underline">
          그룹 참여
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Manual smoke test**

`npm run dev`, sign in, navigate to `/new-group`, enter a name, submit. Verify:
- Redirects to `/settings/group` (which will 404 until Task 10 — that's fine)
- In Supabase dashboard, `groups` and `memberships` tables have the new rows.

- [ ] **Step 8: Commit**

```bash
git add lib/join-code.ts app/actions/groups.ts app/\(onboarding\)/ tests/unit/join-code.test.ts
git commit -m "Add group creation with 8-char join code"
```

---

### Task 8: Group join flow

**Files:**
- Create: `app/(onboarding)/join/page.tsx`, `app/(onboarding)/pending/page.tsx`
- Modify: `app/actions/groups.ts` (add `joinGroup`)
- Test: (integration — smoke via manual)

**Interfaces:**
- Consumes: `createGroup` context from Task 7
- Produces:
  - `joinGroup({ code })` server action
  - `/join` and `/pending` pages

- [ ] **Step 1: Add `joinGroup` server action**

Append to `app/actions/groups.ts`:

```ts
const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "8자리 영문+숫자 코드입니다"),
});

export async function joinGroup(
  input: z.infer<typeof joinGroupSchema>,
): Promise<{ error?: string }> {
  const parsed = joinGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  // Look up the group by code (RLS: no policy for anonymous select — we allow
  // matching a code only via the RPC below, which runs as SECURITY DEFINER).
  const { data: group, error: lookupErr } = await supabase.rpc(
    "find_group_by_code",
    { code_input: parsed.data.code },
  );
  if (lookupErr || !group) return { error: "코드를 찾을 수 없습니다" };

  // Check if user already has any membership with this group
  const { data: existing } = await supabase
    .from("memberships")
    .select("status")
    .eq("group_id", group)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "active") {
    redirect("/");
  }
  if (existing?.status === "pending") {
    redirect("/pending");
  }
  // 'removed' → allow re-request (fall through)

  const { error: insertErr } = await supabase.from("memberships").insert({
    group_id: group,
    user_id: user.id,
    role: "viewer", // placeholder; master sets real role on approval
    status: "pending",
  });
  if (insertErr) return { error: insertErr.message };

  redirect("/pending");
}
```

- [ ] **Step 2: Add the `find_group_by_code` RPC migration**

Create `supabase/migrations/20260703000003_join_by_code_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION find_group_by_code(code_input text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM groups WHERE join_code = upper(code_input) LIMIT 1;
$$;

-- Restrict to authenticated users only
REVOKE ALL ON FUNCTION find_group_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_group_by_code(text) TO authenticated;
```

Apply to both projects:
```bash
npx supabase db push
npx supabase link --project-ref your-test-project-ref
npx supabase db push
npx supabase link --project-ref your-dev-project-ref
```

Regenerate types:
```bash
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

- [ ] **Step 3: Create the /join page**

Create `app/(onboarding)/join/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { joinGroup } from "@/app/actions/groups";

export default function JoinPage() {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await joinGroup({ code: formData.get("code") as string });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="mb-2 text-xl font-semibold">그룹 참여</h2>
      <p className="mb-6 text-sm text-gray-600">
        마스터에게 받은 8자리 코드를 입력하세요.
      </p>
      <form action={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">그룹 코드</span>
          <input
            name="code"
            required
            maxLength={8}
            style={{ textTransform: "uppercase" }}
            className="mt-1 w-full rounded-md border px-3 py-3 text-center text-lg tracking-widest uppercase"
            placeholder="ABCD2345"
          />
        </label>
        {error && <p className="text-sm text-coral-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600 disabled:opacity-50"
        >
          {isPending ? "참여 신청 중..." : "참여 신청"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        아직 그룹이 없으신가요?{" "}
        <Link href="/new-group" className="text-pasture-600 underline">
          새 그룹 만들기
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create the /pending page**

Create `app/(onboarding)/pending/page.tsx`:

```tsx
export default function PendingPage() {
  return (
    <div className="rounded-lg bg-white p-8 shadow text-center">
      <div className="mb-3 text-4xl">🐑</div>
      <h2 className="text-xl font-semibold">승인 대기 중</h2>
      <p className="mt-3 text-sm text-gray-600">
        마스터가 승인하면 자동으로 그룹에 참여됩니다. 잠시 후 다시 접속해주세요.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Manual smoke test**

- Session 1 (existing account): Create group at `/new-group`. Copy the join code from Supabase dashboard.
- Session 2 (new incognito, new account): Sign up, navigate to `/join`, enter the code. Verify redirect to `/pending`.
- Check Supabase dashboard: `memberships` shows a new row with `status='pending'`.

- [ ] **Step 6: Commit**

```bash
git add app/actions/groups.ts app/\(onboarding\)/join/ app/\(onboarding\)/pending/ supabase/migrations/ lib/supabase/database.types.ts
git commit -m "Add group join flow with pending approval queue"
```

---

### Task 9: Teacher management (approval + role + remove)

**Files:**
- Create: `app/actions/memberships.ts`, `app/(app)/settings/teachers/page.tsx`, `lib/memberships.ts`
- Modify: (none)
- Test: (manual smoke test + relies on RLS test from Task 4)

**Interfaces:**
- Consumes: `memberships` table, `profiles` for display names
- Produces:
  - `approveMembership({ id, role })`, `denyMembership({ id })`, `changeRole({ id, role })`, `removeMembership({ id })` server actions
  - `getCurrentGroup()` helper reading the active group of the current user
  - `/settings/teachers` page

- [ ] **Step 1: Add `getCurrentGroup` helper**

Create `lib/memberships.ts`:

```ts
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Role, MembershipStatus } from "@/lib/constants";

export type CurrentMembership = {
  userId: string;
  groupId: string;
  groupName: string;
  role: Role;
  status: MembershipStatus;
};

export async function requireCurrentMembership(): Promise<CurrentMembership> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("group_id, role, status, groups(name)")
    .eq("user_id", user.id)
    .in("status", ["active", "pending"])
    .order("approved_at", { ascending: false })
    .maybeSingle();

  if (!membership) redirect("/join");
  if (membership.status === "pending") redirect("/pending");

  return {
    userId: user.id,
    groupId: membership.group_id,
    groupName: (membership.groups as unknown as { name: string }).name,
    role: membership.role,
    status: membership.status,
  };
}
```

- [ ] **Step 2: Add membership server actions**

Create `app/actions/memberships.ts`:

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

const roleEnum = z.enum(["editor", "viewer"]);

async function requireMaster() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") throw new Error("마스터 권한이 필요합니다");
  return m;
}

async function logAudit(
  groupId: string,
  actorId: string,
  action: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createServerClient();
  await supabase.from("audit_log").insert({
    group_id: groupId,
    actor_id: actorId,
    action,
    target_id: targetId,
    target_type: "membership",
    metadata,
  });
}

export async function approveMembership(input: {
  id: string;
  role: "editor" | "viewer";
}) {
  const parsed = z
    .object({ id: z.string().uuid(), role: roleEnum })
    .safeParse(input);
  if (!parsed.success) return { error: "잘못된 입력" };

  const master = await requireMaster();
  const supabase = await createServerClient();

  const { data: updated, error } = await supabase
    .from("memberships")
    .update({
      status: "active",
      role: parsed.data.role,
      approved_at: new Date().toISOString(),
      approved_by: master.userId,
    })
    .eq("id", parsed.data.id)
    .eq("group_id", master.groupId)
    .eq("status", "pending")
    .select("id")
    .single();
  if (error || !updated) return { error: error?.message ?? "승인 실패" };

  await logAudit(master.groupId, master.userId, "member_approved", updated.id, {
    role: parsed.data.role,
  });
  revalidatePath("/settings/teachers");
  return {};
}

export async function denyMembership(input: { id: string }) {
  const master = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("memberships")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: master.userId,
    })
    .eq("id", input.id)
    .eq("group_id", master.groupId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  await logAudit(master.groupId, master.userId, "member_denied", input.id);
  revalidatePath("/settings/teachers");
  return {};
}

export async function changeRole(input: {
  id: string;
  role: "editor" | "viewer";
}) {
  const parsed = z
    .object({ id: z.string().uuid(), role: roleEnum })
    .safeParse(input);
  if (!parsed.success) return { error: "잘못된 입력" };
  const master = await requireMaster();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("memberships")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id)
    .eq("group_id", master.groupId)
    .eq("status", "active")
    .neq("role", "master");
  if (error) return { error: error.message };

  await logAudit(master.groupId, master.userId, "role_changed", parsed.data.id, {
    new_role: parsed.data.role,
  });
  revalidatePath("/settings/teachers");
  return {};
}

export async function removeMembership(input: { id: string }) {
  const master = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("memberships")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: master.userId,
    })
    .eq("id", input.id)
    .eq("group_id", master.groupId)
    .eq("status", "active")
    .neq("role", "master");
  if (error) return { error: error.message };

  await logAudit(master.groupId, master.userId, "member_removed", input.id);
  revalidatePath("/settings/teachers");
  return {};
}
```

- [ ] **Step 3: Build the `/settings/teachers` page**

Create `app/(app)/settings/teachers/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { ROLE_LABELS_KO } from "@/lib/constants";
import {
  approveMembership,
  changeRole,
  denyMembership,
  removeMembership,
} from "@/app/actions/memberships";

export default async function TeachersPage() {
  const current = await requireCurrentMembership();
  if (current.role !== "master") redirect("/settings");

  const supabase = await createServerClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, role, status, profiles(display_name, email)")
    .eq("group_id", current.groupId)
    .in("status", ["pending", "active"])
    .order("status", { ascending: true });

  const pending = memberships?.filter((m) => m.status === "pending") ?? [];
  const active = memberships?.filter((m) => m.status === "active") ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-2xl font-bold">교사 관리</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          승인 대기 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            대기 중인 요청이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="mb-3">
                  <div className="font-medium">
                    {(m.profiles as any)?.display_name ?? "(이름 없음)"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(m.profiles as any)?.email}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await approveMembership({ id: m.id, role: "editor" });
                    }}
                  >
                    <button className="rounded-md bg-pasture-500 px-4 py-2 text-sm text-white">
                      편집 교사로 승인
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await approveMembership({ id: m.id, role: "viewer" });
                    }}
                  >
                    <button className="rounded-md border border-pasture-500 px-4 py-2 text-sm text-pasture-600">
                      조회 교사로 승인
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await denyMembership({ id: m.id });
                    }}
                  >
                    <button className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600">
                      반려
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">활성 교사 ({active.length})</h2>
        <ul className="mt-3 space-y-3">
          {active.map((m) => (
            <li key={m.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-3">
                <div className="font-medium">
                  {(m.profiles as any)?.display_name ?? "(이름 없음)"}{" "}
                  <span className="ml-2 text-xs text-gray-500">
                    {ROLE_LABELS_KO[m.role]}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {(m.profiles as any)?.email}
                </div>
              </div>
              {m.role !== "master" && (
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await changeRole({
                        id: m.id,
                        role: m.role === "editor" ? "viewer" : "editor",
                      });
                    }}
                  >
                    <button className="rounded-md border px-3 py-1 text-xs">
                      {m.role === "editor" ? "→ 조회로" : "→ 편집으로"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await removeMembership({ id: m.id });
                    }}
                  >
                    <button className="rounded-md border border-coral-500 px-3 py-1 text-xs text-coral-500">
                      내보내기
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Manual smoke test**

- As master: navigate to `/settings/teachers`. Verify pending user (from Task 8 smoke test) appears.
- Click "편집 교사로 승인". Verify user disappears from pending list, appears in active list.
- Switch to the approved user's session, refresh — no longer sees "승인 대기 중" page.
- Back to master: change the role, then click "내보내기". Verify removal.

- [ ] **Step 5: Commit**

```bash
git add app/actions/memberships.ts app/\(app\)/settings/teachers/ lib/memberships.ts
git commit -m "Add teacher approval, role change, and removal (master only)"
```

---

### Task 10: App shell + tab bar

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/attendance/page.tsx`, `app/(app)/calendar/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/settings/page.tsx`, `app/(app)/settings/group/page.tsx`, `components/tab-bar.tsx`, `components/logo.tsx`
- Modify: `app/page.tsx` (redirect based on auth state)
- Test: (manual mobile viewport check)

**Interfaces:**
- Consumes: `requireCurrentMembership` from Task 9
- Produces:
  - `<TabBar current="attendance|calendar|dashboard|settings" />` client component
  - `/attendance`, `/calendar`, `/dashboard`, `/settings`, `/settings/group` pages (placeholders except settings)

- [ ] **Step 1: Create the TabBar component**

Create `components/tab-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/attendance", label: "출석", icon: "🐑" },
  { href: "/calendar", label: "일정", icon: "📅" },
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/settings", label: "설정", icon: "⚙️" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs",
                  active
                    ? "text-pasture-600 font-semibold"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Create the app-shell layout**

Create `app/(app)/layout.tsx`:

```tsx
import { requireCurrentMembership } from "@/lib/memberships";
import { PrivacyGate } from "@/components/privacy-gate";
import { TabBar } from "@/components/tab-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentMembership(); // redirects if not active member

  return (
    <PrivacyGate>
      <div className="min-h-screen bg-gray-50 pb-20">{children}</div>
      <TabBar />
    </PrivacyGate>
  );
}
```

- [ ] **Step 3: Create placeholder tab pages**

Create `app/(app)/attendance/page.tsx`:

```tsx
export default function AttendancePage() {
  return (
    <main className="px-6 py-8 text-center">
      <div className="mt-16 text-6xl">🐑</div>
      <h1 className="mt-4 text-xl font-semibold">출석판</h1>
      <p className="mt-2 text-sm text-gray-500">
        (구현 예정 — Plan 3)
      </p>
    </main>
  );
}
```

Create `app/(app)/calendar/page.tsx`:

```tsx
export default function CalendarPage() {
  return (
    <main className="px-6 py-8 text-center">
      <div className="mt-16 text-6xl">📅</div>
      <h1 className="mt-4 text-xl font-semibold">일정</h1>
      <p className="mt-2 text-sm text-gray-500">(구현 예정 — Plan 5)</p>
    </main>
  );
}
```

Create `app/(app)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <main className="px-6 py-8 text-center">
      <div className="mt-16 text-6xl">📊</div>
      <h1 className="mt-4 text-xl font-semibold">대시보드</h1>
      <p className="mt-2 text-sm text-gray-500">(구현 예정 — Plan 4)</p>
    </main>
  );
}
```

- [ ] **Step 4: Create the settings hub**

Create `app/(app)/settings/page.tsx`:

```tsx
import Link from "next/link";
import { requireCurrentMembership } from "@/lib/memberships";
import { ROLE_LABELS_KO } from "@/lib/constants";
import { signOut } from "@/app/actions/auth";

export default async function SettingsPage() {
  const m = await requireCurrentMembership();
  return (
    <main className="px-6 py-6">
      <h1 className="text-2xl font-bold">설정</h1>
      <p className="mt-1 text-sm text-gray-600">
        {m.groupName} · {ROLE_LABELS_KO[m.role]}
      </p>

      <nav className="mt-8 space-y-2">
        {m.role === "master" && (
          <>
            <Link
              href="/settings/teachers"
              className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
            >
              👥 교사 관리
            </Link>
            <Link
              href="/settings/group"
              className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
            >
              🏷️ 그룹 관리 (이름, 코드)
            </Link>
          </>
        )}
        <Link
          href="/privacy"
          className="block rounded-lg bg-white p-4 shadow-sm hover:bg-pasture-50"
        >
          📋 개인정보 처리 방침
        </Link>
      </nav>

      <form action={signOut} className="mt-10">
        <button className="w-full rounded-lg border border-gray-300 py-3 text-gray-700">
          로그아웃
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Create the group settings page**

Create `app/(app)/settings/group/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";

export default async function GroupSettingsPage() {
  const m = await requireCurrentMembership();
  if (m.role !== "master") redirect("/settings");

  const supabase = await createServerClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name, join_code, created_at")
    .eq("id", m.groupId)
    .single();

  return (
    <main className="mx-auto max-w-md px-6 py-6">
      <h1 className="text-2xl font-bold">그룹 관리</h1>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">그룹 이름</div>
        <div className="mt-1 text-lg font-semibold">{group?.name}</div>
      </section>

      <section className="mt-4 rounded-lg bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">참여 코드</div>
        <div className="mt-1 select-all font-mono text-2xl font-bold tracking-widest text-pasture-600">
          {group?.join_code}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          이 코드를 다른 교사들에게 공유하세요.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Fix `app/page.tsx` to route based on auth state**

Overwrite `app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["active", "pending"])
      .maybeSingle();

    if (membership?.status === "active") redirect("/attendance");
    if (membership?.status === "pending") redirect("/pending");
    redirect("/join");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-pasture-50 p-6">
      <h1 className="text-4xl font-bold text-pasture-600">🐑 목장 관리</h1>
      <p className="text-center text-lg text-gray-700">
        교회 고등부 출석·일정·생일 관리
      </p>
      <div className="flex flex-col gap-3 pt-6 sm:flex-row">
        <Link
          href="/login"
          className="rounded-lg bg-pasture-500 px-8 py-3 text-center text-white shadow hover:bg-pasture-600"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border-2 border-pasture-500 px-8 py-3 text-center text-pasture-600 hover:bg-pasture-100"
        >
          가입하기
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Test mobile viewport manually**

Open Chrome DevTools → toggle device toolbar → iPhone 12 Pro. Verify:
- Tab bar sits at the bottom, doesn't overlap content (pb-20 in layout)
- Tab bar tabs are order: 출석 / 일정 / 대시보드 / 설정
- Active tab is highlighted
- All placeholder pages render without horizontal scroll
- `/settings` shows master-only options for the group creator, hides them for viewers

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/ components/tab-bar.tsx app/page.tsx
git commit -m "Add app shell with tab bar and placeholder tab pages"
```

---

### Task 11: Deployment prep + PWA manifest

**Files:**
- Create: `app/manifest.json`, `app/icon.png` (placeholder), `vercel.json`, `DEPLOY.md`
- Modify: (none)
- Test: `npm run build`

**Interfaces:**
- Consumes: The whole app
- Produces:
  - Buildable production bundle
  - `DEPLOY.md` documenting the manual deployment steps

- [ ] **Step 1: Create a minimal PWA manifest**

Create `app/manifest.json`:

```json
{
  "name": "목장 관리",
  "short_name": "목장",
  "description": "교회 고등부 출석·일정·생일 관리",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F0F9F0",
  "theme_color": "#7FC181",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Note: Full PWA with service worker + install prompt is Plan 6. This is a minimal manifest so browsers recognize us as a web app.

For icons, Sarah should place two placeholder PNGs at `public/icon-192.png` and `public/icon-512.png` — solid pastel green square with a white sheep silhouette. Even a simple color square works to unblock — she can iterate on the icon later.

- [ ] **Step 2: Configure Vercel**

Create `vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm ci"
}
```

- [ ] **Step 3: Write DEPLOY.md**

Create `DEPLOY.md`:

```markdown
# 배포 가이드

## 1. GitHub에 푸시

```bash
gh repo create mokjang --private --source=. --push
```

또는 GitHub 웹에서 새 저장소 만들고:
```bash
git remote add origin https://github.com/YOUR_USERNAME/mokjang.git
git push -u origin main
```

## 2. Vercel 연동

1. https://vercel.com 로그인 → New Project → GitHub 저장소 선택
2. Framework: Next.js (자동 감지)
3. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase dev 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service role secret (⚠️ Sensitive 체크)
   - `NEXT_PUBLIC_APP_URL` — Vercel 프로덕션 도메인 (예: https://mokjang.vercel.app)
4. Deploy 클릭

## 3. Supabase 리다이렉트 URL 추가

Supabase 대시보드 → Authentication → URL Configuration:
- Site URL: Vercel 프로덕션 도메인
- Redirect URLs: 
  - `https://your-vercel-domain.vercel.app/auth/callback`
  - `http://localhost:3100/auth/callback` (dev)

## 4. Google OAuth 리다이렉트 URI 업데이트

Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs:
- `https://your-supabase-ref.supabase.co/auth/v1/callback`
(Supabase URL은 그대로 유지)

## 5. 배포 확인

Vercel 프로덕션 URL 접속 → 회원가입 → 그룹 생성 흐름 테스트.

## 프로덕션 데이터 이관

Dev Supabase 프로젝트를 계속 쓰거나, 별도 프로덕션 프로젝트를 만들어 마이그레이션을 다시 적용:
```bash
npx supabase link --project-ref your-prod-project-ref
npx supabase db push
```
그리고 Vercel 환경변수를 프로덕션 프로젝트 값으로 교체.
```

- [ ] **Step 4: Verify production build succeeds**

Run:
```bash
npm run build
```
Expected: Build finishes without TypeScript errors or module resolution failures. Any warnings should be understood and either fixed or documented.

- [ ] **Step 5: Commit**

```bash
git add app/manifest.json vercel.json DEPLOY.md public/
git commit -m "Add PWA manifest, Vercel config, and deployment guide"
```

---

### Task 12: E2E golden-path test

**Files:**
- Create: `tests/e2e/foundation.spec.ts`, `tests/e2e/helpers.ts`, `playwright.config.ts`
- Modify: `package.json` (Playwright already added as devDep in Task 1)
- Test: `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: The full app (Tasks 1–11)
- Produces:
  - One Playwright spec covering: signup → create group → get code → new session → signup → join → master approves → both users can access `/settings`

- [ ] **Step 1: Initialize Playwright**

Run:
```bash
npx playwright install chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false, // sessions share DB — serial is safer for foundation
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    locale: "ko-KR",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // dotenv-cli usage: run with dotenv -e .env.local -- npm run test:e2e
    },
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        viewport: { width: 390, height: 844 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    },
  ],
});
```

Update the `test:e2e` script in `package.json`:

```json
"test:e2e": "dotenv -e .env.local -- playwright test"
```

- [ ] **Step 2: Write helper utilities**

Create `tests/e2e/helpers.ts`:

```ts
import { expect, type Page } from "@playwright/test";

export async function signUp(page: Page, email: string, password: string, name: string) {
  await page.goto("/signup");
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: false }).fill(password);
  await page.getByLabel(/개인정보 처리 방침/).check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/join/);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

export function testEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.test`;
}
```

- [ ] **Step 3: Write the golden path spec (failing first)**

Create `tests/e2e/foundation.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { login, signUp, testEmail } from "./helpers";

test.describe.serial("Foundation golden path", () => {
  const masterEmail = testEmail("master");
  const teacherEmail = testEmail("teacher");
  const password = "TestPass1!";

  test("master signs up and creates group", async ({ page }) => {
    await signUp(page, masterEmail, password, "김마스터");

    await page.goto("/new-group");
    await page.getByLabel(/그룹 이름/).fill("고등부");
    await page.getByRole("button", { name: "그룹 만들기" }).click();

    await expect(page).toHaveURL(/\/settings\/group/);
    await expect(page.locator("text=참여 코드")).toBeVisible();
  });

  let joinCode = "";

  test("master retrieves join code", async ({ page }) => {
    await login(page, masterEmail, password);
    await page.goto("/settings/group");
    const codeElem = page.locator(".font-mono").first();
    joinCode = ((await codeElem.textContent()) ?? "").trim();
    expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);
  });

  test("teacher signs up and joins with code", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signUp(page, teacherEmail, password, "이교사");
    await page.getByLabel(/그룹 코드/).fill(joinCode);
    await page.getByRole("button", { name: "참여 신청" }).click();

    await expect(page).toHaveURL(/\/pending/);
    await expect(page.locator("text=승인 대기 중")).toBeVisible();
    await context.close();
  });

  test("master approves teacher as editor", async ({ page }) => {
    await login(page, masterEmail, password);
    await page.goto("/settings/teachers");

    await expect(page.locator("text=이교사")).toBeVisible();
    await page.getByRole("button", { name: "편집 교사로 승인" }).click();

    await expect(
      page.locator("text=이교사").locator("xpath=ancestor::li"),
    ).toContainText("편집 교사");
  });

  test("approved teacher lands on attendance tab", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, teacherEmail, password);
    await expect(page).toHaveURL(/\/attendance/);
    await expect(page.locator("text=출석판")).toBeVisible();
    // Bottom tab bar order check
    const tabs = await page.locator("nav a").allTextContents();
    expect(tabs.join("")).toContain("출석");
    expect(tabs.join("")).toContain("일정");
    expect(tabs.join("")).toContain("대시보드");
    expect(tabs.join("")).toContain("설정");
    await context.close();
  });
});
```

- [ ] **Step 4: Run E2E — expect a mixture of pass/fail on first attempt**

```bash
npm run test:e2e
```
Expected: Most tests pass; if any fail, read the error, adjust the selector or timing, re-run. Common issues:
- Redirect flakiness → add `await page.waitForURL(...)` before assertions.
- Selectors — the `getByLabel` calls depend on exact label text (uses regex where needed).

Iterate until green.

- [ ] **Step 5: Add CI-friendly npm script and commit**

Verify `package.json` has:
```json
"test:e2e": "dotenv -e .env.local -- playwright test"
```

Then commit:
```bash
git add tests/e2e/ playwright.config.ts package.json package-lock.json
git commit -m "Add E2E golden-path spec covering signup → group → approval flow"
```

- [ ] **Step 6: Final verification — run all tests one time**

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

All four must succeed. This is the shipping bar for Plan 1.

---

## Plan 1 Completion Criteria

Foundation is done when:
- ✅ A user can sign up with email+password OR Google
- ✅ A user can create a group and gets an auto-generated 8-char code
- ✅ Another user can join with the code and lands on `/pending`
- ✅ Master can approve/deny pending, change roles, remove members
- ✅ Cross-group data isolation is enforced by RLS (verified by integration test)
- ✅ Mobile-first tab bar shows on all app pages in the confirmed order (출석 · 일정 · 대시보드 · 설정)
- ✅ App can be deployed to Vercel following DEPLOY.md
- ✅ `npm run typecheck && npm test && npm run test:e2e && npm run build` all pass

## What Plan 1 does NOT include (deferred to later plans)

- Students, classes, roster CRUD, Excel upload → **Plan 2**
- Attendance sessions, records, board UI → **Plan 3**
- Dashboard summaries, export, grade promotion → **Plan 4**
- Calendar events, OCR upload/review → **Plan 5**
- Email digest, PWA push, service worker, install prompt → **Plan 6**
- Advanced teacher management (bulk invites, audit log viewer) → **Plan 7**
