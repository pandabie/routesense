// Info-panel renderers. Every function here is a pure (data) -> HTML-string
// builder; main.js owns the DOM element and assigns innerHTML. Keeping these
// free of DOM/ArcGIS dependencies makes panel content testable and keeps a
// clean boundary between the data model and its presentation.

import { formatNumber } from "./geo.js";
import { MEASUREMENT_COMPARISON_STATUS } from "./measurement-review.js";
import {
  ANOMALY_CONTAINMENT,
  BASELINE_OVERLAP,
  SELECTION_TIER
} from "./selection.js";

const legendMarkup = `
  <ul>
    <li><span class="legend-line normal-line"></span> Normal movement context</li>
    <li><span class="legend-line anomaly-line"></span> Anomalous deviation</li>
  </ul>
`;

export function renderDatasetSwitcher(options = [], provenanceSummary = "") {
  if (!Array.isArray(options) || options.length === 0) {
    return "";
  }

  const optionsMarkup = options
    .map((option) => {
      const activeClass = option.isActive ? " dataset-switcher__option--active" : "";
      const activeMarker = option.isActive
        ? `<span class="dataset-switcher__active-marker">Active</span>`
        : "";

      return `
        <button
          type="button"
          class="dataset-switcher__option${activeClass}"
          data-dataset-id="${option.id}"
          aria-pressed="${option.isActive}"
        >
          <span class="dataset-switcher__label">${option.label}</span>
          <span class="dataset-switcher__badge dataset-switcher__badge--${option.kind}">
            ${option.badgeLabel}
          </span>
          ${activeMarker}
        </button>
      `;
    })
    .join("");

  const provenanceMarkup = provenanceSummary
    ? `<p class="dataset-switcher__provenance">${provenanceSummary}</p>`
    : "";

  return `
    <div class="dataset-switcher">
      <p class="dataset-switcher__title">Dataset</p>
      <div class="dataset-switcher__options" role="group" aria-label="Dataset selection">
        ${optionsMarkup}
      </div>
      ${provenanceMarkup}
      <p class="dataset-switcher__note">Switching datasets reloads the page.</p>
    </div>
  `;
}

// ============================================================
// CHROME (map help, panel collapse)
//
// Both are collapsible, so both take their expanded state as an argument and
// return the whole control. main.js owns the state and re-renders on toggle;
// nothing here reads or writes the DOM.
// ============================================================

export const MAP_HELP_BODY_ID = "rs-map-help-body";
export const PANEL_CONTENT_ID = "rs-panel-content";

/**
 * Instructions for the map's interaction model. Starts expanded because
 * shift-drag has no visual affordance of its own — nothing on the map hints
 * that the gesture exists.
 */
export function renderMapHelp({ isExpanded = true } = {}) {
  const toggle = `
    <button
      type="button"
      class="map-help__toggle"
      data-help-toggle
      aria-expanded="${isExpanded}"
      aria-controls="${MAP_HELP_BODY_ID}"
    >
      <span class="map-help__title">How to use this map</span>
      <span class="map-help__chevron" aria-hidden="true">${isExpanded ? "▾" : "▸"}</span>
    </button>
  `;

  if (!isExpanded) return toggle;

  return `
    ${toggle}
    <div class="map-help__body" id="${MAP_HELP_BODY_ID}">
      <div class="map-help__row">
        <span class="map-help__gesture">Click a point</span>
        <span>Inspect that observation</span>
      </div>
      <div class="map-help__row">
        <span class="map-help__gesture">Click a segment</span>
        <span>Inspect the movement between two points</span>
      </div>
      <div class="map-help__row">
        <kbd>Shift</kbd> + drag
        <span>Select a stretch of the trajectory</span>
      </div>
      <div class="map-help__row">
        <span class="map-help__gesture">Drag</span>
        <span>Pan the map</span>
      </div>
      <div class="map-help__row">
        <span class="map-help__gesture">Click empty water</span>
        <span>Clear the selection</span>
      </div>
    </div>
  `;
}

export function renderPanelToggle(isExpanded = true) {
  return `
    <button
      type="button"
      class="panel-toggle"
      data-panel-toggle
      aria-expanded="${isExpanded}"
      aria-controls="${PANEL_CONTENT_ID}"
    >
      ${isExpanded ? "Collapse" : "Expand for more"}
      <span class="panel-toggle__chevron" aria-hidden="true">${isExpanded ? "▴" : "▾"}</span>
    </button>
  `;
}

export function renderDefaultPanel() {
  return `
    <h3>Perception-Aware Anomaly Cue</h3>
    <p>
      The highlighted segment marks an unusual movement that becomes noticeable
      when compared with the surrounding trajectory context.
    </p>
    <p>
      Click a trajectory segment to inspect its evidence role, or click a
      vessel point to inspect its local trajectory context.
    </p>
    ${legendMarkup}
  `;
}

export function renderPointPanel(point, anomalySegment) {
  const isAnomalyPoint =
    point.order === anomalySegment.fromOrder ||
    point.order === anomalySegment.toOrder;

  const anomalyNote = isAnomalyPoint
    ? `<div class="panel-section">
         <h3>Prototype rule note</h3>
         <p>
           This point forms part of the selected
           ${anomalySegment.fromOrder}\u2192${anomalySegment.toOrder} anomaly segment.
           Detection is evaluated at the segment level, not per point.
         </p>
       </div>`
    : "";

  return `
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

export function renderTrajectoryPanel(metadata) {
  return `
    <h3>Trajectory Overview</h3>
    <p><strong>Route:</strong> ${metadata.routeName}</p>
    <p><strong>Vessel ID:</strong> ${metadata.vesselId}</p>
    <p>${metadata.description}</p>
    <hr />
    <p>
      Points 1-5 establish the expected movement rhythm, while the highlighted
      segment shows the primary anomaly used for visualization.
    </p>
  `;
}

function formatOptionalNumber(value, suffix = "") {
  return value == null ? "N/A" : `${formatNumber(value)}${suffix}`;
}

function formatSignedNumber(value, suffix = "") {
  if (value == null) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
}

function getComparisonStatusLabel(status) {
  switch (status) {
    case MEASUREMENT_COMPARISON_STATUS.COMPARABLE:
      return "Comparable";
    case MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE:
      return "Reported value unavailable";
    case MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE:
      return "Timestamp gap too large";
    default:
      return "Insufficient evidence";
  }
}

export function renderUnreviewedDatasetPanel(dataset, model) {
  const provenance = dataset.provenance ?? {};
  const sourceName = provenance.publisher ?? "Source not documented";
  const intermediary = provenance.intermediary
    ? `<p><strong>Sample path:</strong> ${provenance.intermediary}</p>`
    : "";
  const recordCount = dataset.ingestion?.stats?.outputCount ?? dataset.points.length;
  const segmentCount = model?.segments?.length ?? Math.max(dataset.points.length - 1, 0);

  return `
    <h3>Real AIS Trajectory: Observation Only</h3>
    <p><strong>Dataset:</strong> ${dataset.label}</p>
    <p><strong>Route:</strong> ${dataset.metadata.routeName}</p>
    <p><strong>Vessel ID:</strong> ${dataset.metadata.vesselId}</p>

    <div class="panel-section">
      <p><strong>Review status:</strong> Unreviewed</p>
      <p>
        This trajectory is displayed as real source data. RouteSense has not
        assigned a baseline, threshold interpretation, or validated anomaly.
      </p>
    </div>

    <div class="panel-section">
      <p><strong>Source:</strong> ${sourceName}</p>
      ${intermediary}
      <p><strong>Source date:</strong> ${provenance.sourceDate ?? "N/A"}</p>
      <p><strong>Area:</strong> ${provenance.geographicArea ?? "N/A"}</p>
      <p><strong>Observations:</strong> ${recordCount}</p>
      <p><strong>Computed display segments:</strong> ${segmentCount}</p>
      <p><strong>Timestamp basis:</strong> ${provenance.timestampInterpretation ?? "Not documented"}</p>
      <p><strong>License note:</strong> ${provenance.licenseStatus ?? "Not documented"}</p>
    </div>

    <p class="panel-note">
      AIS-reported SOG and COG remain source measurements. Segment distance,
      estimated speed, bearing, and heading change are calculated separately by
      RouteSense from consecutive positions and timestamps. Select a segment to
      inspect a descriptive measurement comparison.
    </p>
  `;
}

export function renderUnreviewedPointPanel(point, dataset) {
  const reported = point.reported ?? {};
  const status = reported.navigationalStatus?.text ??
    reported.navigationalStatus?.code ?? "N/A";

  return `
    <h3>${point.name}</h3>
    <p><strong>Dataset:</strong> ${dataset.label}</p>
    <p><strong>Time:</strong> ${point.timestamp}</p>
    <p><strong>Coordinates:</strong> ${formatNumber(point.latitude)}, ${formatNumber(point.longitude)}</p>
    <p><strong>Trajectory order:</strong> ${point.order}</p>

    <div class="panel-section">
      <p><strong>AIS-reported measurements</strong></p>
      <p>SOG: ${formatOptionalNumber(reported.sogKnots, " kn")}</p>
      <p>COG: ${formatOptionalNumber(reported.cogDegrees, "°")}</p>
      <p>True heading: ${formatOptionalNumber(reported.headingDegrees, "°")}</p>
      <p>Navigational status: ${status}</p>
    </div>

    <p class="panel-note">
      This is a source observation, not a point-level anomaly label. No anomaly
      validation has been performed for this real AIS sample.
    </p>
  `;
}

export function renderUnreviewedSegmentPanel(segment, dataset) {
  const headingContext = segment.headingChange == null
    ? `<p class="panel-note compact-panel-note">
         Heading change is unavailable for the first segment because there is
         no preceding segment for comparison.
       </p>`
    : "";

  const review = segment.measurementReview ?? {};
  const speedReview = review.speed ?? {};
  const directionReview = review.direction ?? {};
  const reportedPointOrder = review.basis?.pointOrder ?? segment.toOrder;

  return `
    <h3>Real AIS Segment Context: Measurement Review</h3>
    <p><strong>Dataset:</strong> ${dataset.label}</p>
    <p>
      <strong>Selected segment:</strong>
      Vessel Point ${segment.fromOrder} → Vessel Point ${segment.toOrder}
    </p>

    <div class="panel-section">
      <p><strong>AIS-reported measurements at Point ${reportedPointOrder}</strong></p>
      <p>SOG: ${formatOptionalNumber(speedReview.reportedKnots, " kn")}
         (${formatOptionalNumber(speedReview.reportedKmh, " km/h")})</p>
      <p>COG: ${formatOptionalNumber(directionReview.reportedCogDegrees, "°")}</p>
      <p>Observation time: ${review.basis?.timestamp ?? "N/A"}</p>
    </div>

    <div class="panel-section">
      <p><strong>RouteSense-computed movement metrics (interval-derived)</strong></p>
      <p>Distance: ${formatOptionalNumber(segment.distanceKm, " km")}</p>
      <p>Estimated speed: ${formatOptionalNumber(segment.estimatedSpeed, " km/h")}</p>
      <p>Bearing: ${formatOptionalNumber(segment.heading, "°")}</p>
      <p>Heading change: ${formatOptionalNumber(segment.headingChange, "°")}</p>
      <p>Observation interval: ${formatOptionalNumber(review.intervalSeconds, " s")}</p>
      ${headingContext}
    </div>

    <div class="panel-section">
      <p><strong>Descriptive measurement comparison</strong></p>
      <p>Speed status: ${getComparisonStatusLabel(speedReview.status)}</p>
      <p>Speed difference (computed − reported):
         ${formatSignedNumber(speedReview.differenceKmh, " km/h")}</p>
      <p>Direction status: ${getComparisonStatusLabel(directionReview.status)}</p>
      <p>Direction difference (circular):
         ${formatOptionalNumber(directionReview.differenceDegrees, "°")}</p>
    </div>

    <div class="panel-section">
      <p><strong>Interpretation status:</strong> Observation only</p>
      <p>
        The reported values come from the destination observation, while the
        computed values summarize movement across the complete segment. Their
        difference is not an error score, validation result, or anomaly label.
        No baseline, threshold rule, or anomaly conclusion is attached.
      </p>
    </div>
  `;
}

export function renderNormalSegmentPanel(
  segment,
  { thresholds, primaryAnomaly }
) {
  if (!segment) return renderDefaultPanel();

  const speed =
    segment.estimatedSpeed != null
      ? `${formatNumber(segment.estimatedSpeed)} km/h`
      : "N/A";
  const headingAvailable = segment.headingChange != null;
  const headingChange = headingAvailable
    ? `${formatNumber(segment.headingChange)}\u00B0`
    : "N/A";

  const headingComparison = headingAvailable
    ? `${formatNumber(thresholds.headingThreshold)}\u00B0 - Not triggered`
    : `${formatNumber(thresholds.headingThreshold)}\u00B0 - Not triggered (heading change unavailable)`;

  const headingContextNote = headingAvailable
    ? ""
    : `<p class="panel-note compact-panel-note">
         A previous segment is required to calculate heading change. N/A does
         not mean a 0\u00B0 turn.
       </p>`;

  return `
    <h3>Normal Segment Context</h3>

    <p>
      <strong>Selected segment:</strong>
      Vessel Point ${segment.fromOrder} \u2192 Vessel Point ${segment.toOrder}
    </p>

    <div class="panel-section normal-segment-context">
      <p><strong>Review role:</strong> Normal movement context</p>
      <p><strong>Rule status:</strong> Not flagged</p>
      <p>
        This segment contributes to the expected movement context used to
        interpret the primary anomaly.
      </p>
    </div>

    <div class="panel-section">
      <p><strong>Observed segment evidence</strong></p>
      <p>Estimated speed: ${speed}</p>
      <p>Heading change: ${headingChange}</p>
      ${headingContextNote}
    </div>

    <div class="panel-section">
      <p><strong>Threshold comparison</strong></p>
      <p>Speed threshold: ${formatNumber(thresholds.speedThreshold)} km/h -
         Not triggered</p>
      <p>Heading threshold: ${headingComparison}</p>
    </div>

    <div class="primary-anomaly-anchor">
      <p>
        <strong>Primary anomaly:</strong>
        Vessel Point ${primaryAnomaly.fromOrder} \u2192 Vessel Point ${primaryAnomaly.toOrder}
      </p>
      <p>Select that segment to view the complete rule evidence review.</p>
    </div>
  `;
}

function getTriggerSummary(item) {
  const speedTriggered = Boolean(item.triggers?.speed);
  const headingTriggered = Boolean(item.triggers?.heading);

  if (speedTriggered && headingTriggered) return "Speed + heading change";
  if (speedTriggered) return "Speed only";
  if (headingTriggered) return "Heading change only";
  return "No threshold trigger recorded";
}

export function renderRuleEvidenceSegmentPanel(
  reviewItem,
  { thresholds, primaryAnomaly }
) {
  if (!reviewItem) return renderDefaultPanel();

  const isPrimary = reviewItem.isPrimaryAnomaly;
  const roleLabel = isPrimary ? "Primary anomaly" : "Supporting evidence";
  const speed =
    reviewItem.metrics?.estimatedSpeed != null
      ? `${formatNumber(reviewItem.metrics.estimatedSpeed)} km/h`
      : "N/A";
  const headingChange =
    reviewItem.metrics?.headingChange != null
      ? `${formatNumber(reviewItem.metrics.headingChange)}\u00B0`
      : "N/A";

  const reasonsMarkup = Array.isArray(reviewItem.reasons)
    ? reviewItem.reasons.map((reason) => `<li>${reason}</li>`).join("")
    : "";

  return `
    <h3>${isPrimary ? "Primary RouteSense Anomaly" : "Supporting Rule Evidence"}</h3>

    <p>
      <strong>Selected segment:</strong>
      Vessel Point ${reviewItem.fromOrder} \u2192 Vessel Point ${reviewItem.toOrder}
    </p>

    <div class="panel-section rule-evidence-item--${reviewItem.role}">
      <p><strong>Relation:</strong> ${reviewItem.title}</p>
      <p>${reviewItem.description}</p>
      <p><strong>Triggered by:</strong> ${getTriggerSummary(reviewItem)}</p>
    </div>

    <div class="panel-section">
      <p><strong>Observed segment evidence</strong></p>
      <p>Estimated speed: ${speed}</p>
      <p>Heading change: ${headingChange}</p>
    </div>

    <div class="panel-section">
      <p><strong>Threshold comparison</strong></p>
      <p>Speed threshold: ${formatNumber(thresholds.speedThreshold)} km/h -
         ${reviewItem.triggers?.speed ? "Triggered" : "Not triggered"}</p>
      <p>Heading threshold: ${formatNumber(thresholds.headingThreshold)}\u00B0 -
         ${reviewItem.triggers?.heading ? "Triggered" : "Not triggered"}</p>
      <ul class="rule-evidence-reasons">${reasonsMarkup}</ul>
    </div>

    <div class="primary-anomaly-anchor">
      <p>
        <strong>Primary anomaly:</strong>
        Vessel Point ${primaryAnomaly.fromOrder} \u2192 Vessel Point ${primaryAnomaly.toOrder}
      </p>
      <p>Select that segment to view the complete rule evidence review.</p>
    </div>
  `;
}

export function renderAnomalyPanel(model) {
  const {
    anomalyEvidence,
    anomalyDeviation,
    baseline,
    thresholds,
    ruleEvidenceItems = [],
  } = model;

  if (!anomalyEvidence) return renderDefaultPanel();

  const detection = anomalyEvidence.detection;
  const speedDeviation =
    anomalyDeviation.speedPercent != null
      ? `${anomalyDeviation.speedPercent >= 0 ? "+" : ""}${formatNumber(anomalyDeviation.speedPercent)}%`
      : "N/A";
  const headingDeviation =
    anomalyDeviation.headingChangeDifference != null
      ? `${anomalyDeviation.headingChangeDifference >= 0 ? "+" : ""}${formatNumber(anomalyDeviation.headingChangeDifference)}\u00B0`
      : "N/A";

  return `
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
      <p>Speed threshold: ${formatNumber(thresholds.speedThreshold)} km/h -
         ${detection.speedFlagged ? "Triggered" : "Not triggered"}</p>
      <p>Heading threshold: ${thresholds.headingThreshold}\u00B0 -
         ${detection.headingFlagged ? "Triggered" : "Not triggered"}</p>
      <p><strong>Rule status:</strong> ${
        detection.flagged
          ? "This segment is flagged by the threshold-based prototype rule."
          : "This segment is the narrative anomaly but is not flagged by the simple rule."
      }</p>
    </div>

    ${renderRuleEvidenceReview(ruleEvidenceItems)}

    <p class="panel-note">
      This is a simple threshold-based detection starter. It is not
      production-ready anomaly detection and has not been validated on real AIS data.
    </p>
  `;
}

export function renderDirectionPanel(attributes) {
  return `
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

// ============================================================
// GROUP SELECTION (drag-box experiment)
//
// The panel changes shape with selection size instead of forcing every
// selection through one aggregate layout. One and two-point selections
// delegate to the existing single-item renderers — a "group of one" has no
// extra information to show, and min/mean/max over a single segment is noise.
// ============================================================

function pluralize(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatDurationHours(hours) {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "N/A";

  const totalMinutes = Math.round(hours * 60);

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${wholeHours} h` : `${wholeHours} h ${minutes} min`;
}

// Ranges collapse when the two ends round to the same displayed value: showing
// "6.58 – 6.58" implies a spread the reader cannot see.
function formatPlainRange(rangeValue, suffix = "") {
  if (rangeValue == null) return "N/A";

  const min = formatNumber(rangeValue.min);
  const max = formatNumber(rangeValue.max);

  return min === max ? `${min}${suffix}` : `${min} – ${max}${suffix}`;
}

function formatSignedRange(rangeValue, suffix = "") {
  if (rangeValue == null) return "N/A";

  const min = formatSignedNumber(rangeValue.min);
  const max = formatSignedNumber(rangeValue.max);

  return min === max ? `${min}${suffix}` : `${min} to ${max}${suffix}`;
}

function formatStatusCounts(counts = {}) {
  const entries = Object.entries(counts);

  if (entries.length === 0) return "N/A";

  return entries
    .map(([status, count]) => `${count} ${getComparisonStatusLabel(status).toLowerCase()}`)
    .join(", ");
}

function renderSelectionHeader(summary) {
  const runsNote = summary.isContiguous
    ? ""
    : ` · ${pluralize(summary.runs.length, "run")}, non-contiguous`;

  return `
    <div class="group-selection__header">
      <h3>Group Selection</h3>
      <p class="group-selection__counts">
        ${pluralize(summary.pointCount, "point")} ·
        ${pluralize(summary.interiorSegments.length, "segment")}${runsNote}
      </p>
      <p class="group-selection__runs"><strong>Points:</strong> ${summary.runsLabel}</p>
    </div>
  `;
}

function renderBoundarySegments(summary) {
  if (summary.boundarySegments.length === 0) return "";

  const labels = summary.boundarySegments
    .map((segment) => `${segment.fromOrder} → ${segment.toOrder}`)
    .join(", ");

  return `
    <p class="panel-note compact-panel-note">
      <strong>Boundary segments (excluded):</strong> ${labels}.
      A segment is included only when both of its endpoints are selected.
    </p>
  `;
}

function renderMovementAggregate(summary) {
  const movement = summary.movement;
  const coverage = movement.headingChangeCoverage;

  const spanMarkup = summary.span
    ? `<p>Span: Point ${summary.span.start.order} (${summary.span.start.timestamp})
         → Point ${summary.span.end.order} (${summary.span.end.timestamp})</p>`
    : "";

  const contiguityNote = summary.isContiguous
    ? ""
    : `<p class="panel-note compact-panel-note">
         This selection is not contiguous, so totals cover only the selected
         segments and not the full span between first and last point.
       </p>`;

  return `
    <div class="panel-section">
      <p><strong>Aggregate movement (RouteSense-computed)</strong></p>
      ${spanMarkup}
      <p>Covered duration: ${formatDurationHours(movement.totalDurationHours)}</p>
      <p>Total distance: ${formatOptionalNumber(movement.totalDistanceKm, " km")}</p>
      <p>Overall estimated speed:
         ${formatOptionalNumber(movement.overallSpeedKmh, " km/h")}
         <span class="group-selection__formula">(total distance ÷ total covered time)</span></p>
      <p>Per-segment speed range: ${formatPlainRange(movement.speedRangeKmh, " km/h")}</p>
      <p>Heading change: available for ${coverage.available} of ${pluralize(coverage.total, "segment")}</p>
      ${contiguityNote}
      <p class="panel-note compact-panel-note">
        Heading change is measured against the preceding segment, which may lie
        outside this selection.
      </p>
    </div>
  `;
}

function describeAnomalyContainmentText(primaryAnomaly) {
  switch (primaryAnomaly.status) {
    case ANOMALY_CONTAINMENT.FULL:
      return `Primary anomaly ${primaryAnomaly.label}: fully in selection`;
    case ANOMALY_CONTAINMENT.PARTIAL:
      return `Primary anomaly ${primaryAnomaly.label}: partially in selection ` +
        `(Point ${primaryAnomaly.selectedEndpoints.join(", ")} only)`;
    case ANOMALY_CONTAINMENT.ABSENT:
      return `Primary anomaly ${primaryAnomaly.label}: not in selection`;
    default:
      return "";
  }
}

function describeBaselineOverlapText(baseline) {
  switch (baseline.status) {
    case BASELINE_OVERLAP.COMPLETE:
      return `Baseline range ${baseline.label}: fully covered by this selection, ` +
        `so these aggregates describe the baseline itself`;
    case BASELINE_OVERLAP.PARTIAL:
      return `Baseline range ${baseline.label}: ${baseline.selectedInRange} of ` +
        `${baseline.rangeSize} baseline points selected`;
    case BASELINE_OVERLAP.NONE:
      return `Baseline range ${baseline.label}: not overlapping`;
    default:
      return "";
  }
}

function getRuleItemTriggerLabel(item) {
  if (!item.flagged) return "Not flagged";
  if (item.triggers.speed && item.triggers.heading) return "Flagged: speed + heading";
  if (item.triggers.speed) return "Flagged: speed";
  if (item.triggers.heading) return "Flagged: heading";
  return "Flagged";
}

function renderRuleComparisonItems(items) {
  if (items.length === 0) return "";

  return `
    <ol class="group-comparison-list">
      ${items
        .map((item) => {
          const roleLabel = item.isPrimaryAnomaly
            ? "Narrative anomaly"
            : item.flagged
              ? "Rule only"
              : "Not flagged";

          return `
            <li
              class="group-comparison-item group-comparison-item--${
                item.isPrimaryAnomaly ? "narrative" : item.flagged ? "rule-only" : "quiet"
              }"
              data-segment-key="${item.fromOrder}-${item.toOrder}"
            >
              <button
                type="button"
                class="group-comparison-item__label"
                data-select-segment
                data-from-order="${item.fromOrder}"
                data-to-order="${item.toOrder}"
              >${item.label}</button>
              <span class="group-comparison-item__role">${roleLabel}</span>
              <span class="group-comparison-item__trigger">${getRuleItemTriggerLabel(item)}</span>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderRuleNarrativeComparison(summary) {
  const rule = summary.rule;

  if (rule == null) return "";

  const mismatchNote = rule.hasRuleNarrativeMismatch
    ? `<p class="group-comparison__mismatch">
         The prototype rule flags more segments than the RouteSense narrative
         treats as anomalous. This over-flagging is a documented finding of the
         project, not a defect being corrected here.
       </p>`
    : "";

  const anomalyText = describeAnomalyContainmentText(rule.primaryAnomaly);
  const baselineText = describeBaselineOverlapText(rule.baseline);

  return `
    <div class="panel-section group-comparison">
      <div class="group-comparison__header">
        <h3>Rule vs. narrative</h3>
        <p class="group-comparison__summary">
          ${rule.flaggedCount} of ${pluralize(rule.segmentCount, "segment")} flagged ·
          ${rule.narrativeAnomalyCount} narrative anomaly
        </p>
      </div>
      ${mismatchNote}
      ${anomalyText ? `<p>${anomalyText}</p>` : ""}
      ${baselineText ? `<p>${baselineText}</p>` : ""}
      ${renderRuleComparisonItems(rule.items)}
    </div>
  `;
}

// A metric that was never comparable states why instead of showing a number.
function formatMetricDifference(metric, suffix, { signed = false } = {}) {
  if (metric?.status !== MEASUREMENT_COMPARISON_STATUS.COMPARABLE) {
    return getComparisonStatusLabel(metric?.status).toLowerCase();
  }

  return signed
    ? formatSignedNumber(metric.difference, suffix)
    : `${formatNumber(metric.difference)}${suffix}`;
}

// The real-AIS counterpart of the rule comparison list. Same rows, same
// drill-down links, descriptive content only — no flagged/normal verdict,
// because this dataset has no rule that could produce one.
function renderMeasurementComparisonItems(items = []) {
  if (items.length === 0) return "";

  return `
    <ol class="group-comparison-list">
      ${items
        .map(
          (item) => `
            <li
              class="group-comparison-item group-comparison-item--quiet"
              data-segment-key="${item.fromOrder}-${item.toOrder}"
            >
              <button
                type="button"
                class="group-comparison-item__label"
                data-select-segment
                data-from-order="${item.fromOrder}"
                data-to-order="${item.toOrder}"
              >${item.label}</button>
              <span class="group-comparison-item__trigger">
                Speed ${formatMetricDifference(item.speed, " km/h", { signed: true })}
                · Direction ${formatMetricDifference(item.direction, "°")}
              </span>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderMeasurementComparisonAggregate(summary) {
  const measurement = summary.measurement;

  if (measurement == null) {
    return `
      <p class="panel-note compact-panel-note">
        No complete segment is inside this selection, so there is no
        measurement comparison to describe.
      </p>
    `;
  }

  return `
    <div class="panel-section">
      <p><strong>Descriptive measurement comparison</strong>
         (${pluralize(measurement.segmentCount, "segment")})</p>
      <p>Speed: ${formatStatusCounts(measurement.speedStatusCounts)}</p>
      <p>Direction: ${formatStatusCounts(measurement.directionStatusCounts)}</p>
      <p>Speed difference (computed − reported):
         ${formatSignedRange(measurement.speedDifferenceRangeKmh, " km/h")}</p>
      <p>Direction difference (circular):
         ${formatPlainRange(measurement.directionDifferenceRangeDegrees, "°")}</p>
      ${renderMeasurementComparisonItems(measurement.items)}
      <p class="panel-note compact-panel-note">
        Per-segment values repeat the same two differences: speed as
        computed − reported, direction as a circular difference. These are not
        error scores, validation results, or anomaly labels, and no baseline or
        threshold rule is attached to this dataset.
      </p>
    </div>
  `;
}

/**
 * The single answer to "which panel does this segment get?".
 *
 * Both entry points call it — clicking a segment on the map, and a two-point
 * group selection, which carries exactly the information of one clicked
 * segment. Keeping the decision in one place is the point: it previously lived
 * in two, and the copies drifted, so selecting points 6-7 showed a shorter
 * panel than clicking segment 6-7.
 */
export function renderSegmentPanel(segment, { model, dataset = null } = {}) {
  if (!segment) return null;

  if (model?.thresholds == null) {
    return renderUnreviewedSegmentPanel(segment, dataset);
  }

  const evidenceItem = (model.ruleEvidenceItems ?? []).find(
    (item) =>
      item.fromOrder === segment.fromOrder && item.toOrder === segment.toOrder
  );

  // The primary anomaly gets the full detection panel, baseline comparison and
  // rule evidence review included. It is the trajectory's headline finding, so
  // it is never reduced to a per-segment summary.
  if (evidenceItem?.isPrimaryAnomaly) {
    return renderAnomalyPanel(model);
  }

  const context = {
    thresholds: model.thresholds,
    primaryAnomaly: model.anomalyEvidence
  };

  return evidenceItem
    ? renderRuleEvidenceSegmentPanel(evidenceItem, context)
    : renderNormalSegmentPanel(segment, context);
}

export function renderEmptySelectionPanel() {
  return `
    <h3>Group Selection</h3>
    <p>No vessel points fell inside the drag box.</p>
    <p class="panel-note">
      Shift-drag across the map to select a stretch of the trajectory, or click
      the empty map to return to the dataset overview.
    </p>
  `;
}

export function renderGroupSelectionPanel(
  summary,
  { model = {}, dataset = null, anomalySegment = null } = {}
) {
  if (summary == null || summary.tier === SELECTION_TIER.EMPTY) {
    return renderEmptySelectionPanel();
  }

  const header = renderSelectionHeader(summary);
  const hasReviewedAnalysis = summary.rule != null;

  if (summary.tier === SELECTION_TIER.SINGLE_POINT) {
    const point = summary.points[0];

    const pointPanel = hasReviewedAnalysis && anomalySegment
      ? renderPointPanel(point, anomalySegment)
      : renderUnreviewedPointPanel(point, dataset ?? {});

    return `${header}${pointPanel}${renderBoundarySegments(summary)}`;
  }

  if (summary.tier === SELECTION_TIER.SINGLE_SEGMENT) {
    const segmentPanel = renderSegmentPanel(summary.interiorSegments[0], {
      model,
      dataset
    });

    return `${header}${segmentPanel}${renderBoundarySegments(summary)}`;
  }

  const comparison = hasReviewedAnalysis
    ? renderRuleNarrativeComparison(summary)
    : renderMeasurementComparisonAggregate(summary);

  const emptyInteriorNote = summary.interiorSegments.length === 0
    ? `<p class="panel-note">
         The selected points are not consecutive, so no complete segment lies
         inside the selection.
       </p>`
    : renderMovementAggregate(summary);

  return `
    ${header}
    ${emptyInteriorNote}
    ${summary.interiorSegments.length > 0 ? comparison : ""}
    ${renderBoundarySegments(summary)}
    <p class="panel-note">Click the empty map to clear this selection.</p>
  `;
}

export function renderRuleEvidenceReview(reviewItems = []) {
  if (!Array.isArray(reviewItems) || reviewItems.length === 0) {
    return "";
  }

  const primaryCount = reviewItems.filter(
    (item) => item.role === "primary-anomaly"
  ).length;
  const supportingCount = reviewItems.length - primaryCount;

  const evidenceItemsMarkup = reviewItems
    .map((item) => {
      const isPrimary = item.role === "primary-anomaly";
      const priorityLabel = isPrimary
        ? "Primary anomaly"
        : "Supporting evidence";

      const triggerSummary = getTriggerSummary(item);

      const reasonsMarkup =
        Array.isArray(item.reasons) && item.reasons.length > 0
          ? `
            <ul class="rule-evidence-reasons">
              ${item.reasons
                .map((reason) => `<li>${reason}</li>`)
                .join("")}
            </ul>
          `
          : `
            <p class="panel-note">
              No additional threshold explanation is available.
            </p>
          `;

      const speed =
        item.metrics?.estimatedSpeed != null
          ? `${formatNumber(item.metrics.estimatedSpeed)} km/h`
          : "N/A";
      const headingChange =
        item.metrics?.headingChange != null
          ? `${formatNumber(item.metrics.headingChange)}\u00B0`
          : "N/A";

      return `
        <li
          class="rule-evidence-item rule-evidence-item--${item.role}"
          data-segment-key="${item.segmentKey}"
          data-evidence-priority="${isPrimary ? "primary" : "supporting"}"
        >
          <div class="rule-evidence-item__header">
            <strong class="rule-evidence-item__segment">${item.label}</strong>
            <span class="rule-evidence-badge rule-evidence-badge--${
              isPrimary ? "primary" : "supporting"
            }">
              ${priorityLabel}
            </span>
          </div>

          <p class="rule-evidence-item__relation">${item.title}</p>
          <p class="rule-evidence-item__description">${item.description}</p>

          <p class="rule-evidence-item__status">
            <strong>Review role:</strong> ${priorityLabel}<br />
            <strong>Triggered by:</strong> ${triggerSummary}
          </p>

          <dl class="rule-evidence-metrics">
            <div>
              <dt>Estimated speed</dt>
              <dd>${speed}</dd>
            </div>
            <div>
              <dt>Heading change</dt>
              <dd>${headingChange}</dd>
            </div>
          </dl>

          <p class="rule-evidence-reasons__heading">
            <strong>Threshold evidence</strong>
          </p>
          ${reasonsMarkup}
        </li>
      `;
    })
    .join("");

  return `
    <div class="panel-section rule-evidence-review">
      <div class="rule-evidence-review__header">
        <h3>Rule Evidence Review</h3>
        <p class="rule-evidence-review__summary">
          ${primaryCount} primary anomaly · ${supportingCount} supporting evidence items
        </p>
      </div>

      <p class="rule-evidence-review__introduction">
        The threshold rule identifies segments for review, but it does not
        redefine the RouteSense narrative. Vessel Point 6 \u2192 Vessel Point 7
        remains the primary anomaly. Adjacent flagged segments are supporting
        evidence and do not replace the main anomaly highlight.
      </p>

      <ol class="rule-evidence-list">
        ${evidenceItemsMarkup}
      </ol>
    </div>
  `;
}
