// RouteSense prototype — composition root.
// Perception-aware maritime trajectory visualization using the ArcGIS Maps SDK.
//
// Module layout:
//   config.js   — every tunable value (map, anomaly, baseline, rule, encoding)
//   geo.js      — pure geometry / time / statistics helpers
//   data.js     — mock AIS-like trajectory points
//   analysis.js — pure derived-data pipeline (segments, baseline, detection)
//   panels.js   — pure (data) -> HTML-string panel renderers
//   main.js     — this file: map setup, graphics, click interaction
//
// All computed values come from one source of truth: the `model` object
// returned by buildTrajectoryModel().

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";

import "@arcgis/core/assets/esri/themes/light/main.css";
import "./style.css";

import {
  MAP_CONFIG,
  ANOMALY_SEGMENT,
  NORMAL_BASELINE_RANGE,
  THRESHOLD_RULE,
  ENCODING,
  toCssColor
} from "./config.js";
import { getArrowAngle, getMidpoint } from "./geo.js";
import { trajectoryMetadata, samplePoints } from "./data.js";
import { buildTrajectoryModel } from "./analysis.js";
import {
  renderDefaultPanel,
  renderPointPanel,
  renderTrajectoryPanel,
  renderAnomalyPanel,
  renderDirectionPanel
} from "./panels.js";

// ============================================================
// DERIVED DATA
// ============================================================

const model = buildTrajectoryModel(samplePoints, {
  anomalySegment: ANOMALY_SEGMENT,
  baselineRange: NORMAL_BASELINE_RANGE,
  thresholdRule: THRESHOLD_RULE
});

// ============================================================
// MAP SETUP
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
// MAP GRAPHICS
// ============================================================

// --- Trajectory line ---
view.graphics.add(
  new Graphic({
    geometry: {
      type: "polyline",
      paths: [samplePoints.map((p) => [p.longitude, p.latitude])]
    },
    symbol: {
      type: "simple-line",
      color: ENCODING.normalLine.color,
      width: ENCODING.normalLine.width
    },
    attributes: { graphicType: "trajectory-line" }
  })
);

// --- Anomaly cue (glow + dashed line) ---
// Built only if the configured anomaly segment exists in the data.
if (model.anomalyEvidence) {
  const { anomalyEvidence } = model;
  const anomalyPath = [
    [anomalyEvidence.start.longitude, anomalyEvidence.start.latitude],
    [anomalyEvidence.end.longitude, anomalyEvidence.end.latitude]
  ];

  // Subtle glow behind the segment improves contrast against the basemap.
  view.graphics.add(
    new Graphic({
      geometry: { type: "polyline", paths: [anomalyPath] },
      symbol: {
        type: "simple-line",
        color: ENCODING.anomalyGlow.color,
        width: ENCODING.anomalyGlow.width,
        style: "solid"
      }
    })
  );

  // The perception-aware cue: dashed, thick, red-orange - multiple visual
  // channels, not color alone.
  view.graphics.add(
    new Graphic({
      geometry: { type: "polyline", paths: [anomalyPath] },
      symbol: {
        type: "simple-line",
        color: ENCODING.anomalyLine.color,
        width: ENCODING.anomalyLine.width,
        style: ENCODING.anomalyLine.style
      },
      attributes: {
        graphicType: "anomaly-segment",
        startOrder: anomalyEvidence.fromOrder,
        endOrder: anomalyEvidence.toOrder,
        estimatedSpeed: anomalyEvidence.estimatedSpeed,
        headingChange: anomalyEvidence.headingChange,
        flagged: anomalyEvidence.detection.flagged
      }
    })
  );
}

// --- Direction arrows (one per segment) ---
model.segments.forEach((segment) => {
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
  const style = point.order === selectedPointOrder ? ENCODING.selectedPoint : ENCODING.point;

  return new Graphic({
    geometry: { type: "point", longitude: point.longitude, latitude: point.latitude },
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: style.color,
      size: style.size,
      outline: { color: style.outlineColor, width: style.outlineWidth }
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
// INFO PANEL
// ============================================================

const infoPanel = document.createElement("div");
infoPanel.className = "info-panel";
view.ui.add(infoPanel, "top-right");

// Inject encoding colors into CSS custom properties so the legend in
// style.css always matches the map symbols (single source of truth).
infoPanel.style.setProperty("--rs-normal-color", toCssColor(ENCODING.normalLine.color));
infoPanel.style.setProperty("--rs-anomaly-color", toCssColor(ENCODING.anomalyLine.color));

infoPanel.innerHTML = renderDefaultPanel();

// ============================================================
// CLICK INTERACTION
// A single dispatcher routes clicks by graphicType.
// ============================================================

const panelByGraphicType = {
  "trajectory-line": () => renderTrajectoryPanel(trajectoryMetadata),
  "anomaly-segment": () => renderAnomalyPanel(model),
  "direction-arrow": (attributes) => renderDirectionPanel(attributes)
};

view.on("click", (event) => {
  view.hitTest(event).then((response) => {
    const hit = response.results.find((r) => r.graphic?.attributes?.graphicType);

    // Clicked empty space: clear selection and reset.
    if (!hit) {
      selectedPointOrder = null;
      renderPointGraphics();
      infoPanel.innerHTML = renderDefaultPanel();
      return;
    }

    const attributes = hit.graphic.attributes;

    // Vessel points are the only selectable graphic.
    if (attributes.graphicType === "vessel-point") {
      selectedPointOrder = attributes.order;
      renderPointGraphics();
      infoPanel.innerHTML = renderPointPanel(attributes, ANOMALY_SEGMENT);
      return;
    }

    // Any other graphic clears the point selection first.
    selectedPointOrder = null;
    renderPointGraphics();
    const renderPanel = panelByGraphicType[attributes.graphicType];
    infoPanel.innerHTML = renderPanel ? renderPanel(attributes) : renderDefaultPanel();
  });
});
