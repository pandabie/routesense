// RouteSense prototype
// Perception-aware maritime trajectory visualization using the ArcGIS Maps SDK.
//
// File structure (top to bottom):
//   1. Imports
//   2. Config / constants
//   3. Pure helper functions (geometry, time, statistics)
//   4. Trajectory data
//   5. Derived data pipeline (segments, baseline, detection, anomaly lookup)
//   6. Map setup
//   7. Map graphics (trajectory line, anomaly cue, arrows, points)
//   8. Info-panel renderers
//   9. Click interaction
//
// All computed values come from one source of truth: the `segments` array.

// ============================================================
// 1. IMPORTS
// ============================================================
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";

import "@arcgis/core/assets/esri/themes/light/main.css";
import "./style.css";

// ============================================================
// 2. CONFIG / CONSTANTS
// ============================================================

// The map's initial view (Halifax, Nova Scotia).
const MAP_CONFIG = {
  basemap: "streets-navigation-vector",
  center: [-63.5752, 44.6488],
  zoom: 12
};

// The primary anomaly segment for the RouteSense narrative.
// This single object is the only place the anomaly segment is defined.
const ANOMALY_SEGMENT = {
  fromOrder: 6,
  toOrder: 7,
  label: "Point 6 \u2192 Point 7",
  reason:
    "Manually selected as the primary RouteSense anomaly because it breaks " +
    "the surrounding movement rhythm."
};

// The range of points treated as "normal" when computing the baseline.
const NORMAL_BASELINE_RANGE = { fromOrder: 1, toOrder: 5 };

// Threshold-based prototype detection rule (Phase 7 starter).
// A segment is flagged if its speed exceeds the baseline by `speedMultiplier`,
// or if its heading change exceeds `headingChangeDegrees`.
const THRESHOLD_RULE = {
  speedMultiplier: 1.5,
  headingChangeDegrees: 45
};

// ============================================================
// 3. PURE HELPER FUNCTIONS
// These have no side effects and are defined before any code that uses them.
// ============================================================

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle distance between two {latitude, longitude} points, in km.
function getDistanceKm(start, end) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLon = toRadians(end.longitude - start.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(start.latitude)) *
      Math.cos(toRadians(end.latitude)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const parseTimestamp = (timestamp) => new Date(timestamp.replace(" ", "T"));

// Elapsed time between two points, in hours.
const getTimeDiffHours = (start, end) =>
  (parseTimestamp(end.timestamp) - parseTimestamp(start.timestamp)) / 3600000;

// Estimated speed for a segment, in km/h. Returns null for zero/negative time.
function getEstimatedSpeed(start, end) {
  const hours = getTimeDiffHours(start, end);
  return hours > 0 ? getDistanceKm(start, end) / hours : null;
}

// Compass bearing (0-360 deg) from start to end. Used for trajectory analysis.
function getHeading(start, end) {
  const deltaLon = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);

  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);

  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

// Absolute difference between two headings, normalised to 0-180 deg.
function getHeadingChange(previousHeading, currentHeading) {
  const change = Math.abs(currentHeading - previousHeading);
  return change > 180 ? 360 - change : change;
}

// Screen-space rotation angle (degrees) for drawing a direction arrow.
// NOTE: this is a display-only cartesian angle, NOT a compass heading.
// It differs from getHeading() on purpose - the two are not interchangeable.
function getArrowAngle(start, end) {
  const deltaLon = end.longitude - start.longitude;
  const deltaLat = end.latitude - start.latitude;
  return -Math.atan2(deltaLat, deltaLon) * (180 / Math.PI);
}

const getMidpoint = (start, end) => ({
  longitude: (start.longitude + end.longitude) / 2,
  latitude: (start.latitude + end.latitude) / 2
});

// Mean of an array, ignoring null/undefined/NaN. Returns null if nothing valid.
function average(values) {
  const valid = values.filter((v) => v != null && !Number.isNaN(v));
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null;
}

// Percent difference of `value` relative to `baseline`.
function percentDifference(value, baseline) {
  if (value == null || baseline == null || baseline === 0) return null;
  return ((value - baseline) / baseline) * 100;
}

// Format a number for display, or "N/A" if it isn't a real number.
function formatNumber(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(decimals);
}

// ============================================================
// 4. TRAJECTORY DATA
// Mock AIS-like points used to prototype the visual design before
// connecting to real maritime data.
// ============================================================

const trajectoryMetadata = {
  routeName: "Halifax Harbour Expanded Sample Trajectory",
  vesselId: "SAMPLE-VESSEL-001",
  description:
    "An expanded AIS-like sample route with multiple normal movement points " +
    "and one highlighted anomalous segment for perception-aware visualization testing."
};

const samplePoints = [
  {
    name: "Vessel Point 1", order: 1,
    longitude: -63.59, latitude: 44.665, timestamp: "2026-04-28 10:00",
    note: "Starting point near the inner harbour. The vessel begins moving in a steady southeast direction."
  },
  {
    name: "Vessel Point 2", order: 2,
    longitude: -63.579, latitude: 44.659, timestamp: "2026-04-28 10:10",
    note: "Normal movement point. The vessel continues along a smooth harbour trajectory."
  },
  {
    name: "Vessel Point 3", order: 3,
    longitude: -63.568, latitude: 44.653, timestamp: "2026-04-28 10:20",
    note: "Normal movement point. Direction and spacing remain consistent."
  },
  {
    name: "Vessel Point 4", order: 4,
    longitude: -63.557, latitude: 44.647, timestamp: "2026-04-28 10:30",
    note: "Normal movement point. This reinforces the expected movement rhythm before the anomaly."
  },
  {
    name: "Vessel Point 5", order: 5,
    longitude: -63.546, latitude: 44.641, timestamp: "2026-04-28 10:40",
    note: "Normal movement point. The vessel still follows the expected route pattern."
  },
  {
    name: "Vessel Point 6", order: 6,
    longitude: -63.553461, latitude: 44.618908, timestamp: "2026-04-28 10:50",
    note: "Anomalous movement point. The vessel suddenly detours away from the established route."
  },
  {
    name: "Vessel Point 7", order: 7,
    longitude: -63.535, latitude: 44.632, timestamp: "2026-04-28 11:00",
    note: "Anomalous return movement. The vessel sharply shifts back toward the harbour path."
  },
  {
    name: "Vessel Point 8", order: 8,
    longitude: -63.525, latitude: 44.626, timestamp: "2026-04-28 11:10",
    note: "Normal movement resumes after the unusual detour."
  }
];

// ============================================================
// 5. DERIVED DATA PIPELINE
// One pass builds every segment with its computed features.
// `segments` is the single source of truth for all downstream code.
// ============================================================

const segments = [];
for (let i = 0; i < samplePoints.length - 1; i++) {
  const start = samplePoints[i];
  const end = samplePoints[i + 1];
  const heading = getHeading(start, end);
  const previousSegment = segments[i - 1];

  segments.push({
    index: i,
    start,
    end,
    fromOrder: start.order,
    toOrder: end.order,
    distanceKm: getDistanceKm(start, end),
    estimatedSpeed: getEstimatedSpeed(start, end),
    heading,
    headingChange: previousSegment
      ? getHeadingChange(previousSegment.heading, heading)
      : null,
    isPrimaryAnomaly:
      start.order === ANOMALY_SEGMENT.fromOrder &&
      end.order === ANOMALY_SEGMENT.toOrder
  });
}

// Baseline statistics from the normal-movement segments.
const baselineSegments = segments.filter(
  (s) =>
    s.fromOrder >= NORMAL_BASELINE_RANGE.fromOrder &&
    s.toOrder <= NORMAL_BASELINE_RANGE.toOrder
);

const baseline = {
  description: "Average of normal movement segments (Point 1 -> Point 5)",
  averageSpeed: average(baselineSegments.map((s) => s.estimatedSpeed)),
  averageHeadingChange: average(baselineSegments.map((s) => s.headingChange))
};

// Threshold-based detection: evaluate every segment against the baseline.
const speedThreshold = baseline.averageSpeed * THRESHOLD_RULE.speedMultiplier;

function evaluateSegment(segment) {
  const speedFlagged = segment.estimatedSpeed > speedThreshold;
  // headingChange is null for the first segment; treat that as 0 (no turn).
  const headingFlagged =
    (segment.headingChange ?? 0) > THRESHOLD_RULE.headingChangeDegrees;

  return {
    flagged: speedFlagged || headingFlagged,
    speedFlagged,
    headingFlagged,
    speedThreshold,
    headingThreshold: THRESHOLD_RULE.headingChangeDegrees
  };
}

segments.forEach((segment) => {
  segment.detection = evaluateSegment(segment);
});

// The single anomaly lookup used everywhere downstream.
const anomalyEvidence = segments.find((s) => s.isPrimaryAnomaly) ?? null;

const anomalyDeviation = anomalyEvidence
  ? {
      speedPercent: percentDifference(
        anomalyEvidence.estimatedSpeed,
        baseline.averageSpeed
      ),
      headingChangeDifference:
        anomalyEvidence.headingChange != null &&
        baseline.averageHeadingChange != null
          ? anomalyEvidence.headingChange - baseline.averageHeadingChange
          : null
    }
  : { speedPercent: null, headingChangeDifference: null };

// ============================================================
// 6. MAP SETUP
// ============================================================

const map = new Map({ basemap: MAP_CONFIG.basemap });

const view = new MapView({
  container: "viewDiv",
  map,
  center: MAP_CONFIG.center,
  zoom: MAP_CONFIG.zoom
});

view.popupEnabled = false;

// ============================================================
// 7. MAP GRAPHICS
// ============================================================

// --- Trajectory line ---
const trajectoryLine = new Graphic({
  geometry: {
    type: "polyline",
    paths: [samplePoints.map((p) => [p.longitude, p.latitude])]
  },
  symbol: { type: "simple-line", color: [0, 102, 255], width: 4 },
  attributes: { graphicType: "trajectory-line" }
});

view.graphics.add(trajectoryLine);

// --- Anomaly cue (glow + dashed line) ---
// Built only if the configured anomaly segment exists in the data.
if (anomalyEvidence) {
  const anomalyPath = [
    [anomalyEvidence.start.longitude, anomalyEvidence.start.latitude],
    [anomalyEvidence.end.longitude, anomalyEvidence.end.latitude]
  ];

  // Subtle glow behind the segment improves contrast against the basemap.
  const anomalyGlow = new Graphic({
    geometry: { type: "polyline", paths: [anomalyPath] },
    symbol: { type: "simple-line", color: [255, 120, 80, 0.25], width: 13, style: "solid" }
  });

  // The perception-aware cue: dashed, thick, red-orange - multiple visual
  // channels, not color alone.
  const anomalyLine = new Graphic({
    geometry: { type: "polyline", paths: [anomalyPath] },
    symbol: { type: "simple-line", color: [255, 80, 60, 0.95], width: 7, style: "dash" },
    attributes: {
      graphicType: "anomaly-segment",
      startOrder: anomalyEvidence.fromOrder,
      endOrder: anomalyEvidence.toOrder,
      estimatedSpeed: anomalyEvidence.estimatedSpeed,
      headingChange: anomalyEvidence.headingChange,
      flagged: anomalyEvidence.detection.flagged
    }
  });

  view.graphics.add(anomalyGlow);
  view.graphics.add(anomalyLine);
}

// --- Direction arrows (one per segment) ---
segments.forEach((segment) => {
  const midpoint = getMidpoint(segment.start, segment.end);

  view.graphics.add(
    new Graphic({
      geometry: { type: "point", longitude: midpoint.longitude, latitude: midpoint.latitude },
      symbol: {
        type: "text",
        color: "white",
        text: "\u279C",
        font: { size: 18, weight: "bold" },
        haloColor: "black",
        haloSize: 1,
        angle: getArrowAngle(segment.start, segment.end)
      },
      attributes: {
        graphicType: "direction-arrow",
        fromPoint: segment.start.name,
        toPoint: segment.end.name
      }
    })
  );
});

// --- Vessel points (re-rendered when selection changes) ---
let selectedPointOrder = null;
const vesselPointGraphics = [];

function createPointGraphic(point) {
  const isSelected = point.order === selectedPointOrder;

  return new Graphic({
    geometry: { type: "point", longitude: point.longitude, latitude: point.latitude },
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: isSelected ? [255, 220, 80, 0.95] : "orange",
      size: isSelected ? "18px" : "12px",
      outline: { color: isSelected ? [255, 255, 255, 1] : "white", width: isSelected ? 3 : 1 }
    },
    attributes: { ...point, graphicType: "vessel-point" }
  });
}

function renderPointGraphics() {
  vesselPointGraphics.forEach((g) => view.graphics.remove(g));
  vesselPointGraphics.length = 0;

  samplePoints.forEach((point) => {
    const graphic = createPointGraphic(point);
    vesselPointGraphics.push(graphic);
    view.graphics.add(graphic);
  });
}

// Static numeric labels (drawn once; not affected by selection).
samplePoints.forEach((point) => {
  view.graphics.add(
    new Graphic({
      geometry: { type: "point", longitude: point.longitude, latitude: point.latitude },
      symbol: {
        type: "text",
        color: "white",
        text: point.order.toString(),
        font: { size: 12, weight: "bold" },
        haloColor: "black",
        haloSize: 1,
        yoffset: 10
      }
    })
  );
});

renderPointGraphics();

// ============================================================
// 8. INFO-PANEL RENDERERS
// ============================================================

const infoPanel = document.createElement("div");
infoPanel.className = "info-panel";
view.ui.add(infoPanel, "top-right");

const legendMarkup = `
  <ul>
    <li><span class="legend-line normal-line"></span> Normal movement context</li>
    <li><span class="legend-line anomaly-line"></span> Anomalous deviation</li>
  </ul>
`;

function showDefaultPanel() {
  infoPanel.innerHTML = `
    <h3>Perception-Aware Anomaly Cue</h3>
    <p>
      The highlighted segment marks an unusual movement that becomes noticeable
      when compared with the surrounding trajectory context.
    </p>
    <p>
      Click a vessel point to inspect its local trajectory context and compare
      it with the highlighted anomaly segment.
    </p>
    ${legendMarkup}
  `;
}

function showPointPanel(point) {
  const isAnomalyPoint =
    point.order === ANOMALY_SEGMENT.fromOrder ||
    point.order === ANOMALY_SEGMENT.toOrder;

  const anomalyNote = isAnomalyPoint
    ? `<div class="panel-section">
         <h3>Prototype rule note</h3>
         <p>
           This point forms part of the selected
           ${ANOMALY_SEGMENT.fromOrder}\u2192${ANOMALY_SEGMENT.toOrder} anomaly segment.
           Detection is evaluated at the segment level, not per point.
         </p>
       </div>`
    : "";

  infoPanel.innerHTML = `
    <h3>${point.name}</h3>
    <p><strong>Time:</strong> ${point.timestamp}</p>
    <p><strong>Trajectory order:</strong> ${point.order}</p>
    <p>${point.note}</p>
    <hr />
    <p>
      <strong>Prototype note:</strong>
      This interaction helps users inspect the trajectory point-by-point.
    </p>
    ${legendMarkup}
    ${anomalyNote}
  `;
}

function showTrajectoryPanel() {
  infoPanel.innerHTML = `
    <h3>Trajectory Overview</h3>
    <p><strong>Route:</strong> ${trajectoryMetadata.routeName}</p>
    <p><strong>Vessel ID:</strong> ${trajectoryMetadata.vesselId}</p>
    <p>${trajectoryMetadata.description}</p>
    <hr />
    <p>
      Points 1-5 establish the expected movement rhythm, while the highlighted
      segment shows the primary anomaly used for visualization.
    </p>
  `;
}

function showAnomalyPanel() {
  if (!anomalyEvidence) {
    showDefaultPanel();
    return;
  }

  const detection = anomalyEvidence.detection;
  const speedDeviation =
    anomalyDeviation.speedPercent != null
      ? `${anomalyDeviation.speedPercent >= 0 ? "+" : ""}${formatNumber(anomalyDeviation.speedPercent)}%`
      : "N/A";
  const headingDeviation =
    anomalyDeviation.headingChangeDifference != null
      ? `${anomalyDeviation.headingChangeDifference >= 0 ? "+" : ""}${formatNumber(anomalyDeviation.headingChangeDifference)}\u00B0`
      : "N/A";

  infoPanel.innerHTML = `
    <h3>Threshold-Based Anomaly Detection Starter</h3>
    <p><strong>Primary anomaly segment:</strong>
       Vessel Point ${anomalyEvidence.fromOrder} \u2192 Vessel Point ${anomalyEvidence.toOrder}</p>

    <div class="panel-section">
      <p><strong>Computed evidence vs. normal baseline</strong></p>
      <p>Estimated speed: ${formatNumber(anomalyEvidence.estimatedSpeed)} km/h
         (baseline ${formatNumber(baseline.averageSpeed)} km/h, ${speedDeviation})</p>
      <p>Heading change: ${formatNumber(anomalyEvidence.headingChange)}\u00B0
         (baseline ${formatNumber(baseline.averageHeadingChange)}\u00B0, ${headingDeviation})</p>
    </div>

    <div class="panel-section">
      <p><strong>Threshold rule</strong></p>
      <p>Speed threshold: ${formatNumber(detection.speedThreshold)} km/h -
         ${detection.speedFlagged ? "Triggered" : "Not triggered"}</p>
      <p>Heading threshold: ${detection.headingThreshold}\u00B0 -
         ${detection.headingFlagged ? "Triggered" : "Not triggered"}</p>
      <p><strong>Rule status:</strong> ${
        detection.flagged
          ? "This segment is flagged by the threshold-based prototype rule."
          : "This segment is the narrative anomaly but is not flagged by the simple rule."
      }</p>
    </div>

    <p class="panel-note">
      This is a simple threshold-based detection starter. It is not
      production-ready anomaly detection and has not been validated on real AIS data.
    </p>
  `;
}

function showDirectionPanel(attributes) {
  infoPanel.innerHTML = `
    <h3>Trajectory Direction</h3>
    <p><strong>From:</strong> ${attributes.fromPoint}</p>
    <p><strong>To:</strong> ${attributes.toPoint}</p>
    <hr />
    <p>
      Direction cues help users read the trajectory as an ordered movement
      pattern rather than a disconnected set of points.
    </p>
  `;
}

showDefaultPanel();

// ============================================================
// 9. CLICK INTERACTION
// A single dispatcher routes clicks by graphicType.
// ============================================================

const panelByGraphicType = {
  "trajectory-line": showTrajectoryPanel,
  "anomaly-segment": showAnomalyPanel,
  "direction-arrow": showDirectionPanel
};

view.on("click", (event) => {
  view.hitTest(event).then((response) => {
    const hit = response.results.find((r) => r.graphic?.attributes?.graphicType);

    // Clicked empty space: clear selection and reset.
    if (!hit) {
      selectedPointOrder = null;
      renderPointGraphics();
      showDefaultPanel();
      return;
    }

    const attributes = hit.graphic.attributes;

    // Vessel points are the only selectable graphic.
    if (attributes.graphicType === "vessel-point") {
      selectedPointOrder = attributes.order;
      renderPointGraphics();
      showPointPanel(attributes);
      return;
    }

    // Any other graphic clears the point selection first.
    selectedPointOrder = null;
    renderPointGraphics();
    (panelByGraphicType[attributes.graphicType] ?? showDefaultPanel)(attributes);
  });
});
