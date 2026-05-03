# Architecture

**Date:** 2026-05-03

## Pattern
- **Full-Stack Serverless Web Application:** Built upon Next.js App Router paradigm.
- **Component-Driven UI:** React components orchestrated via layout/page structures. Client vs. Server Component boundaries are critical for performance and interactivity.
- **Server Actions:** Primarily used for data mutations and backend communications, integrating with Supabase.

## Layers
1. **Data Layer:** Supabase PostgreSQL instance. Schema is version-controlled via `supabase/migrations/`.
2. **Access/Service Layer:** Supabase JS Client providing ORM-like access. Used extensively within Server Components and Server Actions.
3. **Application State Layer:** Zustand stores (`zustand`) used for global client-side state across components. Local state managed with `useState`/`useReducer`.
4. **UI/Presentation Layer:** React Server Components (RSC) for data fetching and rendering, and Client Components for interactivity. UI components are built with shadcn/ui and Radix UI.
5. **Styling Layer:** TailwindCSS providing utility classes, enhanced with PostCSS.

## Data Flow
- **Read Operations:** Server components fetch data directly from Supabase, pass data as props to client components, maintaining a minimal client JavaScript bundle.
- **Write Operations:** Client components trigger Next.js Server Actions (or API routes) which mutate data in Supabase, revalidate paths (`revalidatePath`), and update the UI accordingly.
- **State Updates:** Forms handled via `react-hook-form` + `zod`. Global client states (e.g. shopping cart, UI toggles) handled by Zustand.

## Entry Points
- `src/app/layout.tsx` - Root layout and global providers.
- `src/app/page.tsx` - Main landing page.
- `src/app/(auth)/` - Authentication route groups.
- `src/app/(app)/` - Protected or main application route groups.
