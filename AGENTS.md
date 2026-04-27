# AGENTS.md

## Project Snapshot

- Desktop task-management app built with Electron, Vite, React 18, TypeScript, Redux Toolkit, and Tailwind CSS.
- Runtime entry points are `src/main/index.ts` for Electron main, `src/preload/index.ts` for the context bridge, and `src/renderer/index.tsx` / `src/renderer/App.tsx` for React.
- Local persistence uses `sql.js`; database schema, migrations, and data access live mostly in `src/main/database.ts` and `src/main/migration.ts`.
- The app has task boards, calendar, recurring tasks, notes/floating notes, desktop/card widgets, shortcuts, backups, update checks, Excel import, and the capsule/AI parser.
- User-facing copy and existing comments are largely Simplified Chinese. Preserve that style when changing UI text or docs.

## Agent Operating Principles

This section distills the core ideas from `multica-ai/andrej-karpathy-skills`: https://github.com/multica-ai/andrej-karpathy-skills. These rules bias toward careful, minimal, verifiable changes rather than speed for non-trivial work.

- Think before coding. Do not silently choose an interpretation when the request is ambiguous; state assumptions, surface tradeoffs, and ask before changing code if the wrong choice would be costly.
- Prefer the simplest working solution. Do not add speculative features, one-off abstractions, optional configurability, or broad error-handling scaffolds that the task did not require.
- Make surgical changes. Touch only files and lines needed for the request, match existing style even when it is not your preference, and avoid drive-by refactors, formatting churn, or comment rewrites.
- Clean up only your own mess. Remove imports, variables, functions, tests, or docs made obsolete by your change, but do not delete pre-existing dead code unless explicitly asked.
- Convert vague tasks into verifiable goals. For bugs, reproduce with a focused test or concrete check first when practical; for features, define the smallest success criteria before implementing.
- Work in small verification loops. For multi-step changes, use short plans where each step has a matching check, then keep iterating until the success criteria are met or a blocker is clearly named.
- Push back kindly when the requested path seems risky or overbuilt. Offer the smaller or safer alternative instead of implementing a large design by default.
- A good diff should be explainable line by line: every changed line should trace back to the user's request, a required verification update, or cleanup caused by the change itself.

## Commands

- Install dependencies with `npm install`; this repo uses `package-lock.json`.
- Start Vite-only development with `npm run dev`.
- Start the full Electron app in development with `npm run electron:dev`.
- Build the Vite/Electron output with `npm run build:vite`.
- Build/package the app with `npm run build` or `npm run electron:build`.
- Run Jest renderer/unit tests with `npm run test`.
- Run Vitest integration tests with `npm run test:integration`.
- Run Playwright Electron E2E tests with `npm run test:e2e`.
- Run the whole test suite with `npm run test:all`.
- Regenerate the app icon with `npm run icon`.

## Repository Layout

- `src/main/`: Electron main-process code, IPC handlers, database, windows, tray, shortcuts, updater, backups, reminders, Excel import, and capsule services.
- `src/preload/`: context-isolated bridge exposed as `window.electronAPI`.
- `src/renderer/`: React app, views, components, Redux store, hooks, i18n, styles, and renderer utilities.
- `src/__tests__/`: Jest/Vitest setup plus unit, component, store, utility, and integration tests.
- `e2e/`: Playwright Electron tests.
- `public/`: packaged assets, default notes, holiday JSON files, wallpapers, icons, and task import template.
- `scripts/`: build/support scripts such as icon generation and installer config.
- `dist/`, `dist-electron/`, `release/`, `test-results/`, `temp_asar_extract/`, `node_modules/`, and `data/` are generated or local artifacts. Do not hand-edit them unless the task explicitly requires it.

## Coding Guidelines

- Follow the existing TypeScript style: 4-space indentation, single quotes, semicolons omitted, ES modules, and React function components/hooks.
- Keep renderer code context-isolated. Do not access Node/Electron APIs directly from React; route calls through `window.electronAPI`.
- When adding or changing IPC, update all relevant layers together: main-process handler, preload bridge, `src/renderer/vite-env.d.ts`, renderer usage, and test mocks in `src/__tests__/setupTests.ts` / `setupTests.vitest.ts`.
- Use Redux Toolkit slices in `src/renderer/store/` for shared renderer state and typed hooks from `src/renderer/hooks/useRedux.ts`.
- Keep database schema changes additive and migration-safe. Update TypeScript data interfaces, `createTables()`, migration/default-data logic, and any renderer mapping code together.
- Be careful with date/time fields. Tasks and subtasks use `YYYY-MM-DD` date strings plus optional hour/minute fields in several places.
- Preserve the current visual language: Tailwind utility classes, translucent/glass panels, theme settings, wallpapers, and performance-mode blur handling.
- Avoid logging secrets or API keys, especially in capsule/AI provider code.

## Testing Notes

- Jest is configured for renderer/component/unit tests and excludes `src/__tests__/integration/**`.
- Vitest uses jsdom and includes integration-style tests under `src/__tests__`.
- Playwright E2E launches Electron from `dist-electron/main/index.js`; use `npm run test:e2e` so the required build step runs first.
- When changing Electron APIs, update both Jest and Vitest `window.electronAPI` mocks or tests may fail with runtime `undefined` errors.
- Prefer the smallest useful verification command for the change. For renderer-only changes, `npm run test` or targeted Jest is usually enough; for database or IPC changes, include `npm run test:integration` when practical.

## Safety And Workflow

- The working tree may already contain user edits. Do not revert, overwrite, or reformat unrelated files.
- Avoid editing generated outputs or local data files. Source changes should normally be in `src/`, configs, docs, tests, or `scripts/`.
- If Git reports dubious ownership in this workspace, prefer one-off commands such as `git -c safe.directory=F:/new_work/ZenHubBoard_105/ZenHubBoard status --short` instead of changing global Git config.
- Keep packaged assets in `public/` stable unless the task is explicitly about assets.
- Before large changes, scan the relevant view/component/store/main-process path first; many features have paired main/preload/renderer code.
