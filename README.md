ok lets do it # STREHE Prona

STREHE Prona is a property operations system for running the day-to-day work of a managed property business.

The current v1 focus is operational clarity and reliable office workflow:

- clients
- properties
- contracts
- recurring and manual tasks
- keys
- billing
- expenses
- finance overview
- workers and admin settings

## V1 Scope

STREHE Prona v1 is for running property operations in one place.

Main workflow:

1. register clients and properties
2. create contracts and service structure
3. generate and manage work through tasks
4. track keys and field activity
5. issue invoices, record payments, and track expenses
6. monitor the business through dashboard and finance views

## Paused / Internal Work

The inspection lab and AI-assisted inspection experiments are currently paused and are not part of the v1 product promise.

They remain in the repository as internal exploratory work for a later phase.

## Local Development

Run the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Main App Areas

- `app/page.tsx` - dashboard
- `app/tasks` - operational work queue
- `app/properties` - property register
- `app/clients` - client register
- `app/subscriptions` - contracts
- `app/billing` - invoices and payments
- `app/expenses` - operational spend
- `app/finance` - finance overview
- `app/keys` - key register
- `app/workers` - staff records
- `app/settings` - admin configuration

## Notes

- The app uses Next.js App Router and Supabase.
- Some internal tooling and labs remain in the repo but are intentionally not part of launch-facing v1.
