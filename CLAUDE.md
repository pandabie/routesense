# RouteSense — Agent Instructions

RouteSense is a research portfolio prototype: perception-aware visualization of
maritime trajectory anomalies (JavaScript + ArcGIS Maps SDK, Vite/ESM).
It supports an MSc application. Code quality and honest scoping matter more
than feature count.

## Non-negotiable invariants

1. **Scope discipline.** Implement exactly what the current phase in
   `PROJECT_PLAN.md` specifies. Do not add features, refactors, or
   "improvements" outside the phase scope. If something outside scope looks
   broken, report it — do not fix it silently.
2. **Framing rules (research honesty).**
   - This project contains NO machine learning. Never describe it as
     ML, AI detection, "Explainable GeoAI", or "XGeoAI" in code comments,
     README, or commit messages.
   - Correct framing: "the visualization and interpretability layer that a
     GeoAI detection model will need."
   - Real AIS data (Gothenburg sample) gets NO thresholds, NO detection,
     NO anomaly labels. Differences between AIS-reported and computed values
     are descriptive observations only — never "sensor error", "validation
     score", or "anomaly".
   - Synthetic dataset: segment 6→7 is the primary narrative anomaly; the
     threshold rule intentionally over-flags 5→6, 6→7, 7→8. This mismatch is
     the core research finding. Never "fix" it.
3. **Architecture boundaries.**
   - Dataset selection happens once at boot via `?dataset=` query param.
     Do not introduce runtime hot-swapping of datasets.
   - Panel-first interaction. ArcGIS popups stay disabled.
   - Synthetic and real-AIS analysis assumptions stay separated
     (see `src/datasets.js` analysis profiles).
4. **Testing.** Run `npm test` (Node built-in test runner) before and after
   every change. All existing tests must pass. New behavior in `src/` gets
   unit tests. Do not test DOM rendering.
5. **Git hygiene.** One phase = one branch = focused commits. Never commit
   with failing tests. Commit messages describe what changed and why, in
   plain language, no marketing adjectives.

## Module map

- `src/config.js` — constants (thresholds, map config, UI layout)
- `src/geo.js` — geodesic math
- `src/data.js` — synthetic fixture
- `src/real-ais-sample.js` — Gothenburg AIS raw records + provenance
- `src/ais.js` — AIS normalization
- `src/datasets.js` — dataset descriptors, registry, selection boundary
- `src/analysis.js` — trajectory model + threshold rule (synthetic only)
- `src/measurement-review.js` — descriptive AIS-vs-computed comparison (real only)
- `src/panels.js` — panel rendering
- `src/main.js` — composition root
- `tests/` — regression suite (70 tests at Phase 9.4)

## Workflow expectations

- Read `PROJECT_PLAN.md` and confirm which phase is active before editing.
- Propose a short implementation plan first; wait for approval on anything
  that touches more files than the phase spec lists.
- After implementing: run tests, show a summary of changed files, and list
  anything you noticed but deliberately did not touch.
