# Security Remediation Tasks (Dependabot)

## 1) SheetJS / `xlsx` vulnerabilities (Prototype Pollution + ReDoS)
- [x] Decide migration path for `xlsx` (current npm package is unmaintained and does not provide a patched npm release).
- [x] Preferred: replace `xlsx` with a maintained library (evaluate `exceljs` and `xlsx-populate`) and remove `xlsx` from `package.json`.
- [x] If replacement is not immediate: pin to CDN-hosted SheetJS CE patched build (`>=0.20.2`) outside npm and document supply-chain handling.
- [x] Audit all spreadsheet import paths; block untrusted file parsing until migration is complete.
- [x] Add regression tests for spreadsheet import/export to validate behavior after migration.

## 2) `basic-ftp` path traversal (transitive via Puppeteer)
- [x] Upgrade `puppeteer` and `puppeteer-core` to versions that resolve `basic-ftp` to `>=5.2.0`.
- [x] Run lockfile refresh (`npm install`) and verify `basic-ftp` no longer resolves below `5.2.0`.
- [x] Add temporary note in security docs: avoid `downloadToDir()` against untrusted FTP servers until fully patched dependency tree is confirmed.

## 3) `flatted` prototype pollution (transitive via ESLint)
- [x] Upgrade toolchain deps (`eslint` and related packages) so `flatted` resolves to `>=3.4.2`.
- [x] Refresh lockfile and verify no `flatted` entry at or below `3.4.1`.
- [x] Run lint/test pipeline after upgrade to catch config or plugin incompatibilities.

## 4) `minimatch` ReDoS (transitive via ESLint/Jest/Next config chain)
- [x] Update dependency graph so vulnerable `minimatch` versions are removed (`>=3.1.3` minimum; prefer latest secure major where supported).
- [x] Rebuild lockfile and verify no vulnerable `minimatch` versions remain.
- [x] Review code/config surfaces where user-controlled glob patterns may be accepted; add input restrictions for glob complexity.

## 5) Next.js image optimization cache DoS
- [x] Upgrade `next` to a patched version that includes bounded image cache behavior.
- [x] Configure `images.maximumDiskCacheSize` explicitly in `next.config.*` (set a bounded value, not default behavior).
- [x] Add an operational task/cron to prune `.next/cache/images` for environments where disk pressure matters.

## 6) Next.js `next-resume` postponed body buffering issue
- [x] Upgrade `next` to a version that enforces postponed-body size limits across all buffering paths.
- [x] Add edge/server middleware rule to block external requests containing `next-resume` header as defense-in-depth.
- [x] Add a negative test that sends oversized `next-resume` payloads and asserts request rejection.

## 7) Validation and rollout
- [x] Run full validation: `npm run lint`, `npm test`, and `npm run build`.
- [x] Run `npm audit` (or your CI security scan) and confirm all listed Dependabot alerts are closed.
- [ ] Create one PR dedicated to security dependency remediation with before/after vulnerability evidence.
- [x] Add a follow-up monthly dependency update task to avoid alert accumulation.
