# Tech Stack

**Date:** 2026-05-03

## Core Technologies
- **Language:** TypeScript (`v5`)
- **Runtime:** Node.js (`v20`)
- **Framework:** Next.js (`v16.2.4`) utilizing the App Router (`src/app`)
- **UI Library:** React (`v19.2.4`)

## Frontend
- **Styling:** TailwindCSS (`v4`) via PostCSS (`postcss.config.mjs`)
- **Component Library:** shadcn/ui, Radix UI (`@radix-ui/*`)
- **Icons:** Lucide React (`lucide-react`)
- **State Management:** Zustand (`zustand v5`)
- **Form Handling:** React Hook Form (`react-hook-form`), Zod (`zod`) for schema validation, with hookform resolvers.
- **Utility Libraries:** `tailwind-merge`, `clsx`, `tw-animate-css`, `class-variance-authority`

## Backend & Infrastructure
- **Database / BaaS:** Supabase
- **Authentication:** Supabase Auth with SSR (`@supabase/ssr`)
- **ORM / Client:** Supabase JS Client (`@supabase/supabase-js`)

## Tooling & Configuration
- **Linting:** ESLint (`v9`) with Next.js configurations (`eslint-config-next`)
- **Type Checking:** strict TypeScript configuration in `tsconfig.json`
- **Package Manager:** npm (inferred from `package-lock.json`)
