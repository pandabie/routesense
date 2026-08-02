# RouteSense

**Perception-Aware Maritime Trajectory Visualization**

RouteSense is a small JavaScript + ArcGIS prototype I built around one question:

> When a rule flags unusual vessel movement, how should the interface show what matters?

The project focuses on the step **after detection**. It does not use machine learning. The synthetic dataset uses a simple threshold rule, while the real AIS sample is shown in observation-only mode.

**[Live demo](https://pandabie.github.io/routesense/)** ·
**[Real AIS view](https://pandabie.github.io/routesense/?dataset=real-ais-gothenburg-2017)**

---

## Main idea

The synthetic Halifax track has eight points. A segment is flagged when:

- estimated speed is greater than `1.5 ×` the baseline speed, or
- heading change is greater than `45°`.

The rule flags three neighboring segments:

| Segment | Est. speed | Heading change | Rule result | Interface role |
|---|---:|---:|---|---|
| 5→6 | ~15.2 km/h | ~66° | Speed + heading | Supporting evidence before |
| 6→7 | ~12.4 km/h | ~148° | Speed + heading | **Configured primary anomaly** |
| 7→8 | ~6.2 km/h | ~85° | Heading only | Supporting evidence after |

All three cross the threshold, but the rule does not decide which one should receive the strongest emphasis.

For this controlled fixture, Point 6 → Point 7 is configured as the primary anomaly. The other two stay visible as context.

You can also see this gap in the interface itself by selecting all three segments at once. See *Rule vs. narrative* below.

RouteSense keeps three things separate:

1. **Detection status** — what the rule flags.
2. **Evidence relation** — whether a segment appears before, at, or after the configured anomaly.
3. **Visual priority** — which segment receives the strongest emphasis.

That separation is the main point of the project.

---

## Two datasets

| | Synthetic Halifax fixture | Real AIS sample near Gothenburg |
|---|---|---|
| Observations | 8 controlled points | 4 real AIS observations |
| Purpose | Rule and interface testing | Ingestion and measurement display |
| Analysis | Baseline + threshold rule | None |
| Status | Controlled fixture | Unreviewed, observation-only |

The synthetic fixture is the default dataset.

The real AIS sample does not inherit the synthetic baseline, threshold rule, or anomaly story. RouteSense makes no anomaly claim about the real vessel track.

Datasets can be changed from the panel header or opened directly with the `dataset` URL parameter.

---

## How the interface works

### Primary anomaly cue

The configured primary anomaly uses more than color:

| Visual channel | Normal track | Primary anomaly |
|---|---|---|
| Color | Blue | Red-orange |
| Line style | Solid | Dashed |
| Line weight | Thin | Thick |
| Extra cue | None | Subtle glow |

The surrounding track remains visible so the highlighted segment can still be read in context.

### One panel, no ArcGIS popups

ArcGIS popups are disabled. One side panel responds to trajectory segments, vessel points, direction arrows, and group selections.

Depending on the selection, it shows:

- normal movement context,
- supporting rule evidence,
- the primary anomaly review,
- a summary of several segments at once, or
- real AIS provenance and measurement information.

The panel can be collapsed when you want to see more of the map. A small help box on the map lists what each gesture does.

### Selecting a group of points

Hold `Shift` and drag a box to select every vessel point inside it. Dragging without `Shift` still pans the map.

A segment counts as selected only when **both** of its ends are inside the box. A segment with one end inside is listed as a boundary segment, so the panel says why it was left out instead of dropping it quietly.

The panel changes shape with the size of the selection:

| Selection | What the panel shows |
|---|---|
| 1 point | The normal point panel |
| 2 points | The normal segment panel for the one segment between them |
| 3 or more | Totals for the whole selection, then one row per segment |

Selected points are drawn larger. Selected segments get a soft halo behind the track rather than a new line color, so the dashed red anomaly cue is never covered up.

Each segment row is a link. Clicking it selects that segment's two end points, which gives the same result as drawing a small box around them.

Numbers for a group are kept deliberately plain. Speed for the whole selection is total distance divided by total time, not an average of segment speeds. Heading change always says how many segments it could be measured for, because the first segment of a track has no previous segment to compare with.

### Rule vs. narrative

Selecting Points 5 to 8 covers all three flagged segments at once. The panel then says:

> 3 of 3 segments flagged · 1 narrative anomaly

Before this, the gap between what the rule flags and what the project treats as the anomaly was something you had to read about in this file. Now the interface says it directly. That is closer to what the project claims to be: the layer that explains a detection result, not the layer that produces one.

The real AIS panel has no version of this block, because that dataset has no rule to compare against. It lists the same segments with their measured differences instead.

### Computed movement metrics

RouteSense derives movement information from latitude, longitude, and timestamp using plain JavaScript.

It computes:

- Haversine distance,
- interval-derived speed,
- compass bearing,
- heading change normalized to `0–180°`,
- and a baseline from Points 1–5 for the synthetic fixture.

For Point 6 → Point 7, the estimated speed is about `12.4 km/h`, compared with a baseline of about `6.6 km/h`. Its heading change is about `148°`.

---

## Real AIS handling

Real AIS records enter through `src/ais.js`.

This module maps source fields, validates coordinates and timestamps, sorts observations, handles duplicates, rejects conflicting records, and converts standard AIS unavailable values to `null`.

AIS-reported values remain separate from RouteSense-computed metrics.

For example, the panel can show:

- AIS-reported SOG beside RouteSense interval speed,
- AIS-reported COG beside RouteSense bearing.

This is a descriptive comparison, not validation.

AIS SOG and COG can describe a near-instantaneous vessel state. RouteSense speed and bearing summarize the interval between two observations. A difference between them is not automatically an error or an anomaly.

The Gothenburg sample also includes provenance notes such as publisher, source date, geographic area, extraction scope, access date, the UTC assumption used for timezone-free timestamps, and its unreviewed status.

---

## Limits

This prototype is intentionally small.

- Point 6 → Point 7 is configured as the primary synthetic anomaly. The rule does not choose it.
- The anomaly finding applies only to the controlled Halifax fixture.
- The real AIS sample contains four observations and has not been reviewed for anomalies.
- The timestamp basis and redistribution terms still require upstream verification.
- The rule does not include vessel type, operational context, weather, environment, or uncertainty.
- Each dataset contains one trajectory. Multi-vessel comparison is not implemented.
- Group selection is built for track sizes this project does not have yet. With eight points, a reviewer can simply click the segments one at a time. It is there to show the interaction scales, not because the sample needs it.
- No user study has been completed.

A possible next step would be a small study comparing a color-only display with the full RouteSense treatment. The task could measure how accurately and quickly people identify the configured primary anomaly among several flagged segments.

---

## Project status

Portfolio prototype version 1 is complete.

- Public GitHub Pages demo deployed
- Synthetic and real-data modes implemented
- Dataset selection through the interface and URL
- Group selection with the rule-versus-narrative comparison
- 113 regression tests passing

---

## Phases

| Phase | What happened |
|---|---|
| 0–3.5 | ArcGIS setup, drawing trajectories, eight-point context |
| 4–6 | Anomaly encoding, panel model, computed movement metrics |
| 7–7.5 | First threshold rule; split into modules + regression tests |
| 8 | Rule evidence review — the over-flagging finding, visual hierarchy |
| 9.1–9.2 | AIS ingestion boundary; dataset adapters, registry, profile isolation |
| 9.3–9.4 | Real AIS sample with provenance; measurement comparison |
| 10 | Dataset switcher with kind/status badges |

---

## Tech stack

JavaScript ES modules · ArcGIS Maps SDK for JavaScript · Vite · Node built-in test runner

```text
src/
├── ais.js                 # AIS mapping, validation, and normalization
├── analysis.js            # Segment metrics, baseline, rule, and evidence roles
├── config.js              # Map, rule, encoding, anomaly, and layout settings
├── data.js                # Synthetic trajectory fixture
├── datasets.js            # Dataset adapters, registry, and selection
├── geo.js                 # Geometry, time, and statistics helpers
├── measurement-review.js  # Reported and computed measurement comparison
├── main.js                # ArcGIS setup, click and drag routing
├── panels.js              # Panel renderers
├── real-ais-sample.js     # Static AIS records and provenance
└── selection.js           # Group selection logic and its summaries

tests/                     # 113 tests across 7 suites
```

## Run locally

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
- MovingPandas. *Ship data analysis example*.
  https://movingpandas.github.io/movingpandas-website/2-analysis-examples/ship-data.html
- MovingPandas examples. *Example datasets*.
  https://github.com/movingpandas/movingpandas-examples/blob/main/data/README.md
