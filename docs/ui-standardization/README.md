# STREHË UI Standardization Inventory

These files are Excel-friendly CSV inventories for the post-stabilization UI/system phase.

Files:

- `01_component_inventory.csv`
  - the UI element types we should standardize
- `02_control_matrix.csv`
  - what can be controlled globally for each element vs what stays page-local
- `03_current_repo_audit.csv`
  - what the repo currently has, what is shared vs legacy, and what needs migration
- `04_implementation_order.csv`
  - recommended execution order for standardization

How to use:

1. Open each CSV in Excel.
2. Treat each file like a worksheet.
3. Review and edit the decisions together before implementation begins.

Important notes from the repo sweep:

- The app currently has two visual systems in parallel:
  - newer shared UI primitives in `components/ui/*`
  - older global CSS helpers in `assets/css/components.css` and `app/globals.css`
- The shell/layout still uses a lot of inline styling in [app/layout.tsx](/d:/Personal/Projects/Strehe-Prona/strehe-app/app/layout.tsx).
- There are legacy or duplicate UI files that should not become the future standard:
  - [app/settings/BankAccountForm.tsx](/d:/Personal/Projects/Strehe-Prona/strehe-app/app/settings/BankAccountForm.tsx)
  - [components/users/CreateUserForm.tsx](/d:/Personal/Projects/Strehe-Prona/strehe-app/components/users/CreateUserForm.tsx)
  - scaffold/redirect pages like `tenants`, `leases`, `units`, `users`
- Some shared primitives still need hardening before they become the standard:
  - [components/ui/FormInput.tsx](/d:/Personal/Projects/Strehe-Prona/strehe-app/components/ui/FormInput.tsx)
  - [app/layout.tsx](/d:/Personal/Projects/Strehe-Prona/strehe-app/app/layout.tsx)
  - [app/page.tsx](/d:/Personal/Projects/Strehe-Prona/strehe-app/app/page.tsx)

Locked boundary rules:

- Do not include in the global control system:
  - per-component spacing overrides
  - per-page typography tweaks
  - per-module styling differences
- Keep page-local:
  - page composition
  - layout structure
  - grouping
  - section arrangement
- Keep business-local:
  - filters
  - workflow behavior
  - field visibility
  - business-specific UI logic
- Keep table-local:
  - columns
  - ordering
  - business meaning
- Keep module-local:
  - module-specific actions
  - action placement, within reason
- Do not globalize:
  - page header layout variants
  - form layout variants per module

The future appearance control panel should govern only the shared visual language:

- colors
- text colors
- border colors
- surfaces/backgrounds
- button visuals
- field visuals
- badge/status visuals
- table/header/border visuals
- card visuals
- shell visuals
- radius/shadow/state styling

Locked boundary rules:

- Do not include in the global control system:
  - per-component spacing overrides
  - per-page typography tweaks
  - per-module styling differences
- Keep page-local:
  - page composition
  - layout structure
  - grouping
  - section arrangement
- Keep business-local:
  - filters
  - workflow behavior
  - field visibility
  - business-specific UI logic
- Keep table-local:
  - columns
  - ordering
  - business meaning
- Keep module-local:
  - module-specific actions
  - action placement, within reason
- Do not globalize:
  - page header layout variants
  - form layout variants per module

The future appearance control panel should govern only the shared visual language:

- colors
- text colors
- border colors
- surfaces/backgrounds
- button visuals
- field visuals
- badge/status visuals
- table/header/border visuals
- card visuals
- shell visuals
- radius/shadow/state styling
