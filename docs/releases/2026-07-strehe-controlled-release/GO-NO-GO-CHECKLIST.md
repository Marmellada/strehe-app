# Production Go/No-Go Checklist

Current recommendation: **NO-GO for production execution**

## Technical gates

| Gate | Current status | Required evidence |
| --- | --- | --- |
| Release candidate frozen | PASS | RC `eb30d0ec…`, linear and 0 behind main |
| Pending migration list frozen | PASS | Exactly three linked pending versions |
| Local replay/regressions | PASS | Replay, dry run, tests, smokes, lint, TS, build |
| Production structural preflight | PASS WITH FINAL CHECK | Recent schema evidence; rerun fail-closed script |
| Production data preflight | PENDING/BLOCKING | `stop_count=0` immediately before migration |
| Backup/recovery | FAIL/BLOCKING | No listed backup; PITR false |
| Vercel project/production branch | UNRESOLVED/BLOCKING | Authenticated dashboard evidence |
| Vercel rollback | UNRESOLVED/BLOCKING | Last healthy deployment and promotion access |
| Critical environment variables | UNRESOLVED/BLOCKING | Presence/targets verified without values |
| Contact rate limiting | UNVERIFIED/BLOCKING FOR PUBLIC LAUNCH | Firewall rule evidence |
| Hermes release-package review | PENDING/BLOCKING | PASS on this package |
| Founder database authorization | NOT GRANTED | New explicit GO |
| Founder application authorization | NOT GRANTED | Separate GO after DB PASS |

## Decision sequence

1. Resolve backup/recovery.
2. Resolve Vercel and rate-limit evidence.
3. Obtain Hermes package review.
4. Run final preflight and capture zero STOP counts.
5. Founder decides database GO/NO-GO.
6. Apply and verify migrations if GO.
7. Founder decides application GO/NO-GO.
8. Deploy and run read-only smoke if GO.
9. Keep onboarding and paid acquisition separately gated.

Technical deployment may be approved without approving paid acquisition.
Customer onboarding/service commencement remains blocked until applicable legal,
key-custody, emergency-authority, and operational controls are complete.
