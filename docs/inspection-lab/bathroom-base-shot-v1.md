# Bathroom Base-Shot Engine V1

## Purpose

This is the first local inspection-engine prototype for STREHË.

It is intentionally narrow:

- bathroom only
- one baseline photo
- one current photo
- one main direction only

The goal is not to prove perfect visual truth.

The goal is to learn whether a very constrained before/after bathroom comparison can produce useful:

- quality warnings
- framing/similarity signals
- coarse scene-change findings
- review-oriented report output

## What v1 checks

- image dimensions
- portrait orientation
- brightness
- contrast
- blur score
- rough same-room similarity
- rough change severity
- whether manual review is recommended

## What v1 does not try to solve

- exact missing item truth
- exact placement consistency
- damage detection
- shelf inventory comparison
- apartment-wide inspection
- mobile capture workflow

## Input contract

Each case uses a simple manifest:

```json
{
  "case_id": "bathroom-example-001",
  "room_type": "bathroom",
  "capture_type": "base_shot",
  "baseline_photo": { "path": "./baseline.jpg" },
  "current_photo": { "path": "./current.jpg" },
  "output_dir": "../results/bathroom-example-001"
}
```

## Output

The runner writes:

- `findings.json`
- `report.md`

## Suggested capture rule

For now, the base shot should:

- be portrait orientation
- show the main bathroom direction
- include as many major fixtures as possible
- avoid extreme tilt
- avoid very dark framing
- avoid heavy obstruction

## Expected finding types

- `baseline_low_quality`
- `current_low_quality`
- `framing_variance`
- `probable_wrong_room`
- `review_required`
- `major_visual_change`
- `moderate_visual_change`

## Next expansion if this proves useful

1. more bathroom test pairs
2. stronger thresholds based on real examples
3. optional fixture-aware prompts
4. API-backed upload flow
5. Android capture app
6. laptop review UI in STREHË Admin
