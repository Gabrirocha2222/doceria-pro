# Structure

**Date:** 2026-05-03

## Directory Layout

```
doceria-pro/
├── src/
│   ├── app/                 # Next.js App Router core
│   │   ├── (app)/           # Main application routes (likely protected)
│   │   ├── (auth)/          # Authentication routes (login, register)
│   │   ├── favicon.ico      
│   │   ├── globals.css      # Global Tailwind configuration and CSS variables
│   │   ├── layout.tsx       # Root layout component
│   │   └── page.tsx         # Root page component
│   ├── components/          # Reusable React components
│   │   ├── recipes/         # Domain-specific components
│   │   └── ui/              # shadcn/ui primitive components
│   ├── lib/                 # Utility functions and shared logic (e.g., Supabase client, utils)
│   └── proxy.ts             # Proxy setup/config file
├── supabase/                
│   ├── migrations/          # Supabase database schema migrations
│   └── migrations.zip       # Compressed migrations archive
├── public/                  # Static assets (images, fonts, etc.)
├── .planning/               # GSD (Get Shit Done) framework planning directory
│   └── codebase/            # Codebase mapping documents
├── package.json             # NPM dependencies and scripts
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts /     # TailwindCSS configuration (inferred/v4 setup)
├── tsconfig.json            # TypeScript configuration
└── eslint.config.mjs        # ESLint flat configuration
```

## Naming Conventions
- **Components:** PascalCase for React component files (standard).
- **Hooks/Utils:** camelCase for custom hooks and utility files.
- **Routing:** Kebab-case or standard App Router conventions (e.g. `page.tsx`, `layout.tsx`, `[id]`, `(route-group)`).
- **Styles:** `globals.css` used for main CSS layer imports and CSS variables.

## Key Locations
- **UI Components:** `src/components/ui/` (standard shadcn/ui directory).
- **Backend Setup:** `src/lib/` generally holds the Supabase client initializers.
- **Database Schema:** `supabase/migrations/` holds `.sql` files that define the DB structure.
