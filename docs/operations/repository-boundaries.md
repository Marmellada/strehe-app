# Repository boundaries

This inventory records the disposition of the untracked path groups visible on
`qwen-inspection-lab-drafts` on 2026-07-22. It classifies exact groups; it does
not assert that every individual source or evidence file has received a content
review.

## Strehe web application and release gates

| Paths | Disposition | Notes |
| --- | --- | --- |
| `app/**`, `components/**`, `lib/**`, `types/**` | Track as source | Next.js application source. Existing modified and untracked files remain visible for product review. |
| `scripts/**` | Track as source or unresolved—do not ignore | JavaScript automation is included in the web lint gate. Untracked `create-test-users.py` and `create-test-users.bat` remain unresolved because they can affect external data. |
| `tests/**`, `playwright.config.ts` | Track as source | Release checks and Playwright configuration. Generated reports are excluded separately. |
| `next.config.ts`, `proxy.ts`, `postcss.config.mjs`, `eslint*.mjs` | Track as source | Executable build, runtime, and verification configuration. |
| `supabase/**`, `work/**` | Unresolved—do not ignore | Migrations, seed/templates, and SQL chunks must stay visible. They belong with future product/launch work after database review; this task does not execute or alter them. |
| `3DAY_LAUNCH_CHECKLIST.md`, `STREHE_NEXT_PLAN.md`, `STREHE_WEB_APP_NEXT_PLAN.md`, `VERCEL_DEPLOY.md` | Unresolved—do not ignore | Potential planning documentation. Review authority, currency, and future product/launch branch ownership before committing. |
| `AUDIT_REPORT_2026-06.md`, `PROJECT_AUDIT_REPORT.md`, `STREHE_WEB_APP_AUDIT_REPORT.md`, `HERMES_*.md`, `BEFORE_HERMES_AUDIT_*.txt` | Unresolved—do not ignore | Potential audit evidence. Review duplication and retention before committing. |
| `docs/operations/live-supabase-production-setup-plan.md` | Unresolved—do not ignore | Potential launch documentation; keep visible for future product/launch review. |
| `app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx`, `lib/email/client-welcome-email.ts` | Unresolved—do not ignore | Untracked product implementation; keep visible for a future product/launch branch review. |

The required web gate is `npm run lint`. It covers application, shared source,
automation, tests, types, and executable root configuration. TypeScript, the
production build, and public Playwright smoke tests remain separate release
checks.

## Inspection Lab

| Paths | Disposition | Notes |
| --- | --- | --- |
| `inspection-lab/mobile-app/**` except the generated paths below | Track as source | React Native application source, assets, manifest, package files, and documentation belong on the current Lab branch. |
| `inspection-lab/scripts/**` | Track as source | Lab engines, workers, and verification scripts remain visible. |
| `inspection-lab/sql/**`, `inspection-lab/supabase-schema-additions.sql` | Track as source, subject to database review | Lab SQL belongs on the current Lab branch and is never covered by an ignore rule. |
| `inspection-lab/*.md` | Track as source/documentation | Agent instructions, task state, setup, handoff, and integration plans belong with the Lab work after review. |
| `inspection-lab/architecture/*.md`, `inspection-lab/architecture/*.txt` | Track as source/documentation | Editable architecture source and prompt remain visible. |
| `inspection-lab/test-data/**` | Track as selected evidence | Intentional fixtures remain visible. Review selection and provenance before committing; the directory is not ignored. |
| `inspection-lab/e2e-runs/**` | Ignore as reproducible output | Generated local run artifacts; 834 untracked paths were present before this task. |
| `inspection-lab/test-results/**` | Ignore as reproducible output | Generated test output; 34 untracked paths were present before this task. |
| `inspection-lab/mobile-app/.expo/**`, `.cache/**`, `node_modules/**` | Ignore as reproducible output | Local Expo/cache/dependency state, not application source. |
| `inspection-lab/architecture/Inspection_Lab_Lite_Architecture_Pack_v1_5_FINAL_TRUTH.docx` and `.pdf` | Ignore as reproducible output | Derived copies of the visible Markdown architecture source. If one becomes release evidence, move or force-add that reviewed file explicitly. |

The optional diagnostic gate is `npm run lint:inspection-lab`. It excludes only
the generated Lab paths and applies React Native-specific handling for web-only
image/text rules. It intentionally continues to report hook correctness and
unused-code findings and is allowed to fail until a separate cleanup task fixes
those defects.

## Local and generated repository state

| Paths | Disposition | Notes |
| --- | --- | --- |
| `.agents/**`, `.vscode/**`, `START_NEW_CODEX_CHAT_PROMPT.txt` | Keep local only | Personal agent/editor/session state. |
| `.env*` | Keep local only | Existing ignore rule protects machine-specific configuration and secrets. Never print or commit values. |
| `tmp-pdf-screenshots/**`, `tmp-marketing-review/**`, `tmp-marketing-dev*.log` | Ignore as reproducible output | Existing narrow rules cover temporary PDF renders, screenshots, review output, and known development logs. |
| `playwright-report/**`, `test-results/**`, `playwright/.auth/**`, `coverage/**` | Ignore as reproducible output | Existing root test output/auth rules. Selected evidence should be copied to a reviewed, intentionally tracked evidence path. |
| `nul` | Ignore as reproducible output | Existing exact rule prevents a Windows device-name artifact from appearing in status. |
| `BEFORE_HERMES_AUDIT_STATUS.txt`, `BEFORE_HERMES_AUDIT_DIFF_STAT.txt` | Unresolved—do not ignore | Possible audit receipts; keep visible until evidence retention is decided. |

Do not combine unresolved product/launch work with a Lab boundary commit. The
current branch may carry reviewed Inspection Lab source, intentional fixtures,
Lab documentation, and these boundary files. Product code, Supabase changes,
launch plans, and product audit material should be reviewed and committed on a
future product/launch branch. Generated output and personal configuration stay
local; selected golden evidence must be reviewed and added explicitly.
