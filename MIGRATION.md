# Migration to Next.js

## Changes Made

This project has been migrated from **Vite** to **Next.js** for better production performance and server-side capabilities.

### Key Changes:

1. **Package.json**
   - Removed: `@vitejs/plugin-react`, `vite`
   - Added: `next`
   - Updated scripts to use `next dev`, `next build`, `next start`

2. **Project Structure**
   - Old entry point: `src/main.tsx`
   - New entry point: `app/page.tsx`
   - Source files: moved to `src/` directory
   - Public assets: in `public/` directory

3. **Configuration Files**
   - Removed: `vite.config.ts`
   - Added: `next.config.js` - handles XMTP V3 SharedArrayBuffer requirements
   - Updated: `tsconfig.json` - configured for Next.js

4. **Environment**
   - Created: `.env.local` - for development configuration
   - XMTP configuration available via `process.env.NEXT_PUBLIC_XMTP_ENV`

5. **Key Features**
   - Client components marked with `'use client'` directive
   - Server-side rendering support
   - Optimized build output
   - Better TypeScript integration

## Installation & Running

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The app will be available at `http://localhost:3000`

## Notes

- All existing React components work without changes
- The `src/` directory contains all hooks, services, components, and utilities
- XMTP V3 with SharedArrayBuffer is properly configured
- TypeScript paths (`@/*`) work as before

