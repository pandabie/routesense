# RouteSense: Perception-Aware Maritime Trajectory Visualization

A JavaScript + ArcGIS prototype exploring how interface design can help users
notice, inspect, and interpret unusual vessel movement — built as the
visualization and interpretability layer that a future GeoAI detection model
will need.

**No machine learning. No black-box inference.** A transparent threshold rule
runs on a controlled synthetic trajectory; real AIS data is rendered in
observation-only mode.

---

## Research Question

> How can perception-aware visual design help users notice and interpret
> anomalous vessel movement more effectively than a conventional map display?

Most maritime anomaly work concentrates on detection performance. RouteSense
focuses on the complementary interface problem: once movement is flagged, how
should the evidence be presented so that a human can distinguish a primary
anomaly from nearby contextual changes?

## Key Finding: Rules Flag More Than the Narrative Anomaly

A simple threshold rule (speed > 1.5× baseline OR heading change > 45°),
applied to the eight-point synthetic Halifax trajectory, flags **three**
segments — but the trajectory's narrative anomaly exists only at 6→7:

| Segment | Est. speed | Heading change | Rule trigger | Interface role |
|---|---:|---:|---|---|
| 5→6 | ~15.2 km/h | ~66° | Speed + heading | Supporting, pre-anomaly |
| 6→7 | ~12.4 km/h | ~148° | Speed + heading | **Primary anomaly** |
| 7→8 | ~6.2 km/h | ~85° | Heading only | Supporting, post-anomaly |

A rule can identify several locally unusual movements without determining
which one deserves the strongest interpretive emphasis. RouteSense makes this
mismatch visible instead of hiding it, preserving three separate distinctions
in the interface: rule status, evidence relation (before / at / after the
primary anomaly), and visual priority (only 6→7 receives the primary
map encoding).

This gap between *what a rule flags* and *what an analyst should focus on* is
the design problem the prototype is built around, and the seed for future
threshold-tuning and detection-model work.

---

## Two Datasets, Two Deliberately Separated Modes

| | Synthetic fixture (Halifax) | Real AIS sample (Gothenburg) |
|---|---|---|
| Points | 8, controlled | 4, MMSI 210035000, 2017-07-05 |
| Analysis | Threshold rule + baseline + anomaly narrative | None — observation-only |
| Panel content | Rule evidence review | Provenance + measurement review |
| Status | Regression fixture | Unreviewed |

Real AIS trajectories never inherit the synthetic baseline, threshold rule, or
anomaly narrative. An unreviewed dataset returns no analysis options, which
acts as a safety gate against rendering synthetic anomaly claims on real
vessel data.

Both datasets are selectable from a switcher in the panel header (or via
`?dataset=real-ais-gothenburg-2017`). The synthetic fixture is the default
and fallback. Each dataset supplies its own map framing.

---

## System Design

### Perception-aware anomaly cue

The primary anomaly is encoded through multiple redundant visual channels
rather than color alone (Ware 2004; Bertin 1983):

| Visual channel | Normal trajectory | Primary anomaly |
|---|---|---|
| Color | Blue | Red-orange |
| Line style | Solid | Dashed |
| Line weight | Thin | Thick |
| Depth cue | None | Subtle glow |

The normal trajectory stays visible: an anomaly is only meaningful in
comparison with surrounding movement.

### Panel-first interaction

ArcGIS popups are disabled. One persistent side panel responds to every
clickable element — trajectory segments, vessel points, direction arrows —
with segment-specific context: normal, supporting evidence, or the full rule
evidence review at 6→7.

### Computed evidence

Each segment is derived from latitude, longitude, and timestamp in plain
JavaScript: Haversine distance, estimated speed, compass heading, normalized
heading change (0–180°), and comparison against a baseline built from
Points 1–5. For the primary anomaly:

| Feature | Normal baseline | Segment 6→7 |
|---|---:|---:|
| Estimated speed | ~6.6 km/h | ~12.4 km/h (+88%) |
| Heading change | ~0° | ~148° |

---

## Real AIS Handling

Real data enters through a strict ingestion boundary (`src/ais.js`): explicit
field mapping (MMSI, BaseDateTime, LAT/LON, SOG/COG, Heading, Status),
coordinate and timestamp validation, chronological sorting, duplicate
handling, and standard AIS unavailable-value codes (SOG `102.3`, COG `360`,
heading `511`) normalized to `null`. AIS-reported measurements are stored
separately and never copied into computed movement metrics.

**Provenance travels with the data.** The Gothenburg sample records its
publisher (Danish Maritime Authority, via the MovingPandas ship-data example),
extraction scope, access date, an explicit UTC assumption for timezone-free
source timestamps, and explicit statements that the license is unverified and
no anomaly validation has been performed.

**Measurement review, not validation.** For each real segment, the panel
shows AIS-reported SOG/COG beside RouteSense-computed speed and bearing as a
*descriptive measurement comparison*:

| Evidence (Segment 1→2) | Value |
|---|---:|
| AIS-reported SOG at Point 2 | 9.50 kn / 17.59 km/h |
| RouteSense estimated speed | 18.23 km/h |
| Speed difference | +0.64 km/h |
| AIS-reported COG at Point 2 | 58.90° |
| RouteSense bearing | 53.90° |
| Circular direction difference | 5.00° |

Reported and computed values have different temporal semantics — SOG/COG may
describe a near-instantaneous state, while RouteSense metrics summarize the
interval between observations. The interface states explicitly that the
difference is not an error score, validation result, or anomaly label.
Comparison assumptions (destination-observation basis, 300-second maximum
gap) are stored in the dataset descriptor, not hidden in panel code.

---

## Limitations

- **The primary anomaly is configured, not detected.** Segment 6→7 is
  selected in configuration; the threshold rule does not decide narrative
  priority.
- **Anomaly findings are synthetic-only.** The rule and its over-flagging
  behavior belong to the controlled Halifax fixture.
- **The real sample is tiny and unreviewed** — four observations, suitable
  for ingestion and interface demonstration, not anomaly ground truth.
- **Timestamp basis and license of the real sample require upstream
  verification** before use beyond this prototype.
- **The rule is deliberately simple** — no vessel class, operational context,
  environmental conditions, or uncertainty modeling.
- **Single trajectory per dataset.** Multi-vessel comparison and clutter
  handling are not implemented.
- **No user evaluation has been conducted yet.**

## Planned Evaluation

A future exploratory study would compare a conventional color-only display
against the full perception-aware condition on the task of distinguishing the
primary anomaly from over-flagged neighboring segments. Candidate measures:
identification accuracy, time-to-decision, and confidence. This evaluation
has not been conducted.

---

## Development Phases

| Phase | Focus |
|---|---|
| 0–3.5 | ArcGIS setup, trajectory rendering, eight-point context |
| 4–6 | Perception-aware anomaly cue, panel model, computed movement metrics |
| 7–7.5 | Threshold detection starter; modular pipeline + regression tests |
| 8 | Rule evidence review — the over-flagging finding and visual hierarchy |
| 9.1–9.2 | AIS ingestion boundary; dataset adapters, registry, profile isolation |
| 9.3–9.4 | Real AIS sample with provenance; descriptive measurement review |
| 10 | Dataset switcher with kind/status badges and provenance display |

All phases complete. 78 regression tests passing.

---

## Tech Stack & Structure

JavaScript ES modules · ArcGIS Maps SDK for JavaScript · Vite ·
Node built-in test runner. Spatial, temporal, and statistical helpers are
plain JavaScript with no additional geospatial dependency.

```text
src/
├── ais.js                 # AIS field mapping, validation, normalization
├── analysis.js            # Segment features, baseline, rule, evidence roles
├── config.js              # Map, rule, encoding, anomaly, layout configuration
├── data.js                # Synthetic trajectory fixture
├── datasets.js            # Adapters, registry, selection, analysis profiles
├── geo.js                 # Geometry, time, statistics helpers
├── measurement-review.js  # Reported-vs-computed descriptive comparison
├── main.js                # ArcGIS composition root and click routing
├── panels.js              # Panel renderers (reviewed / unreviewed modes)
└── real-ais-sample.js     # Static source records + provenance
tests/                     # 78 tests across 6 suites
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
- Healey, C., & Enns, J. (2012). Attention and visual memory in visualization
  and computer graphics. *IEEE TVCG*, 18(7), 1170–1188.
- Munzner, T. (2009). A nested model for visualization design and validation.
  *IEEE TVCG*, 15(6), 921–928.
- Ware, C. (2004). *Information Visualization: Perception for Design*
  (2nd ed.). Morgan Kaufmann.
- Danish Maritime Authority. *AIS data*.
  https://www.dma.dk/safety-at-sea/navigational-information/ais-data
- MovingPandas. *Ship data analysis example* (AIS sample, 5 July 2017,
  Gothenburg).
  https://movingpandas.github.io/movingpandas-website/2-analysis-examples/ship-data.html
- MovingPandas examples. *Example datasets* (source description for
  `ais.gpkg`).
  https://github.com/movingpandas/movingpandas-examples/blob/main/data/README.md
