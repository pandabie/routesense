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
  GROUP_SELECTION,
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
  buildTrajectoryModel,
  getSegmentKey
} from "./analysis.js";
import {
  buildSelectionSummary,
  selectPointsInExtent
} from "./selection.js";
import {
  PANEL_CONTENT_ID,
  renderDatasetSwitcher,
  renderDefaultPanel,
  renderGroupSelectionPanel,
  renderMapHelp,
  renderPanelToggle,
  renderPointPanel,
  renderSegmentPanel,
  renderTrajectoryPanel,
  renderAnomalyPanel,
  renderDirectionPanel,
  renderUnreviewedDatasetPanel,
  renderUnreviewedPointPanel
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

// --- Selection state ---
// Points and segments share one selection model so a click and a drag box are
// the same thing at different sizes: a click just produces a set of one.
const selectedPointOrders = new Set();
const selectedSegmentKeys = new Set();
const vesselPointGraphics = [];
const segmentHighlightGraphics = [];

function setSelection({ pointOrders = [], segmentKeys = [] } = {}) {
  selectedPointOrders.clear();
  pointOrders.forEach((order) => selectedPointOrders.add(order));

  selectedSegmentKeys.clear();
  segmentKeys.forEach((key) => selectedSegmentKeys.add(key));

  renderSegmentHighlights();
  renderPointGraphics();
}

// A halo behind the route, not a restyled route. Inserting at index 0 keeps it
// below every other graphic, so selecting the anomaly segment still shows its
// dashed red cue on top rather than replacing it with a selection colour.
function renderSegmentHighlights() {
  segmentHighlightGraphics.forEach((g) => view.graphics.remove(g));
  segmentHighlightGraphics.length = 0;

  model.segments
    .filter((segment) =>
      selectedSegmentKeys.has(getSegmentKey(segment.fromOrder, segment.toOrder))
    )
    .forEach((segment) => {
      // No attributes: the click dispatcher filters on graphicType, so the
      // halo can never intercept a hit meant for the segment it sits under.
      const graphic = new Graphic({
        geometry: {
          type: "polyline",
          paths: [[
            [segment.start.longitude, segment.start.latitude],
            [segment.end.longitude, segment.end.latitude]
          ]]
        },
        symbol: {
          type: "simple-line",
          color: ENCODING.selectedSegment.color,
          width: ENCODING.selectedSegment.width
        }
      });

      view.graphics.add(graphic, 0);
      segmentHighlightGraphics.push(graphic);
    });
}

function createPointGraphic(point) {
  const style = selectedPointOrders.has(point.order)
    ? ENCODING.selectedPoint
    : ENCODING.point;

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
panelContent.id = PANEL_CONTENT_ID;

// A toolbar above the header holds the collapse control, so collapsing hides
// only the interaction output. The dataset switcher stays reachable because
// switching datasets is how you change what the map is showing at all.
const panelToolbar = document.createElement("div");
panelToolbar.className = "info-panel__toolbar";

infoPanel.append(panelToolbar, panelHeader, panelContent);

let isPanelExpanded = true;

function renderPanelToolbar() {
  panelToolbar.innerHTML = renderPanelToggle(isPanelExpanded);
  infoPanel.classList.toggle("info-panel--collapsed", !isPanelExpanded);
}

panelToolbar.addEventListener("click", (event) => {
  if (!event.target.closest("[data-panel-toggle]")) return;

  isPanelExpanded = !isPanelExpanded;
  renderPanelToolbar();
});

renderPanelToolbar();

// --- Map help ---
// It describes gestures performed on the map, so it belongs to the map rather
// than the panel and must stay readable while the panel is collapsed.
//
// Handed to view.ui instead of positioned by hand: ArcGIS stacks it under the
// zoom control it shares the corner with, so the two can never overlap and no
// magic offset has to be kept in sync with the widget's height.
const mapHelp = document.createElement("div");
mapHelp.className = "map-help";
view.ui.add(mapHelp, "top-left");

let isMapHelpExpanded = true;

function renderMapHelpBox() {
  mapHelp.innerHTML = renderMapHelp({ isExpanded: isMapHelpExpanded });
}

mapHelp.addEventListener("click", (event) => {
  if (!event.target.closest("[data-help-toggle]")) return;

  isMapHelpExpanded = !isMapHelpExpanded;
  renderMapHelpBox();
});

renderMapHelpBox();

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

// The panel is the scroll container, so every content swap returns to the top;
// otherwise a new selection can render below the current scroll position.
// A collapsed panel re-expands here: the panel is the entire result of a map
// interaction, so leaving it shut would make a click look like it did nothing.
function setPanelContent(html) {
  panelContent.innerHTML = html;

  if (!isPanelExpanded) {
    isPanelExpanded = true;
    renderPanelToolbar();
  }

  infoPanel.scrollTop = 0;
}

// The one path that turns a set of points into map highlights plus a panel.
// Both entry points use it — the drag box, and the segment links inside a
// group panel — so a selection made either way is indistinguishable.
function applyPointSelection(selectedPoints) {
  const summary = buildSelectionSummary(selectedPoints, model, {
    primaryAnomaly: analysisOptions?.anomalySegment ?? null,
    baselineRange: analysisOptions?.baselineRange ?? null
  });

  // Only interior segments are highlighted, matching what the panel counts.
  // A boundary segment is explained in text but never drawn as selected.
  setSelection({
    pointOrders: selectedPoints.map((point) => point.order),
    segmentKeys: summary.interiorSegments.map((segment) =>
      getSegmentKey(segment.fromOrder, segment.toOrder)
    )
  });

  setPanelContent(
    renderGroupSelectionPanel(summary, {
      model,
      dataset: activeDataset,
      anomalySegment: analysisOptions?.anomalySegment ?? null
    })
  );
}

// A segment row in a group panel drills into that one segment. Selecting its
// two endpoints reuses the ordinary selection path rather than rendering a
// special case, so the result is exactly a two-point group selection.
panelContent.addEventListener("click", (event) => {
  const link = event.target.closest("[data-select-segment]");

  if (!link) return;

  const fromOrder = Number(link.dataset.fromOrder);
  const toOrder = Number(link.dataset.toOrder);

  const endpoints = trajectoryPoints.filter(
    (point) => point.order === fromOrder || point.order === toOrder
  );

  if (endpoints.length === 0) return;

  applyPointSelection(endpoints);
});

setPanelContent(renderActiveDatasetPanel());

// ============================================================
// CLICK INTERACTION
// A single dispatcher routes clicks by graphicType.
// ============================================================

function getTrajectorySegment(attributes) {
  return model.segments.find(
    (segment) =>
      segment.fromOrder === attributes.fromOrder &&
      segment.toOrder === attributes.toOrder
  ) ?? null;
}

const panelByGraphicType = {
  // renderSegmentPanel owns the choice of panel so that clicking a segment and
  // group-selecting its two endpoints can never disagree.
  "trajectory-segment": (attributes) => {
    const segment = getTrajectorySegment(attributes);

    const segmentPanel = renderSegmentPanel(segment, {
      model,
      dataset: activeDataset
    });

    if (segmentPanel) return segmentPanel;

    // No matching segment in the model: fall back to the trajectory overview.
    return hasReviewedAnalysis
      ? renderTrajectoryPanel(trajectoryMetadata)
      : renderUnreviewedDatasetPanel(activeDataset, model);
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
      setSelection();
      setPanelContent(renderActiveDatasetPanel());
      return;
    }

    const attributes = hit.graphic.attributes;

    if (attributes.graphicType === "vessel-point") {
      setSelection({ pointOrders: [attributes.order] });
      const selectedPoint = trajectoryPoints.find(
        (point) => point.order === attributes.order
      ) ?? attributes;

      setPanelContent(
        hasReviewedAnalysis
          ? renderPointPanel(selectedPoint, analysisOptions.anomalySegment)
          : renderUnreviewedPointPanel(selectedPoint, activeDataset)
      );
      return;
    }

    // Segments carry their endpoint orders under different attribute names
    // depending on which graphic was hit; both resolve to the same segment key.
    const clickedSegmentKey =
      attributes.graphicType === "trajectory-segment"
        ? getSegmentKey(attributes.fromOrder, attributes.toOrder)
        : attributes.graphicType === "anomaly-segment"
          ? getSegmentKey(attributes.startOrder, attributes.endOrder)
          : null;

    setSelection({ segmentKeys: clickedSegmentKey ? [clickedSegmentKey] : [] });

    const renderPanel = panelByGraphicType[attributes.graphicType];
    setPanelContent(
      renderPanel ? renderPanel(attributes) : renderActiveDatasetPanel()
    );
  });
});

// ============================================================
// GROUP SELECTION
//
// Shift-drag draws a box and selects every vessel point inside it.
// ============================================================

// Shift is read once at drag start: releasing the key mid-drag must not turn
// a box selection back into a map pan.
let activeDrag = null;
let selectionBoxGraphic = null;

const clearSelectionBox = () => {
  if (selectionBoxGraphic) {
    view.graphics.remove(selectionBoxGraphic);
    selectionBoxGraphic = null;
  }
};

// Screen corners -> geographic box. `toMap` returns a point in the view's
// spatial reference; `longitude`/`latitude` convert from Web Mercator.
const toGeographicExtent = (origin, current) => {
  const start = view.toMap({ x: origin.x, y: origin.y });
  const end = view.toMap({ x: current.x, y: current.y });

  if (!start || !end) return null;

  return {
    xmin: Math.min(start.longitude, end.longitude),
    ymin: Math.min(start.latitude, end.latitude),
    xmax: Math.max(start.longitude, end.longitude),
    ymax: Math.max(start.latitude, end.latitude)
  };
};

const drawSelectionBox = (extent) => {
  clearSelectionBox();

  selectionBoxGraphic = new Graphic({
    geometry: {
      type: "polygon",
      rings: [[
        [extent.xmin, extent.ymin],
        [extent.xmin, extent.ymax],
        [extent.xmax, extent.ymax],
        [extent.xmax, extent.ymin],
        [extent.xmin, extent.ymin]
      ]]
    },
    symbol: {
      type: "simple-fill",
      color: ENCODING.selectionBox.fillColor,
      outline: {
        color: ENCODING.selectionBox.outlineColor,
        width: ENCODING.selectionBox.outlineWidth,
        style: ENCODING.selectionBox.outlineStyle
      }
    }
  });

  view.graphics.add(selectionBoxGraphic);
};

const applySelection = (extent) => {
  applyPointSelection(selectPointsInExtent(trajectoryPoints, extent));
};

view.on("drag", (event) => {
  if (event.action === "start") {
    activeDrag = event.native?.shiftKey
      ? { x: event.origin.x, y: event.origin.y }
      : null;
  }

  // Not a shift-drag: let the view handle it as a normal pan.
  if (!activeDrag) return;

  // Suppressing propagation on every phase also disables the default
  // shift-drag zoom-box behaviour for the duration of the gesture.
  event.stopPropagation();

  const extent = toGeographicExtent(activeDrag, event);

  if (event.action === "update") {
    if (extent) drawSelectionBox(extent);
    return;
  }

  if (event.action === "end") {
    clearSelectionBox();

    const dragDistance = Math.hypot(
      event.x - activeDrag.x,
      event.y - activeDrag.y
    );

    // Too small to be a deliberate box: leave the existing selection alone
    // and let the click handler deal with it.
    if (dragDistance >= GROUP_SELECTION.minimumDragPixels && extent) {
      applySelection(extent);
    }

    activeDrag = null;
  }
});
