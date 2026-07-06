# RouteSense: Perception-Aware Maritime Trajectory Visualization

RouteSense is a JavaScript + ArcGIS prototype exploring how interface design can
help users notice, inspect, and interpret unusual vessel movement in maritime
trajectory data.

> Portfolio project for a thesis-based MSc Computer Science application focused
> on human-centred geospatial visualization, trajectory interpretation, and
> perception-aware interaction design.

---

## Abstract

RouteSense provides two deliberately separated demonstration modes: an
eight-point synthetic maritime trajectory in Halifax Harbour for controlled
rule-evidence analysis, and a four-observation real AIS sample near Gothenburg
for provenance-aware trajectory display. The synthetic mode separates two
layers that are often collapsed together:

1. **what a deterministic threshold rule flags**, and
2. **which segment the visualization treats as the primary anomaly**.

The current prototype computes segment distance, estimated speed, heading, and
heading change; evaluates every segment against a normal-movement baseline; and
presents the resulting evidence through a persistent side panel. Vessel Point
6 → Vessel Point 7 remains the primary RouteSense anomaly, while adjacent
rule-flagged segments are presented as supporting evidence rather than competing
primary anomalies.

The project uses a transparent rule-based prototype only on the controlled
synthetic fixture. The real AIS sample is rendered in observation-only mode: it
has no inherited baseline, threshold interpretation, or validated anomaly. For
each real-data segment, RouteSense now presents AIS-reported SOG/COG beside
interval-derived speed and bearing as a descriptive measurement comparison. The
project does not use machine learning, black-box inference, or live AIS streaming.

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

## Phase 9.1: AIS Data Contract and Ingestion Boundary

Phase 9.1 adds a pure JavaScript boundary between external AIS records and the
existing RouteSense analysis pipeline. It does not download, render, or interpret
a real dataset yet.

`src/ais.js` converts source-specific records into one canonical point shape:

```js
{
  id,
  order,
  name,
  vesselId,
  timestamp, // ISO-8601 UTC
  latitude,
  longitude,
  reported: {
    sogKnots,
    cogDegrees,
    headingDegrees,
    navigationalStatus: { code, text }
  },
  source: { datasetId, rowIndex, recordId },
  note
}
```

AIS-reported measurements remain under `reported`. They are not copied into the
RouteSense-derived segment metrics such as `estimatedSpeed`, `heading`, or
`headingChange`.

### Common AIS Field Mapping

The initial explicit field map is:

| Canonical field | Common source field |
|---|---|
| vessel identifier | `MMSI` |
| timestamp | `BaseDateTime` |
| latitude | `LAT` |
| longitude | `LON` |
| reported speed over ground | `SOG` |
| reported course over ground | `COG` |
| reported true heading | `Heading` |
| navigational status | `Status` |

A future dataset adapter may replace these source names without changing the
canonical point contract.

### Validation and Normalization Rules

- Vessel identifier, timestamp, latitude, and longitude are required.
- Latitude must be between -90 and 90; longitude between -180 and 180.
- Numeric strings are converted deliberately; blank values are not coerced to zero.
- Timestamps require an explicit `Z` or UTC offset by default and are emitted as UTC.
- A documented source adapter may opt into treating timezone-free source timestamps
  as UTC.
- Input observations are sorted chronologically before final point order is assigned.
- One normalized trajectory may contain only one vessel identifier.
- Exact duplicate observations are removed and reported as warnings.
- Equal vessel timestamps with conflicting coordinates fail validation.
- Standard unavailable values for SOG (`102.3`), COG (`360`), and heading (`511`)
  become `null`.

The normalizer returns points, warnings, and ingestion statistics. It performs no
anomaly detection and imports neither ArcGIS nor browser APIs.

### Synthetic and Real Dataset Separation

The current `src/data.js` trajectory remains the Phase 8 regression fixture and
fallback demonstration. It is not passed through the AIS boundary and its
existing timestamp interpretation is not rewritten.

A later selection layer will keep dataset assumptions attached to each dataset:

```js
{
  id: "synthetic-phase8",
  kind: "synthetic",
  points: samplePoints,
  analysisProfile: {
    reviewStatus: "fixture",
    primaryAnomaly: { fromOrder: 6, toOrder: 7 },
    baselineRange: { fromOrder: 1, toOrder: 5 }
  }
}
```

```js
{
  id: "real-ais-sample-01",
  kind: "real-ais",
  points: normalizedRealPoints,
  analysisProfile: {
    reviewStatus: "unreviewed",
    primaryAnomaly: null,
    baselineRange: null
  }
}
```

Real AIS points must not inherit the synthetic primary anomaly, baseline, or
threshold interpretation automatically.

### Phase 9.1 Acceptance Checklist

- [x] Canonical internal AIS trajectory-point schema is defined.
- [x] Common AIS fields map explicitly into the canonical schema.
- [x] Required and optional field validation is isolated from rendering.
- [x] Output timestamps are normalized to ISO-8601 UTC.
- [x] Timestamp sorting and duplicate handling are tested.
- [x] AIS-reported measurements remain separate from computed movement metrics.
- [x] Mixed-vessel trajectories and conflicting timestamps fail validation.
- [x] The synthetic Phase 8 fixture and Point 6→7 anomaly remain unchanged.
- [x] No real AIS dataset has been downloaded, rendered, or described as validated.
- [x] All 34 tests pass: 23 existing regression tests plus 11 AIS boundary tests.

---

## Phase 9.2: Dataset Adapters and Selectable Architecture

Phase 9.2 adds `src/datasets.js` between source data and the ArcGIS composition
root. `main.js` no longer imports `samplePoints` directly. It selects a dataset
from a registry and receives the trajectory points, metadata, and analysis
profile from that dataset descriptor.

The shared descriptor shape is:

```js
{
  id,
  label,
  kind, // "synthetic" or "real-ais"
  metadata,
  points,
  ingestion,
  analysisProfile: {
    reviewStatus,
    anomalySegment,
    baselineRange,
    thresholdRule
  }
}
```

Two adapters enforce different source assumptions:

- `adaptSyntheticDataset()` preserves the controlled Phase 8 fixture exactly,
  including its existing timestamp format and Point 6→7 narrative anomaly.
- `adaptRealAisDataset()` passes raw records through the Phase 9.1 AIS
  normalizer and always marks the resulting trajectory as `unreviewed`.

A newly adapted real AIS dataset receives `null` for its anomaly segment,
baseline range, and threshold rule. It therefore cannot inherit the synthetic
fixture's interpretation accidentally.

### Dataset Selection

`DATASET_SELECTION` in `src/config.js` identifies the requested dataset and the
safe fallback:

```js
export const DATASET_SELECTION = {
  activeDatasetId: "synthetic-phase8",
  fallbackDatasetId: "synthetic-phase8"
};
```

`createDatasetRegistry()` rejects duplicate ids. `selectDataset()` returns an
explicit `usedFallback` flag when the requested id is unavailable. At the Phase
9.2 checkpoint, the registry intentionally contained only `synthetic-phase8`.
Phase 9.3 adds a separately sourced real AIS descriptor while
preserving the same synthetic fallback.

Before building the Phase 8 analysis model, `main.js` calls
`getDatasetAnalysisOptions()`. Unreviewed real AIS datasets return `null`, which
acts as a safety gate against rendering synthetic anomaly claims on real vessel
data.

### Phase 9.2 Acceptance Checklist

The checklist below records the Phase 9.2 checkpoint before the Phase 9.3 sample
was added.

- [x] Synthetic and real AIS sources have separate adapters.
- [x] Real AIS adaptation reuses the Phase 9.1 normalization boundary.
- [x] Dataset descriptors carry their own metadata and analysis profile.
- [x] Newly adapted real AIS trajectories are always marked unreviewed.
- [x] Real AIS trajectories do not inherit Point 6→7, the synthetic baseline, or
      the synthetic threshold interpretation.
- [x] Dataset selection is registry-based and configuration-driven.
- [x] Missing dataset ids fall back explicitly to the controlled synthetic fixture.
- [x] `main.js` no longer imports `samplePoints` or trajectory metadata directly.
- [x] ArcGIS popups and the panel-first interaction model remain unchanged.
- [x] No real AIS dataset has been downloaded, bundled, rendered, or validated.
- [x] All 44 tests pass: 34 previous tests plus 10 dataset architecture tests.

---


## Phase 9.3: Static Real AIS Sample and Observation-Only Rendering

Phase 9.3 integrates a small static sample of real AIS observations without
attaching the Phase 8 anomaly narrative to them. The bundled sample contains
four consecutive records for MMSI `210035000` from 5 July 2017 near Gothenburg.
The MovingPandas ship-data example identifies the upstream data as AIS published
by the Danish Maritime Authority.

The source-shaped records and their provenance live together in
`src/real-ais-sample.js`. The provenance object records:

- upstream publisher and intermediary example
- source date, geographic area, vessel identifier, and extraction scope
- access date
- an explicit timestamp interpretation note
- an explicit statement that RouteSense has not verified the data license
- an explicit statement that no anomaly validation has been performed

The source table displays timestamps without a UTC offset. The sample adapter
therefore opts into `ASSUME_UTC` for deterministic normalization and records
that assumption in provenance. This is an integration decision, not a claim
about the authoritative archive time basis; the original archive must be
checked before research publication.

### Two Presentation Modes

`main.js` now selects the analysis path from the dataset descriptor:

```text
synthetic fixture
  -> reviewed threshold-analysis model
  -> Phase 8 anomaly and rule-evidence panels

real AIS sample
  -> unreviewed trajectory-display model
  -> provenance, reported AIS values, and computed movement context only
```

The real-data display computes distance, estimated speed, bearing, and heading
change from consecutive observations. These derived values are shown separately
from AIS-reported SOG and COG. It creates no baseline, detection flags, threshold
results, highlighted anomaly, or rule-evidence review.

### Selecting the Real Sample

The controlled synthetic fixture remains the default and fallback. The real
sample can be selected without editing source control by adding a query parameter:

```text
?dataset=real-ais-gothenburg-2017
```

For example, after starting Vite locally, append that query to the development
URL. An unknown dataset id still falls back explicitly to `synthetic-phase8`.
Each dataset supplies its own map framing, so the synthetic route opens in
Halifax and the real sample opens near Gothenburg.

### Phase 9.3 Acceptance Checklist

- [x] A small real AIS sample is stored as source-shaped static records.
- [x] Publisher, intermediary, extraction scope, date, area, and access date are documented.
- [x] Timestamp interpretation and unverified license status are explicit.
- [x] The sample passes through the Phase 9.1 normalizer and Phase 9.2 adapter.
- [x] The registry contains both real and synthetic datasets.
- [x] The synthetic fixture remains the default and fallback.
- [x] URL-based selection enables a reproducible real-data demonstration.
- [x] Real AIS rendering uses a display-only model with no detection flags.
- [x] Real point panels separate reported SOG/COG from computed segment metrics.
- [x] Real-data panels state that no anomaly has been validated.
- [x] Dataset-specific map framing supports both Halifax and Gothenburg.
- [x] Vessel Point 6→7 remains the synthetic fixture's primary anomaly.
- [x] Popups remain disabled and interaction remains panel-first.
- [x] All 56 tests pass: 44 previous tests plus 12 Phase 9.3 tests.

---

## Phase 9.4: AIS Measurement Review and Data-Quality Evidence

Phase 9.4 makes the distinction introduced in Phase 9.1 visible in the
interface. AIS-reported measurements remain source observations, while
RouteSense-derived metrics remain calculations from coordinates and timestamps.
The two categories are displayed together without converting their difference
into an anomaly claim.

The pure `src/measurement-review.js` module provides:

- knots-to-km/h conversion using `1 kn = 1.852 km/h`
- circular direction difference normalized to 0–180 degrees
- observation-interval calculation
- explicit comparison states for comparable values, missing reported values,
  excessive timestamp gaps, and insufficient evidence
- a segment-level comparison object with no ArcGIS or DOM dependency

### Comparison Basis

For a segment from Point *i* to Point *i + 1*, RouteSense compares the
interval-derived metrics with SOG and COG reported at the destination observation
(Point *i + 1*). The basis is stored explicitly in the dataset's
`measurementReviewProfile` rather than hidden in panel code. The default maximum
comparison interval is 300 seconds.

```js
measurementReviewProfile: {
  comparisonBasis: "destination-observation",
  maxGapSeconds: 300
}
```

This is not a claim that the destination AIS value measures the complete
segment. SOG and COG may represent a near-instantaneous vessel state, while
RouteSense speed and bearing summarize movement between two observations. The
panel therefore labels the result **Descriptive measurement comparison** and
states that the difference is not an error score, validation result, or anomaly
label.

### Real Segment Panel

Selecting a real AIS segment now displays four layers:

1. AIS-reported SOG and COG at the destination observation
2. RouteSense-computed distance, estimated speed, bearing, and heading change
3. speed difference in km/h and circular direction difference in degrees
4. the observation-only interpretation boundary and provenance limitations

For the first Gothenburg segment, the interface shows approximately:

| Evidence | Value |
|---|---:|
| AIS-reported SOG at Point 2 | 9.50 kn / 17.59 km/h |
| RouteSense estimated speed | 18.23 km/h |
| Computed − reported speed | +0.64 km/h |
| AIS-reported COG at Point 2 | 58.90° |
| RouteSense bearing | 53.90° |
| Circular direction difference | 5.00° |

These values are useful for inspecting consistency and representation, but the
four-point sample remains too small and insufficiently verified for anomaly
validation or general data-quality conclusions.

### Phase 9.4 Acceptance Checklist

- [x] Reported SOG is converted from knots without overwriting the source value.
- [x] Circular direction difference handles the 359°/1° boundary correctly.
- [x] Comparison assumptions travel with the real dataset descriptor.
- [x] Missing reported values remain distinct from insufficient computed evidence.
- [x] Excessive timestamp gaps suppress numeric comparison differences.
- [x] Every real display segment receives a descriptive measurement-review object.
- [x] Real segment panels show reported and computed values side by side.
- [x] The interface states that differences are not error, validation, or anomaly scores.
- [x] Timestamp and license limitations remain visible in the dataset overview.
- [x] Synthetic analysis does not receive the real-data measurement-review model.
- [x] Vessel Point 6→7 remains the synthetic primary anomaly.
- [x] Popups remain disabled and interaction remains panel-first.
- [x] All 70 tests pass: 56 previous tests plus 14 Phase 9.4 tests.

---

## Limitations

- **Manually configured primary anomaly.** Segment 6→7 is selected in configuration;
  the threshold rule does not decide narrative priority.
- **Controlled anomaly evidence remains synthetic.** The Phase 8 anomaly and
  threshold findings belong only to the eight-point Halifax fixture.
- **Real sample is tiny and unreviewed.** The Gothenburg sample contains four
  observations and is suitable for ingestion, interface integration, and
  descriptive measurement comparison, not anomaly ground truth or broad
  movement analysis.
- **Reported and computed values have different temporal semantics.** AIS SOG/COG
  may describe a near-instantaneous state, while RouteSense metrics summarize an
  interval. Their difference must not be interpreted as sensor error by default.
- **Timestamp basis requires upstream verification.** The source display omits a
  UTC offset; RouteSense records its deterministic UTC assumption explicitly.
- **Dataset license not asserted.** Upstream terms must be verified before reuse
  beyond this portfolio integration.
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
| 9.1 | AIS data contract, validation, normalization, and boundary tests | ✅ Complete |
| 9.2 | Dataset adapters, registry, selection, and analysis-profile isolation | ✅ Complete |
| 9.3 | Static real AIS sample, provenance, selection, and observation-only rendering | ✅ Complete |
| 9.4 | Reported-versus-computed measurement review and data-quality states | ✅ Complete |

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
│   ├── ais.js        # Pure AIS field mapping, validation, and normalization
│   ├── analysis.js   # Segment features, baseline, detection, evidence roles
│   ├── config.js     # Dataset, map, rule, encoding, anomaly, and layout configuration
│   ├── data.js       # Synthetic AIS-like trajectory and route metadata
│   ├── datasets.js   # Dataset adapters, registry, selection, and analysis profiles
│   ├── geo.js        # Pure geometry, time, and statistics helpers
│   ├── measurement-review.js # Reported-versus-computed descriptive comparison
│   ├── main.js       # ArcGIS composition root, graphics, and click routing
│   ├── panels.js     # Reviewed and unreviewed data-to-HTML panel renderers
│   ├── real-ais-sample.js # Static source records and provenance
│   └── style.css     # Map, panel, hierarchy, and responsive styling
├── tests/
│   ├── ais.test.js
│   ├── analysis.test.js
│   ├── datasets.test.js
│   ├── measurement-review.test.js
│   ├── panels.test.js
│   └── real-ais.test.js
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
- Danish Maritime Authority. *AIS data*. Historical AIS data access and description.
  https://www.dma.dk/safety-at-sea/navigational-information/ais-data
- MovingPandas. *Ship data analysis example*. AIS sample from 5 July 2017 near
  Gothenburg. https://movingpandas.github.io/movingpandas-website/2-analysis-examples/ship-data.html
- MovingPandas examples. *Example datasets*. Source description for `ais.gpkg`.
  https://github.com/movingpandas/movingpandas-examples/blob/main/data/README.md
