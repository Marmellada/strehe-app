# Bathroom Base-Shot Inspection Lab

This folder is the local-only v1 test harness for bathroom base-shot comparison.

## Goal

Compare exactly two bathroom photos:

- one baseline photo
- one current photo

And produce:

- quality checks
- same-room / framing confidence
- coarse change severity
- structured findings
- markdown report

## How to use

1. Put your test case files inside a case folder.
2. Update the `manifest.json` paths.
3. Run:

```bash
npm run inspect:bathroom -- inspection-lab/bathroom-base-shot/example-case/manifest.json
```

4. Check the generated output in:

```txt
inspection-lab/bathroom-base-shot/results/<case-id>/
```

## Honest limitations of v1

- bathroom only
- one base shot only
- no object-level truth
- no damage detection
- no mobile app
- no production workflow yet

This is a local comparison engine only.
