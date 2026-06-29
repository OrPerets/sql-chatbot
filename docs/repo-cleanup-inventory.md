# Repository Cleanup Inventory

Last reviewed: 2026-06-29.

This inventory separates safe local clutter from tracked files that may be grading, homework, archive, runtime, or deployment evidence. Do not delete tracked homework/archive data without an archive-first workflow and explicit approval.

## Safe Local Delete Only

- `.next/` - local Next.js build cache.
- `coverage/` - local Jest coverage output.
- `.DS_Store`, `docs/.DS_Store`, `output/.DS_Store` - macOS metadata files.
- `tsconfig.tsbuildinfo`, `tsconfig.scripts.tsbuildinfo` - local TypeScript incremental caches.
- `next-env.d.ts` - ignored local Next.js generated type shim in this checkout.

Keep local secrets and environment state:

- `.env` and `.env.local` are ignored but must not be printed or deleted during cleanup.
- `.vercel/` is ignored local deployment linkage; preserve unless relinking Vercel is acceptable.
- `node_modules/` is ignored but needed for local verification.

## Should Be Ignored

Already ignored:

- `.next/`
- `coverage/`
- `.DS_Store`
- `.env`
- `.env.local`
- `.vercel/`
- `*.tsbuildinfo`
- `next-env.d.ts`

Ignored from this cleanup pass:

- `test-results/`
- `playwright-report/`
- `output/playwright/`

## Tracked But Probably Historical Or Generated

These are tracked today and should not be removed without approval:

- `exports/` - chat archives, homework grading exports, and homework reopen evidence.
- `output/` - grading review workbooks, comment recovery, enriched data, and reports.
- `playwright-report/index.html` - generated Playwright HTML report.
- `test-results/.last-run.json` - generated Playwright last-run metadata.
- `output/playwright/*.png` - generated avatar debug screenshots.
- `docs/ex_SQL_03.docx` - course/document artifact.

## Required Runtime Or Deployment Assets

- `public/michael.glb` - referenced by avatar components as the primary model path.
- `public/avatars/michael.glb` - referenced as an avatar fallback and by `npm run compress:glb`.
- `public/sql-wasm.wasm` - public SQL wasm asset; byte-identical to the nested copy but kept until runtime expectations are verified.
- `public/sql-wasm/sql-wasm.wasm` - public SQL wasm asset; byte-identical to the root copy but kept until runtime expectations are verified.
- `docs/pdfs/` - served by the interactive learning PDF API.
- `scripts/` - contains 88 maintenance, grading, migration, export, and database scripts; several are referenced by `package.json`, docs, or script usage headers.

## Needs Approval Before Deletion

- `exports/` or any file under it: contains archive/grading/reopen evidence.
- `output/` or any file under it: contains grading and recovery evidence.
- `playwright-report/index.html`: safe to regenerate, but tracked removal should be reviewed.
- `test-results/.last-run.json`: safe to regenerate, but tracked removal should be reviewed.
- `output/playwright/*.png`: likely disposable debug screenshots, but currently tracked.
- One SQL wasm duplicate: `public/sql-wasm.wasm` and `public/sql-wasm/sql-wasm.wasm` are byte-identical, but deletion needs runtime/deployment verification.
- Either Michael model: `public/michael.glb` and `public/avatars/michael.glb` are not duplicates by hash and both are referenced.
- One-off scripts under `scripts/`: many are maintenance or historical operational tools; move/delete only after checking direct references and intended workflow ownership.
