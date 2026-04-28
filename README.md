# RouteSense

**RouteSense** is a perception-aware maritime trajectory visualization project built with JavaScript, ArcGIS/web mapping tools, and AIS trajectory data.

The goal is to explore how visual interface design can help users interpret vessel movement patterns more clearly, especially when identifying unusual routes, speed changes, sharp turns, or other movement anomalies.

This project connects technical web mapping with research interests in HCI, visual perception, interpretation, and representation. It is being developed as a portfolio project for a thesis-based MSc Computer Science application.

## Core Direction

- JavaScript-based interactive web mapping
- ArcGIS Maps SDK / web GIS visualization
- AIS or maritime trajectory datasets
- Perception-aware visual design
- Human interpretation of movement patterns

## Current Prototype

The current version includes a basic ArcGIS web map centered on Halifax, Nova Scotia. It plots a few sample vessel-like points near Halifax Harbour and includes simple interactive popups.

This prototype is the first working map foundation for future trajectory visualization features.

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

### Next Steps

- Add more realistic AIS-like sample data
- Introduce mock anomaly cases, such as sharp turns, speed changes, or unusual movement gaps
- Explore visual highlighting methods for unusual trajectory patterns
- Connect the technical prototype to perception-aware interface design and HCI research questions