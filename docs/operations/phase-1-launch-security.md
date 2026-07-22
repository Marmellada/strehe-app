# Launch Security Phase 1 operations

## Public entry points

Authentication redirects now pass through the shared internal-path validator in
`lib/security/internal-path.ts`. The login page and callback route accept only
same-application paths beginning with exactly one slash and fall back to
`/dashboard`.

Other redirect destinations were reviewed:

- proxy login redirects derive `next` from the request pathname and are
  revalidated by the login page;
- public portal links use the fixed app-domain login URL;
- password invitation redirects are constructed from the configured application
  base URL and the fixed `/auth/setup-password` path;
- application action redirects are fixed paths or paths built from database IDs.

## Public contact controls

The server action applies normalized schema validation, field-size limits,
honeypot containment, and a 15-minute duplicate check against recent equivalent
website leads. Validation and honeypot failures do not initialize the
service-role client. A duplicate returns the same generic success response
without inserting another lead. Database failures return generic customer copy.

There is no durable application-level rate-limit store in this repository.
An in-memory limiter is intentionally not used because serverless instances do
not share durable state.

Before launch, configure a Vercel Firewall rate-limit rule named
`public-contact-rate-limit`:

- conditions: request method is `POST` and request path matches
  `^/(en|sq|de)/contact/?$`;
- strategy: fixed window;
- counting key: IP;
- limit: 5 requests per 60 seconds;
- enforcement: return HTTP 429 after first observing the rule in Log mode.

Publish the firewall change separately from this code. Vercel documents the
dashboard workflow and recommends observing custom rules before enforcement:
https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

## Inspection Lab production access

Phase 1 keeps the experimental implementation in the repository but restricts
every production-facing boundary to active administrators.

| Entry point | Admin | Office | Field | Contractor | Household | Agent | Inactive / unauthenticated |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/inspection-lab/bathroom-base-shot` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `/inspection-lab/bathroom-base-shot/photos/[photoId]` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `saveInspectionLabPhotoMetadataAction` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `updateInspectionPhotoMetadataAction` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `runInspectionCaseAction` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `saveInspectionTrackedObjectAction` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `saveInspectionTrackedObjectMarkerAction` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| `toggleInspectionTrackedObjectAction` | Allow | Deny | Deny | Deny | Deny | Deny | Deny |

Both pages already require the admin role. All six exported server actions now
pass through the same active-admin guard before the service-role client is
initialized. The algorithms, mobile experiment, storage model, and database
schema remain unchanged; assignment-aware access is deferred to a later design.
