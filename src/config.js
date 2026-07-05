// RouteSense configuration.
// Every tunable value lives here. No other file defines constants
// that change the system's behaviour or appearance.

// Dataset selection is configuration-driven. The controlled Phase 8 fixture
// remains the safe default and fallback; the real AIS sample can be requested
// explicitly without inheriting the fixture's analysis assumptions.
export const DATASET_SELECTION = {
  activeDatasetId: "synthetic-phase8",
  fallbackDatasetId: "synthetic-phase8"
};

// The map's initial view (Halifax, Nova Scotia).
export const MAP_CONFIG = {
  basemap: "streets-navigation-vector",
  center: [-63.5752, 44.6488],
  zoom: 12
};

// Interface layout tuning.
// Change these values to resize the panel, control its edge inset, or move
// the effective map centre. The panel stays anchored to the browser edge;
// `mapRightPadding` affects only the map framing behind it.
export const UI_LAYOUT = {
  infoPanelWidth: 420,
  panelInset: 16,
  mapRightPadding: 470,
  desktopBreakpoint: 900
};

// The primary anomaly segment for the RouteSense narrative.
// This single object is the only place the anomaly segment is defined.
export const ANOMALY_SEGMENT = {
  fromOrder: 6,
  toOrder: 7,
  label: "Point 6 \u2192 Point 7",
  reason:
    "Manually selected as the primary RouteSense anomaly because it breaks " +
    "the surrounding movement rhythm."
};

// The range of points treated as "normal" when computing the baseline.
export const NORMAL_BASELINE_RANGE = { fromOrder: 1, toOrder: 5 };

// Threshold-based prototype detection rule (Phase 7 starter).
// A segment is flagged if its speed exceeds the baseline by `speedMultiplier`,
// or if its heading change exceeds `headingChangeDegrees`.
export const THRESHOLD_RULE = {
  speedMultiplier: 1.5,
  headingChangeDegrees: 45
};

// Visual encoding tokens shared between map symbols and the legend.
// main.js injects the colors into CSS custom properties so the legend
// in style.css can never drift out of sync with the map again.
export const ENCODING = {
  normalLine: { color: [0, 102, 255], width: 4 },
  anomalyLine: { color: [255, 80, 60, 0.95], width: 7, style: "dash" },
  anomalyGlow: { color: [255, 120, 80, 0.25], width: 13 },
  point: { color: "orange", size: "12px", outlineColor: "white", outlineWidth: 1 },
  selectedPoint: {
    color: [255, 220, 80, 0.95],
    size: "18px",
    outlineColor: [255, 255, 255, 1],
    outlineWidth: 3
  }
};

// Helper: turn an [r, g, b] or [r, g, b, a] array into a CSS color string.
export function toCssColor([r, g, b, a]) {
  return a != null ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
}
