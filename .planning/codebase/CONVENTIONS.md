# Conventions

**Date:** 2026-05-03

## Code Style & Formatting
- **Linting:** Maintained by ESLint v9 (`eslint.config.mjs`) alongside `eslint-config-next`.
- **Typing:** Strict TypeScript typing enforced through `tsconfig.json`. Types are likely auto-generated from Supabase schemas and utilized throughout the app.
- **Styling Conventions:** Tailwind utility classes. Conditional and dynamic classes are merged cleanly using `tailwind-merge` and `clsx` (commonly combined into a `cn` utility in `src/lib/utils.ts` in shadcn/ui projects).

## Naming Patterns
- **Files/Directories:** Kebab-case for standard Next.js routes. PascalCase for React component files (`Button.tsx`, `Header.tsx`).
- **Variables/Functions:** camelCase for standard variables and functions. PascalCase for Component definitions.
- **Types/Interfaces:** PascalCase. Prefixing interfaces with `I` is generally discouraged in modern React/TypeScript setups unless explicitly defined by the team.

## Form Handling
- Forms are strictly managed with `react-hook-form` and schemas defined by `zod`. This ensures client-side type-safety and robust validation before hitting server actions.

## Error Handling
- Expects Server Actions to return structured responses (e.g. `{ error: string } | { data: any }`).
- Usage of Next.js `error.tsx` boundaries to gracefully catch exceptions in specific route segments.
