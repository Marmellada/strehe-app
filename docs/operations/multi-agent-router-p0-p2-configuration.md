# Multi-Agent Router P0-P2 operator configuration

The files in `scripts/gmk-agent-worker/config-examples/` are version-controlled,
non-secret templates. They are not live configuration. An authorized operator must
copy them to the runtime root before live router execution.

The required live paths are:

- `D:\Personal\Projects\Strehe-Prona\STREHE-ENGINEERING-RUNTIME\config\router.models.json`
- `D:\Personal\Projects\Strehe-Prona\STREHE-ENGINEERING-RUNTIME\config\router.budget.json`
- `D:\Personal\Projects\Strehe-Prona\STREHE-ENGINEERING-RUNTIME\config\router.ratecard.json`

From the repository root, an authorized operator can provision the files with
PowerShell after reviewing them:

```powershell
$routerConfig = 'D:\Personal\Projects\Strehe-Prona\STREHE-ENGINEERING-RUNTIME\config'
New-Item -ItemType Directory -Path $routerConfig -Force
Copy-Item -LiteralPath '.\scripts\gmk-agent-worker\config-examples\router.models.json.example' -Destination "$routerConfig\router.models.json"
Copy-Item -LiteralPath '.\scripts\gmk-agent-worker\config-examples\router.budget.json.example' -Destination "$routerConfig\router.budget.json"
Copy-Item -LiteralPath '.\scripts\gmk-agent-worker\config-examples\router.ratecard.json.example' -Destination "$routerConfig\router.ratecard.json"
```

The router environment file must also be provisioned separately by an authorized
operator at:

`D:\Personal\Projects\Strehe-Prona\STREHE-ENGINEERING-RUNTIME\.env.gmk-router.local`

Do not commit that environment file or place credentials in the JSON config files.
The environment must supply `OPENCODE_GO_API_KEY` (or the supported fallback
`OPENCODE_API_KEY`); `OPENCODE_BASE_URL` is optional. This repository intentionally
does not contain a populated router environment file.

The configured rolling 5-hour, 7-day, and 30-day `max_usd_estimate` values are
internal operator safety ceilings, not authoritative OpenCode provider limits. The
5/20/60 USD defaults are intentionally conservative relative to provider limits of
12/30/60 USD. The token ceilings are independent internal planning/safety ceilings
and are not equivalent to provider dollar limits.

`loadRouterConfig` reads and validates the live JSON filenames above when present;
the focused router tests also copy these examples to those filenames and validate
them. `opencode/deepseek-v4-pro` must remain disabled.
