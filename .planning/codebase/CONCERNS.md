# Concerns

**Date:** 2026-05-03

## Technical Debt & Fragility
- **Lack of Automated Testing:** The primary concern is the complete absence of a testing framework (Jest/Vitest/Playwright). This makes refactoring and large changes risky as the application scales.
- **Experimental Next.js Version:** The project uses `next: 16.2.4`, which might introduce instability depending on the ecosystem support and current stability of that specific release version.
- **Supabase Environment Config:** Ensure proper separation of environments (dev, staging, prod) within Supabase, as the repository appears to manage migrations directly (`supabase/migrations/`).

## Security
- **Authentication:** Relies on Supabase SSR, which must correctly handle token storage and secure cookies in both client and server contexts to avoid CSRF and XSS vulnerabilities. Care must be taken within Server Components to correctly read session data.

## Performance
- **Client vs Server Components:** Over-use of `"use client"` directives could bloat the JavaScript bundle. Continual monitoring required to ensure components remain Server Components where possible.
- **Database Queries:** Unoptimized Supabase queries or N+1 query problems within React Server Components could cause performance bottlenecks.
