# RouteSense: Perception-Aware Maritime Trajectory Visualization

RouteSense is a JavaScript + ArcGIS prototype exploring how interface design can
help users notice, inspect, and interpret unusual vessel movement in maritime
trajectory data.

> Portfolio project for a thesis-based MSc Computer Science application focused
> on human-centred geospatial visualization, trajectory interpretation, and
> perception-aware interaction design.

---

## Abstract

RouteSense renders an eight-point synthetic maritime trajectory in Halifax
Harbour and separates two layers that are often collapsed together:

1. **what a deterministic threshold rule flags**, and
2. **which segment the visualization treats as the primary anomaly**.

The current prototype computes segment distance, estimated speed, heading, and
heading change; evaluates every segment against a normal-movement baseline; and
presents the resulting evidence through a persistent side panel. Vessel Point
6 → Vessel Point 7 remains the primary RouteSense anomaly, while adjacent
rule-flagged segments are presented as supporting evidence rather than competing
primary anomalies.

The project currently uses synthetic AIS-like data and a transparent rule-based
prototype. It does not use machine learning, black-box inference, or real AIS data.

---

## Research Question

> How can perception-aware visual design help users notice and interpret
> anomalous vessel movement more effectively than a conventional map display?

Most maritime anomaly work concentrates on detection performance. RouteSense
focuses on the complementary interface problem: once movement is flagged, how
should the evidence be presented so that a human can distinguish a primary
anomaly from nearby contextual changes?

## Approach: Interface Layer First

RouteSense develops the visualization and interpretation layer before adding
more advanced data or detection methods. This sequencing creates a clear object
of study: not merely whether a rule returns `true`, but how its output is framed,
compared, and interpreted in the interface.

---

## System Design

### Perception-Aware Anomaly Cue

The primary anomaly is encoded through multiple visual channels rather than
color alone.

| Visual channel | Normal trajectory | Primary anomaly |
|---|---|---|
| Color | Blue | Red-orange |
| Line style | Solid | Dashed |
| Line weight | Thin | Thick |
| Depth cue | None | Subtle glow |

The normal trajectory remains visible because the anomaly only becomes meaningful
when compared with surrounding movement.

### Panel-First Interaction

RouteSense disables ArcGIS popups and uses one persistent information panel.
Every clickable trajectory segment produces a segment-specific response:

| Selected segment | Panel response |
|---|---|
| 1→2, 2→3, 3→4, 4→5 | Normal Segment Context |
| 5→6 | Supporting Rule Evidence: pre-anomaly |
| 6→7 | Primary anomaly + complete Rule Evidence Review |
| 7→8 | Supporting Rule Evidence: post-anomaly |

Clicking a vessel point still provides local point context, while clicking a
direction arrow reports movement direction.

### Computed Trajectory Evidence

Each segment is derived from latitude, longitude, and timestamp using plain
JavaScript. The analysis pipeline computes:

- Haversine distance
- estimated speed
- compass heading
- normalized heading change from 0° to 180°
- comparison against a baseline derived from Points 1–5

For the configured primary anomaly:

| Feature | Normal baseline | Segment 6→7 |
|---|---:|---:|
| Estimated speed | ~6.6 km/h | ~12.4 km/h (+88%) |
| Heading change | ~0° | ~148° |

### Configurable Layout

Desktop panel width and map framing are controlled in `src/config.js`:

```js
export const UI_LAYOUT = {
  infoPanelWidth: 420,
  panelInset: 16,
  mapRightPadding: 470,
  desktopBreakpoint: 900
};
```

The information panel remains anchored to the browser edge, while ArcGIS view
padding shifts the effective map centre so the trajectory is not obscured by the
panel.

---

## Detection: Threshold-Based Prototype Rule

A segment is flagged when either condition is true:

- estimated speed is greater than `1.5 ×` the baseline average speed, or
- heading change is greater than `45°`.

This is a deterministic starter rule, not a trained model.

## Phase 8: Rule Evidence Review and Threshold Explanation

Applying the rule to the complete trajectory flags three segments:

| Segment | Estimated speed | Heading change | Rule trigger | Interface role |
|---|---:|---:|---|---|
| 5→6 | ~15.2 km/h | ~66° | Speed + heading | Supporting, pre-anomaly evidence |
| 6→7 | ~12.4 km/h | ~148° | Speed + heading | Primary RouteSense anomaly |
| 7→8 | ~6.2 km/h | ~85° | Heading only | Supporting, post-anomaly evidence |

The rule therefore identifies a wider region of unusual movement than the
single primary anomaly selected for the visualization narrative. Phase 8 makes
that mismatch visible instead of hiding it.

The interface preserves three distinctions:

- **rule status:** whether the threshold rule flagged a segment
- **evidence relation:** whether the segment occurs before, at, or after the
  primary anomaly
- **visual priority:** only 6→7 receives the primary anomaly map encoding

This is the main Phase 8 finding: a simple rule can identify several locally
unusual movements without determining which one should carry the strongest
interpretive emphasis in the interface.

### Phase 8 Acceptance Checklist

- [x] Vessel Point 6→7 remains the only primary anomaly map highlight.
- [x] Segments 5→6 and 7→8 are presented as supporting evidence.
- [x] Each flagged segment explains exactly which threshold conditions fired.
- [x] Segment 7→8 is explicitly identified as heading-change-only evidence.
- [x] Normal segments 1→2 through 4→5 return segment-specific, not-flagged context.
- [x] Segment 1→2 reports heading change as unavailable rather than falsely using 0°.
- [x] All interactions remain panel-first; ArcGIS popups remain disabled.
- [x] Panel width and map framing are configurable without changing trajectory data.
- [x] The modular analysis and panel regression tests pass.
- [x] No real AIS ingestion or machine-learning functionality was added in Phase 8.

---

## Limitations

- **Manually configured primary anomaly.** Segment 6→7 is selected in configuration;
  the threshold rule does not decide narrative priority.
- **Synthetic AIS-like data.** The current trajectory is a controlled prototype,
  not a real vessel record.
- **Simple threshold rule.** The rule does not model vessel class, operational
  context, environmental conditions, or uncertainty.
- **Single trajectory.** Multi-vessel comparison and clutter handling are not yet
  implemented.
- **No user evaluation yet.** The perception-aware interface has not been tested
  in a formal study.

## Planned Evaluation

A future exploratory study could compare a conventional color-only condition
against the full perception-aware condition. Candidate measures include detection
time, identification accuracy, confidence, and cognitive load. This evaluation
has not yet been conducted.

---

## Development Phases

| Phase | Focus | Status |
|---|---|---|
| 0–1 | Project setup and ArcGIS map prototype | ✅ Complete |
| 2–3.5 | Trajectory visualization and expanded eight-point context | ✅ Complete |
| 4 | Perception-aware anomaly cue and explanation panel | ✅ Complete |
| 5–5.5 | Point interaction and unified panel model | ✅ Complete |
| 6 | Computed speed, heading, and baseline comparison | ✅ Complete |
| 7 | Threshold-based detection starter | ✅ Complete |
| 7.5 | Modular analysis pipeline and regression tests | ✅ Complete |
| 8 | Rule evidence review, segment-specific explanation, and visual hierarchy | ✅ Complete |
| 9 | Real AIS data contract and integration | 🔲 Planned |

---

## Tech Stack

- JavaScript ES modules
- ArcGIS Maps SDK for JavaScript
- Vite
- HTML and CSS
- Node built-in test runner

Spatial, temporal, and statistical helpers are implemented in plain JavaScript
without an additional geospatial analysis dependency.

## Repository Structure

```text
routesense/
├── src/
│   ├── analysis.js   # Segment features, baseline, detection, evidence roles
│   ├── config.js     # Map, rule, encoding, anomaly, and layout configuration
│   ├── data.js       # Synthetic AIS-like trajectory and route metadata
│   ├── geo.js        # Pure geometry, time, and statistics helpers
│   ├── main.js       # ArcGIS composition root, graphics, and click routing
│   ├── panels.js     # Pure data-to-HTML panel renderers
│   └── style.css     # Map, panel, hierarchy, and responsive styling
├── tests/
│   ├── analysis.test.js
│   └── panels.test.js
├── index.html
├── package.json
└── README.md
```

## Run Locally

```bash
npm install
npm test
npm run dev
```

---

## References

- Bertin, J. (1983). *Semiology of Graphics*. University of Wisconsin Press.
- Healey, C., & Enns, J. (2012). Attention and visual memory in visualization and
  computer graphics. *IEEE Transactions on Visualization and Computer Graphics*,
  18(7), 1170–1188.
- Munzner, T. (2009). A nested model for visualization design and validation.
  *IEEE Transactions on Visualization and Computer Graphics*, 15(6), 921–928.
- Ware, C. (2004). *Information Visualization: Perception for Design* (2nd ed.).
  Morgan Kaufmann.
