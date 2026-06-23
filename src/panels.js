// Info-panel renderers. Every function here is a pure (data) -> HTML-string
// builder; main.js owns the DOM element and assigns innerHTML. Keeping these
// free of DOM/ArcGIS dependencies makes panel content testable and keeps a
// clean boundary between the data model and its presentation.

import { formatNumber } from "./geo.js";

const legendMarkup = `
  <ul>
    <li><span class="legend-line normal-line"></span> Normal movement context</li>
    <li><span class="legend-line anomaly-line"></span> Anomalous deviation</li>
  </ul>
`;

export function renderDefaultPanel() {
  return `
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

export function renderRuleEvidenceReview(reviewItems = []) {
  if (!Array.isArray(reviewItems) || reviewItems.length === 0) {
    return "";
  }

  const evidenceItemsMarkup = reviewItems
    .map((item) => {
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
        >
          <p class="rule-evidence-item__heading">
            <strong>${item.label}:</strong>
            ${item.title}
          </p>
          <p>${item.description}</p>
          <p class="rule-evidence-metrics">
            <strong>Observed:</strong>
            ${speed}; heading change ${headingChange}
          </p>
          <p><strong>Why the rule flagged this segment:</strong></p>
          ${reasonsMarkup}
        </li>
      `;
    })
    .join("");

  return `
    <div class="panel-section rule-evidence-review">
      <h3>Rule Evidence Review</h3>

      <p>
        The prototype threshold rule identifies segments for review.
        Vessel Point 6 \u2192 Vessel Point 7 remains the primary
        RouteSense anomaly. Other flagged segments are supporting
        evidence and do not replace the main anomaly highlight.
      </p>

      <ol class="rule-evidence-list">
        ${evidenceItemsMarkup}
      </ol>
    </div>
  `;
}