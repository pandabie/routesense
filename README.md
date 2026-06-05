# RouteSense: Perception-Aware Visualization of Maritime Trajectory Anomalies

A JavaScript + ArcGIS prototype exploring how perception-aware interface design
helps users notice and interpret unusual vessel movement in maritime trajectory data.

> Portfolio project for a thesis-based MSc Computer Science application
> (GeoAI / maritime trajectory analysis).

---

## Abstract

RouteSense is a web-based maritime trajectory visualization prototype built with
JavaScript and the ArcGIS Maps SDK. It explores how perception-aware interface
design can help users interpret unusual vessel movement. The current prototype
renders an 8-point Halifax Harbour trajectory with perception-aware anomaly cues,
a panel-first interaction model, computed trajectory evidence (estimated speed and
heading change), and a threshold-based detection starter that evaluates every
segment against a normal-movement baseline. The project deliberately develops the
visualization and interpretation layer before full automated detection, so that
detection logic has a meaningful interface to surface into.

---

## Research Question

> How can perception-aware visual design help users notice and interpret
> anomalous vessel movement more effectively than a conventional map display?

Most maritime anomaly research focuses on detection accuracy. RouteSense focuses
on the complementary question: once a segment is flagged, how does interface
design shape whether a human perceives and correctly interprets it?

## Approach: Interface Layer First

The project builds the visualization and inspection layer first, then introduces
detection logic into it. This sequencing is intentional — a detection model is
only useful operationally if its output is presented in a way a human can act on.
Building the interpretation layer first gives later detection logic a place to
surface, and gives the research a clear object of study: the interface itself.

---

## System Design

### Perception-Aware Anomaly Cues

The anomaly segment is encoded across multiple visual channels, not color alone.
This is grounded in pre-attentive processing theory (Ware, 2004; Healey & Enns,
2012): targets that differ from their context along several visual dimensions are
detected faster and more reliably. Bertin's (1983) visual variables and Munzner's
(2009) nested model inform the separation of data abstraction, visual encoding,
and interaction.

| Visual channel | Normal trajectory | Anomaly segment |
|----------------|-------------------|-----------------|
| Color          | Blue              | Red-orange      |
| Line style     | Solid             | Dashed          |
| Line weight    | Thin              | Thick           |
| Depth cue      | None              | Subtle glow     |

The surrounding normal trajectory (Points 1–5) is retained deliberately: without
it, there is no baseline against which the deviation can be perceived.

### Panel-First Interaction

All map elements update a single persistent side panel rather than floating
popups. A user inspecting a flagged trajectory can compare points, route context,
and computed evidence in one consistent interpretation space.

### Computed Trajectory Evidence

Each segment's features are computed from latitude, longitude, and timestamp:
great-circle distance (Haversine), estimated speed, compass heading, and heading
change between consecutive segments. The anomaly panel reports these against the
normal baseline:

| Feature        | Normal baseline (Pts 1–5) | Anomaly segment (6→7) |
|----------------|---------------------------|------------------------|
| Estimated speed | ~6.6 km/h                | ~12.4 km/h (+88%)      |
| Heading change  | ~0°                      | ~148°                  |

---

## Detection: Threshold-Based Starter

The prototype evaluates every segment with a simple rule. A segment is flagged if:

- estimated speed > 1.5 × baseline average speed (≈ 9.9 km/h), **or**
- heading change > 45°.

### Finding: manual selection and automated rule do not fully align

The RouteSense narrative treats Point 6→7 as *the* anomaly. When the threshold
rule is applied to the whole trajectory, however, it flags **three** segments:

| Segment | Est. speed | Heading change | Flagged by | 
|---------|-----------|----------------|------------|
| 5 → 6   | ~15.2 km/h | ~66°          | speed + heading |
| 6 → 7   | ~12.4 km/h | ~148°         | speed + heading |
| 7 → 8   | ~6.2 km/h  | ~85°          | heading only    |

This is a deliberate observation, not a defect. It shows that a single manually
chosen "anomaly" and a naive threshold rule capture different things: the detour
*and its surrounding maneuvers* all read as unusual to the rule, and a segment
can be flagged on heading alone while its speed stays normal (7→8). It motivates
later work on multi-feature rules and threshold tuning to control false positives,
and it keeps the primary narrative anomaly distinct from rule-flagged segments in
the interface.

---

## Limitations

- **Manually selected primary anomaly.** The narrative anomaly (6→7) is defined by
  configuration; the threshold rule is a separate, simple starter.
- **Mock AIS-like data.** Trajectory points are synthetic, not from a real AIS feed.
- **No user evaluation yet.** The perception-aware design has not been tested with users.
- **Single trajectory.** Multi-vessel comparison and clutter handling are not yet implemented.

## Planned Evaluation

A small exploratory study (~10 participants) comparing a baseline color-only
condition against the full perception-aware condition. Metrics: time-to-detection,
identification accuracy, confidence, and cognitive load (NASA-TLX). Not yet conducted.

---

## Development Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0–1   | Project setup, ArcGIS map prototype | ✅ |
| 2–3.5 | Trajectory visualization, expanded 8-point context | ✅ |
| 4     | Perception-aware anomaly cues + explanation panel | ✅ |
| 5–5.5 | Point interaction, unified panel model | ✅ |
| 6     | Computed trajectory evidence (speed, heading) + baseline comparison | ✅ |
| 7     | Threshold-based detection starter | ✅ |
| 8     | Multi-feature rules, threshold tuning, real AIS data | 🔲 Planned |

## Tech Stack

JavaScript (ES modules), ArcGIS Maps SDK for JavaScript, Vite, HTML/CSS.
Spatial and temporal computation (Haversine distance, compass bearing, speed) is
implemented in plain JavaScript with no external geospatial dependencies.

## Repository Structure

```
routesense/
├── src/
│   ├── main.js     # Map setup, computed pipeline, detection, panels, interaction
│   └── style.css   # Map and panel styling
├── index.html      # Vite entry point
└── README.md
```

## References

- Bertin, J. (1983). *Semiology of Graphics*. University of Wisconsin Press.
- Healey, C., & Enns, J. (2012). Attention and visual memory in visualization and
  computer graphics. *IEEE TVCG*, 18(7), 1170–1188.
- Munzner, T. (2009). A nested model for visualization design and validation.
  *IEEE TVCG*, 15(6), 921–928.
- Ware, C. (2004). *Information Visualization: Perception for Design* (2nd ed.).
  Morgan Kaufmann.
