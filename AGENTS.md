# AGENTS.md

## Vercel UI SDK (`@ui-sdk/web` + `@ui-sdk/core`)

- Before using or extending UI SDK components, read `node_modules/@ui-sdk/web/docs/llms.txt`.
- When authoring custom primitives (`definePrimitive` + `createParts`), inspect `node_modules/@ui-sdk/web/docs/core.md` and `node_modules/@ui-sdk/web/docs/rendering.md`.
- Keep `live()` custom CSS properties (`--live-*`) separate from `attrs()` custom CSS properties (`--base-*`) so channel cleanup on drag end never strips base layout variables.

## Commands

- `pnpm run dev` — Run `esbuild` local dev server with live watch (`public/`).
- `pnpm run typecheck` — Run strict TypeScript check (`tsc --noEmit`).
- `pnpm run build` — Bundle minified ESM + CSS into `public/`.
