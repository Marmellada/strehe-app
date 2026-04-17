# Room State Inspection Architecture

## Purpose

This document defines the intended long-term shape of the STREHE inspection lab.

The goal is to evolve from a simple photo comparison experiment into a trustworthy inspection workflow that:

- captures baseline property state
- tracks important visible objects over time
- compares later inspection sets against earlier evidence
- helps workers and reviewers identify missing or moved items
- preserves a clear audit trail once an inspection is closed

This document is intentionally product-first and operationally strict. It prefers evidence and review over automation theater.

## Core Product Principle

The engine should only claim what the image evidence supports.

Allowed:

- object X was visible in the baseline image
- object X is not visible in the current frame
- object X is not visible anywhere in the current inspection set
- object Y appears to have moved within the current inspection set
- manual review is required

Not allowed as automatic final truth:

- object X is definitely stolen
- object Y is definitely removed from the property
- object Z was definitely replaced

Those stronger conclusions require human confirmation.

## Product Model

The system should be **object-first**, with room as organizational metadata.

That means:

- rooms help group and label photos
- tracked objects are the real comparison unit
- reports are built around observed object evidence and human review

Room type remains useful for capture flow and photo organization, but the engine should not be built as a maze of hardcoded room-specific business logic.

## Main Concepts

### 1. Property Inspection Baseline

The baseline is the first reviewed reference state for a property.

It includes:

- baseline inspection set
- ordered photos
- baseline object review
- approved tracked objects
- baseline evidence for each tracked object

The baseline establishes what the system is allowed to compare against later.

### 2. Inspection Set

An inspection set is a collection of ordered photos for a property and time.

Examples:

- baseline set
- follow-up inspection set
- move-out set
- contractor completion set

Each set should include:

- property id
- optional room/area metadata
- ordered photos
- capture labels
- timestamps
- uploaded by

### 3. Tracked Object

A tracked object is something the system should explicitly watch across inspections.

Tracked objects come from two sources:

- engine-detected and approved
- manually added by reviewer

Each tracked object should store:

- label
- category
- importance
- source (`auto_detected`, `manual_added`, `manual_corrected`)
- baseline evidence
- review status

### 4. Object Observation

Each inspection set should create observations for tracked objects.

Example observation states:

- visible
- not_visible_in_frame
- not_visible_in_current_set
- possible_moved
- uncertain

These are engine-review states, not final legal truth states.

### 5. Review Decision

A reviewer or worker confirms what the engine suggested.

Possible reviewed statuses:

- confirmed_visible
- confirmed_missing
- confirmed_moved
- confirmed_replaced
- false_alarm
- unresolved

### 6. Closed Inspection Record

Once an inspection is reviewed and closed, it becomes part of the audit trail.

Closed records should not be casually edited in place.

## Why Object-First Matters

We do not want a system that depends on endless special-case rules like:

- bathroom engine
- living room engine
- kitchen engine
- bedroom engine

That path becomes rigid too early.

The better shape is:

- one generic inspection engine
- one shared object model
- room/area metadata for organization
- room-specific defaults only where useful

This keeps the model extensible while still allowing practical capture flows.

## Default Tracked Object Strategy

The system should support a broad house object vocabulary, but only a smaller subset should be treated as high-confidence tracked defaults.

### High-confidence default tracked objects

#### Bathroom

- sink
- mirror
- toilet
- bathtub or shower
- cabinet
- fixed lighting fixture
- wall-mounted fixtures

#### Living room

- sofa
- coffee table
- TV
- TV stand
- armchair
- wall art / painting
- wall mirror
- fixed lighting fixture

### Broader capture labels

Upload labels may remain broader, for example:

- shelf
- decor
- plant
- figurine
- vase
- box

These are useful for documentation, but they should not automatically become high-confidence tracked objects unless reviewed and approved.

## Manual Addition and Baseline Review

Manual addition is a core feature, not a later cosmetic extra.

We need a dedicated baseline review UI where a reviewer can:

- open a photo
- see engine-detected objects
- inspect object labels
- approve or reject engine suggestions
- rename or recategorize objects
- mark object importance
- add a manual object by clicking/selecting in the image
- adjust the marked region if needed

This is how the system becomes useful for:

- valuable figurines
- decorative boxes
- collectibles
- specific paintings
- special lamps
- unusual but important owner items

## Evidence Model

Each tracked object should keep evidence, not just text.

### Baseline evidence

- source photo id
- approximate image region
- object label
- category
- importance
- optional reviewer note
- optional appearance note

### Current observation evidence

- source photo id if found
- approximate image region if found
- confidence
- reason
- comparison outcome

This supports the desired user experience:

- “This object was here before”
- “It looked like this”
- “It is not visible in the current inspection set”

## Missing Object Logic

The engine should not say an object is missing just because it is absent from one image.

The correct rule is:

1. object was visible in baseline evidence
2. engine checks the entire current inspection set
3. if object is not visible anywhere in the current set, mark:
   - `not_visible_in_current_set`
4. reviewer physically verifies before finalizing the finding

This reduces false alarms caused by:

- angle changes
- occlusion
- clutter
- partial coverage

## Moved / Replaced Object Logic

The engine may propose:

- possible moved
- possible replaced

But those should remain suggestions until reviewed.

The reviewer decides:

- yes, object moved
- yes, object replaced
- no, false alarm
- needs follow-up

## Historical Comparison Strategy

The system should eventually compare against both:

- original reviewed baseline
- latest reviewed inspection set

Why:

- original baseline preserves long-term truth
- latest reviewed set is often the best operational comparison for the next visit

So the intended long-term model is hybrid:

- baseline for historical anchor
- latest reviewed set for practical continuity

## Inspection Lifecycle

Suggested lifecycle:

- `draft`
- `engine_reviewed`
- `worker_reviewed`
- `office_reviewed` or `supervisor_reviewed`
- `closed`
- `post_processed`

The exact names can be adjusted later, but the lifecycle distinction must remain.

### Before close

Allowed:

- upload and replace photos
- edit metadata
- rerun engine
- adjust tracked objects
- review findings

### At close

The system should:

- snapshot the current findings
- snapshot the final report
- mark the inspection closed
- prevent casual editing

## Closed Record Rule

Closed inspections should behave like immutable logs at the product level.

That means:

- no casual editing after closure
- no overwriting final report text
- no silently changing object findings later

If a mistake or clarification appears later, we should create a linked follow-up record rather than rewriting history.

## Post-Processing Flow

Post-processing is required for real-life cases such as:

- owner removed item before visit
- worker physically checked and found a false alarm
- object was intentionally replaced
- reviewer made a mistaken assumption at close

In these cases:

- original inspection remains closed and preserved
- a post-processing record is created
- the resolution is linked to the original finding

Possible post-processing outcomes:

- resolved_not_missing
- resolved_moved
- resolved_replaced
- owner_confirmed_removed
- false_alarm

## Worker Resolution Options

For the first real workflow, the worker-facing resolution list should stay small and operational.

Recommended starter options:

- `confirmed_missing`
- `found_elsewhere`
- `returned_to_original_place`
- `confirmed_moved`
- `confirmed_replaced`
- `unresolved`

These should be treated as configurable workflow options with:

- code
- label
- active
- inactive

Why:

- the wording stays practical
- the set can evolve later
- old logs remain valid even if an option is retired

The phrase `false_alarm` does not need to be primary UI language in the first worker flow. The same operational meaning can usually be expressed by:

- `found_elsewhere`
- `returned_to_original_place`
- `unresolved`

## Active / Inactive Policy

Where it makes sense, the system should support `active` / `inactive` rather than hard delete or permanent visibility.

This should apply to:

- tracked objects
- worker resolution options
- default tracked object definitions

This allows us to:

- retire objects or options without losing history
- keep audit logs stable
- stop tracking something going forward while preserving what happened before

## Closure Rule

The inspection should be closed by the worker assigned to inspect that property.

This means:

- the assigned worker completes the physical verification
- the assigned worker reviews the engine suggestions
- the assigned worker applies the final worker resolution statuses
- the assigned worker closes the inspection log

If office or admin later need to comment or correct something, that should happen through linked post-processing or resolution records, not by casually rewriting the original closed inspection.

## Role Split

### Engine

Responsible for:

- object suggestions
- visibility comparisons
- evidence references
- confidence hints
- narrative drafting

### Worker / Reviewer

Responsible for:

- approving baseline tracked objects
- confirming missing or moved items physically
- resolving uncertainty
- closing the inspection
- handling post-processing when necessary

## Phase Plan

### Phase 1

Goal: baseline evidence + honest comparison

Include:

- ordered inspection sets
- object-first internal model
- baseline object review
- high-confidence tracked defaults
- manual object addition
- current-set visibility comparison
- “not visible in current set” wording
- close inspection flow

Do not include:

- exact room coordinates
- perfect spatial relocation
- every decorative object as default tracked
- strong automatic theft/replacement claims

### Phase 2

Goal: stronger evidence and reviewer tooling

Include:

- evidence snippets/crops
- object markers in image
- baseline/current evidence pairing
- clearer moved-object suggestions
- richer report outputs

### Phase 3

Goal: multi-inspection historical reasoning

Include:

- original baseline + latest reviewed set hybrid comparison
- post-processing workflow
- stronger audit trail views
- richer object history

## Key Product Restrictions

These restrictions are intentional and healthy:

- engine speaks about image visibility, not absolute truth
- default tracked objects are narrow and high-confidence
- broader labels remain allowed for capture
- manual additions are reviewed, not automatically trusted
- final truth requires human confirmation
- closed records are preserved

## Naming Rule

Implementation naming should reflect the real product model, not old experimental scope.

Guideline:

- prefer `inspection`, `room-state`, `tracked-object`, `inspection-set`, `observation`, `resolution`
- avoid keeping legacy `bathroom-*` names once the code is clearly serving multiple room types or a broader object model

This matters because stale naming creates hidden product debt:

- it confuses routes and docs
- it hides the true scope of the module
- it makes future refactors harder than they need to be

Practical rule:

- experimental route names may temporarily lag behind
- core domain types, services, and tables should move toward correct naming as the model stabilizes

## Summary

The intended product is not “AI sees everything in the house.”

It is:

- a property inspection system
- with baseline visual evidence
- with tracked important objects
- with object visibility comparison across inspection sets
- with worker and reviewer confirmation
- with a reliable audit trail once inspections are closed

That is the design target this lab should grow toward.
