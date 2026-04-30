# RouteSense

**RouteSense** is a perception-aware maritime trajectory visualization project built with JavaScript, ArcGIS/web mapping tools, and AIS trajectory data.

## Project Goal
The goal is to explore how visual interface design can help users interpret vessel movement patterns more clearly, especially when identifying unusual routes, speed changes, sharp turns, or other movement anomalies.

This project connects technical web mapping with research interests in HCI, visual perception, interpretation, and representation. It is being developed as a portfolio project for a thesis-based MSc Computer Science application.

## Core Direction

- JavaScript-based interactive web mapping
- ArcGIS Maps SDK / web GIS visualization
- AIS or maritime trajectory datasets
- Perception-aware visual design
- Human interpretation of movement patterns

## Current Prototype Features

- ArcGIS-based interactive map
- Mock AIS-like vessel trajectory points
- Connected trajectory line showing vessel movement over time
- Highlighted anomalous trajectory segment
- Perception-aware anomaly cue
- Anomaly explanation panel
- Timestamped vessel points and movement context

## Current Status

This prototype currently uses mock trajectory data and a manually selected anomaly segment. The current focus is visual prototyping and interface design rather than automated anomaly detection.

Rule-based anomaly detection will be developed in a later phase.

## Technology Stack

- JavaScript
- Vite
- ArcGIS Maps SDK for JavaScript
- HTML/CSS

## Current Prototype

The current version includes a basic ArcGIS web map centered on Halifax, Nova Scotia. It plots a few sample vessel-like points near Halifax Harbour and includes simple interactive popups.

This prototype is the first working map foundation for future trajectory visualization features.

## Project Progress

| Phase | Focus | Status |
|---|---|---|
| Phase 0 | Project setup, tools, and GitHub repository | Complete |
| Phase 1 | Basic ArcGIS map prototype | Complete |
| Phase 1.5 | Map styling and interface cleanup | Complete |
| Phase 2 | Sample maritime trajectory visualization | Complete |
| Phase 3 | Mock anomaly segment highlight | Complete |
| Phase 3.5 | Expanded trajectory context for anomaly visualization | Complete |
| Phase 4 | Perception-aware anomaly styling and explanation panel | Complete |
| Phase 4.5 | Prototype stabilization and portfolio notes | In progress |

## Phase 0: Project Setup

- Set up VS Code
- Installed Node.js
- Set up Git
- Created GitHub repository
- Defined basic project folder structure
- Wrote initial project statement

## Phase 1: Map Starter

- Created `public/index.html`
- Created `src/style.css`
- Created `src/main.js`
- Added ArcGIS Maps SDK for JavaScript
- Rendered a basic map centered on Halifax
- Added sample vessel points
- Added simple popups for each point
- Committed and pushed the working prototype to GitHub

### Phase 2 Trajectory Starter

The prototype now visualizes the sample vessel points as an ordered trajectory rather than isolated map markers. A blue polyline connects the vessel-like points near Halifax Harbour, while each point includes basic trajectory metadata such as order and timestamp.

To improve visual interpretation, the map also displays numbered point labels and directional arrow cues along the trajectory. These cues help users perceive the movement sequence more quickly without relying only on popups.

Current trajectory features include:

- Three sample vessel-like points near Halifax Harbour
- A connected blue trajectory line
- Route-level metadata, including route name and vessel ID
- Point-level metadata, including order and timestamp
- Numbered labels directly on the map
- Direction arrows showing movement flow from point 1 → 2 → 3
- Popups for both vessel points and the trajectory line

## Phase 3: Mock Anomaly Starter

Phase 3 introduces the first mock anomaly visualization for RouteSense.

In this phase, the project adds anomaly metadata to selected trajectory points and uses that metadata to create a highlighted anomalous segment on the map. The anomaly segment is displayed with a red line so that it visually stands out from the normal blue trajectory line.

This phase also adds an anomaly popup that explains:

- Which segment is being highlighted
- What kind of anomaly is being mocked
- Why the segment is visually emphasized
- How the highlighted segment supports perception-aware visualization testing

Phase 3 keeps the earlier trajectory visualization elements working, including point markers, labels, arrows, timestamps, trajectory lines, and popups.

## Phase 3.5: Expanded Trajectory Context

Phase 3.5 expands the mock AIS-like sample trajectory from a simple 3-point route into an 8-point trajectory near Halifax Harbour.

The goal of this phase is to make the anomaly easier to perceive by giving the viewer more movement context. Points 1–5 establish a mostly consistent movement rhythm, while Points 6–7 form a highlighted anomalous segment. This makes the red anomaly line feel more meaningful because it can now be compared against the normal trajectory pattern.

This phase preserves the existing visualization elements from earlier phases:

- Point markers
- Numeric point labels
- Direction arrows
- Timestamps
- Trajectory line
- Anomaly highlight
- Popups

This update supports the perception-aware goal of RouteSense: anomaly detection is not only about marking unusual data, but also about designing enough visual context for the viewer to interpret why something appears unusual.

## Phase 4: Perception-Aware Anomaly Design

Phase 4 improves the anomaly visualization from a simple red highlighted segment into a more perception-aware design.

Instead of relying only on color, the anomalous segment now uses multiple visual cues:

- A dashed line style to distinguish the unusual movement pattern from the normal trajectory
- A thicker red-orange line to increase visual salience
- A subtle glow behind the segment to improve contrast against the basemap
- A small explanation panel to help users interpret the anomaly in context

The key design idea is that the anomaly is not defined by color alone. It becomes meaningful when compared with the surrounding trajectory context. Points 1–5 establish a normal movement rhythm, while the Point 6 → Point 7 segment becomes easier to perceive as an unusual deviation.

This keeps the prototype simple while connecting the technical implementation to the project’s broader research direction: perception-aware interface design for maritime trajectory visualization.


### Next Step

The next technical phase will focus on either trajectory interaction or rule-based anomaly logic.

## Screenshots

### Overall Map View

![RouteSense overall map view](screenshots/routesense-overall-map.png)

### Anomaly Highlight View

![RouteSense anomaly highlight view](screenshots/routesense-anomaly-highlight.png)

### Explanation Panel View

![RouteSense explanation panel view](screenshots/routesense-explanation-panel.png)


## Portfolio Note

RouteSense is part of a graduate portfolio exploring the intersection of human-computer interaction, visualization, perception, and maritime data interpretation.
