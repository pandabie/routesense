// RouteSense prototype — composition root.
// Perception-aware maritime trajectory visualization using the ArcGIS Maps SDK.
//
// Module layout:
//   config.js   — every tunable value (map, anomaly, baseline, rule, encoding)
//   geo.js      — pure geometry / time / statistics helpers
//   data.js     — synthetic Phase 8 fixture
//   ais.js      — raw AIS validation and normalization boundary
//   datasets.js — dataset adapters, registry, and selection
//   analysis.js — pure derived-data pipeline (segments, baseline, detection)
//   panels.js   — pure (data) -> HTML-string panel renderers
//   main.js     — this file: map setup, graphics, click interaction
//
// All computed values come from one source of truth: the selected `model`
// object, either the reviewed threshold-analysis model or the unreviewed
// trajectory-display model.

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";

import "@arcgis/core/assets/esri/themes/light/main.css";
import "./style.css";

import {
  MAP_CONFIG,
  UI_LAYOUT,
  DATASET_SELECTION,
  ENCODING,
  toCssColor
} from "./config.js";
import { getArrowAngle, getMidpoint } from "./geo.js";
import {
  DATASET_REGISTRY,
  buildDatasetSwitcherOptions,
  getDatasetAnalysisOptions,
  resolveRequestedDatasetId,
  selectDataset,
  summarizeDatasetProvenance
} from "./datasets.js";
import {
  buildTrajectoryDisplayModel,
  buildTrajectoryModel
} from "./analysis.js";
import {
  renderDatasetSwitcher,
  renderDefaultPanel,
  renderPointPanel,
  renderTrajectoryPanel,
  renderAnomalyPanel,
  renderRuleEvidenceSegmentPanel,
  renderNormalSegmentPanel,
  renderDirectionPanel,
  renderUnreviewedDatasetPanel,
  renderUnreviewedPointPanel,
  renderUnreviewedSegmentPanel
} from "./panels.js";

// ============================================================
// DERIVED DATA
// ============================================================

const requestedDatasetId = resolveRequestedDatasetId(
  DATASET_SELECTION.activeDatasetId,
  window.location.search
);

const datasetSelection = selectDataset(
  DATASET_REGISTRY,
  requestedDatasetId,
  { fallbackId: DATASET_SELECTION.fallbackDatasetId }
);

if (datasetSelection.usedFallback) {
  console.warn(
    `RouteSense dataset "${datasetSelection.requestedId}" was unavailable; ` +
    `using "${datasetSelection.selectedId}" instead.`
  );
}

const activeDataset = datasetSelection.dataset;
const trajectoryPoints = activeDataset.points;
const trajectoryMetadata = activeDataset.metadata;
const analysisOptions = getDatasetAnalysisOptions(activeDataset);
const hasReviewedAnalysis = analysisOptions != null;
const model = hasReviewedAnalysis
  ? buildTrajectoryModel(trajectoryPoints, analysisOptions)
  : buildTrajectoryDisplayModel(trajectoryPoints, {
      measurementReviewProfile: activeDataset.measurementReviewProfile
    });
const activeMapConfig = activeDataset.mapView ?? MAP_CONFIG;

// ============================================================
// MAP SETUP
// ============================================================

const map = new Map({ basemap: activeMapConfig.basemap ?? MAP_CONFIG.basemap });

function getResponsiveViewPadding() {
  const useDesktopLayout = window.innerWidth >= UI_LAYOUT.desktopBreakpoint;

  return {
    top: 0,
    right: useDesktopLayout ? UI_LAYOUT.mapRightPadding : 0,
    bottom: 0,
    left: 0
  };
}

const view = new MapView({
  container: "viewDiv",
  map,
  center: activeMapConfig.center ?? MAP_CONFIG.center,
  zoom: activeMapConfig.zoom ?? MAP_CONFIG.zoom,
  padding: getResponsiveViewPadding()
});

view.popupEnabled = false;

// ============================================================
// MAP GRAPHICS
// ============================================================

// --- Trajectory segments ---
// Rendered separately with identical normal styling so each segment can own
// its panel interaction without changing the visual route encoding.
model.segments.forEach((segment) => {
  view.graphics.add(
    new Graphic({
      geometry: {
        type: "polyline",
        paths: [[
          [segment.start.longitude, segment.start.latitude],
          [segment.end.longitude, segment.end.latitude]
        ]]
      },
      symbol: {
        type: "simple-line",
        color: ENCODING.normalLine.color,
        width: ENCODING.normalLine.width
      },
      attributes: {
        graphicType: "trajectory-segment",
        fromOrder: segment.fromOrder,
        toOrder: segment.toOrder,
        flagged: segment.detection?.flagged ?? null,
        isPrimaryAnomaly: segment.isPrimaryAnomaly
      }
    })
  );
});

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
    attributes: { graphicType: "vessel-point", order: point.order }
  });
}

function renderPointGraphics() {
  vesselPointGraphics.forEach((g) => view.graphics.remove(g));
  vesselPointGraphics.length = 0;

  trajectoryPoints.forEach((point) => {
    const graphic = createPointGraphic(point);
    vesselPointGraphics.push(graphic);
    view.graphics.add(graphic);
  });
}

// Static numeric labels (drawn once; not affected by selection).
trajectoryPoints.forEach((point) => {
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
infoPanel.style.setProperty("--rs-panel-width", `${UI_LAYOUT.infoPanelWidth}px`);
infoPanel.style.setProperty("--rs-panel-inset", `${UI_LAYOUT.panelInset}px`);
infoPanel.style.setProperty(
  "--rs-panel-total-inset",
  `${UI_LAYOUT.panelInset * 2}px`
);

// Keep the panel anchored to the browser edge instead of ArcGIS's padded UI
// region. MapView.padding can now reframe the trajectory without moving the
// panel away from the far-right edge.
const viewContainer = document.getElementById("viewDiv");

if (!viewContainer) {
  throw new Error("RouteSense requires a #viewDiv map container.");
}

viewContainer.append(infoPanel);

// The panel is split into a persistent header (dataset switcher, rendered
// once at boot) and a content region (re-rendered on every interaction).
// Dataset switching is a full page reload via `?dataset=`, matching the
// boot-once architecture — no runtime teardown or rebuild.
const panelHeader = document.createElement("div");
panelHeader.className = "info-panel__header";

const panelContent = document.createElement("div");
panelContent.className = "info-panel__content";

infoPanel.append(panelHeader, panelContent);

panelHeader.innerHTML = renderDatasetSwitcher(
  buildDatasetSwitcherOptions(DATASET_REGISTRY, activeDataset.id),
  summarizeDatasetProvenance(activeDataset)
);

panelHeader.addEventListener("click", (event) => {
  const option = event.target.closest("[data-dataset-id]");

  if (!option) return;

  const requestedId = option.dataset.datasetId;

  if (requestedId === activeDataset.id) return;

  const url = new URL(window.location.href);
  url.searchParams.set("dataset", requestedId);
  window.location.assign(url.toString());
});

function applyResponsiveLayout() {
  view.padding = getResponsiveViewPadding();
}

window.addEventListener("resize", applyResponsiveLayout);

// Inject encoding colors into CSS custom properties so the legend in
// style.css always matches the map symbols (single source of truth).
infoPanel.style.setProperty("--rs-normal-color", toCssColor(ENCODING.normalLine.color));
infoPanel.style.setProperty("--rs-anomaly-color", toCssColor(ENCODING.anomalyLine.color));

function renderActiveDatasetPanel() {
  return hasReviewedAnalysis
    ? renderDefaultPanel()
    : renderUnreviewedDatasetPanel(activeDataset, model);
}

panelContent.innerHTML = renderActiveDatasetPanel();

// ============================================================
// CLICK INTERACTION
// A single dispatcher routes clicks by graphicType.
// ============================================================

function getRuleEvidenceItem(attributes) {
  return model.ruleEvidenceItems.find(
    (item) =>
      item.fromOrder === attributes.fromOrder &&
      item.toOrder === attributes.toOrder
  ) ?? null;
}

function getTrajectorySegment(attributes) {
  return model.segments.find(
    (segment) =>
      segment.fromOrder === attributes.fromOrder &&
      segment.toOrder === attributes.toOrder
  ) ?? null;
}

const panelByGraphicType = {
  "trajectory-segment": (attributes) => {
    const segment = getTrajectorySegment(attributes);

    if (!hasReviewedAnalysis) {
      return segment
        ? renderUnreviewedSegmentPanel(segment, activeDataset)
        : renderUnreviewedDatasetPanel(activeDataset, model);
    }

    const reviewItem = getRuleEvidenceItem(attributes);

    if (reviewItem?.isPrimaryAnomaly) {
      return renderAnomalyPanel(model);
    }

    if (reviewItem) {
      return renderRuleEvidenceSegmentPanel(reviewItem, {
        thresholds: model.thresholds,
        primaryAnomaly: model.anomalyEvidence
      });
    }

    return segment
      ? renderNormalSegmentPanel(segment, {
          thresholds: model.thresholds,
          primaryAnomaly: model.anomalyEvidence
        })
      : renderTrajectoryPanel(trajectoryMetadata);
  },
  "anomaly-segment": () => renderAnomalyPanel(model),
  "direction-arrow": (attributes) => renderDirectionPanel(attributes)
};

view.on("click", (event) => {
  view.hitTest(event).then((response) => {
    const interactiveHits = response.results.filter(
      (result) => result.graphic?.attributes?.graphicType
    );

    // Prefer evidence-bearing line segments over direction arrows when their
    // hit areas overlap. Vessel points remain the highest-priority selection.
    const hitPriority = [
      "vessel-point",
      "anomaly-segment",
      "trajectory-segment",
      "direction-arrow"
    ];

    const hit = hitPriority
      .map((graphicType) =>
        interactiveHits.find(
          (result) => result.graphic.attributes.graphicType === graphicType
        )
      )
      .find(Boolean);

    // Clicked empty space: clear selection and reset.
    if (!hit) {
      selectedPointOrder = null;
      renderPointGraphics();
      panelContent.innerHTML = renderActiveDatasetPanel();
      return;
    }

    const attributes = hit.graphic.attributes;

    // Vessel points are the only selectable graphic.
    if (attributes.graphicType === "vessel-point") {
      selectedPointOrder = attributes.order;
      renderPointGraphics();
      const selectedPoint = trajectoryPoints.find(
        (point) => point.order === attributes.order
      ) ?? attributes;

      panelContent.innerHTML = hasReviewedAnalysis
        ? renderPointPanel(selectedPoint, analysisOptions.anomalySegment)
        : renderUnreviewedPointPanel(selectedPoint, activeDataset);
      return;
    }

    // Any other graphic clears the point selection first.
    selectedPointOrder = null;
    renderPointGraphics();
    const renderPanel = panelByGraphicType[attributes.graphicType];
    panelContent.innerHTML = renderPanel
      ? renderPanel(attributes)
      : renderActiveDatasetPanel();
  });
});
