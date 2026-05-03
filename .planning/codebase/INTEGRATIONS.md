# Integrations

**Date:** 2026-05-03

## Database and Backend as a Service
- **Supabase:** The primary integration serving as the backend database (PostgreSQL) and authentication provider.
  - Integration relies on `@supabase/supabase-js` and `@supabase/ssr` to securely communicate with the Supabase API from Next.js server components, server actions, and client components.
  - The `supabase/migrations/` directory indicates local schema management before deployment to Supabase cloud.

## Authentication
- **Supabase Auth:** Used for user authentication, integrated via the `@supabase/ssr` package to manage secure cookies and server-side session validation.

## Other APIs
- No other specific external APIs (like payment gateways, third-party CMS, or external email providers) are explicitly listed in `package.json` at this time.
