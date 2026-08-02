import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrajectoryDisplayModel,
  buildTrajectoryModel
} from "../src/analysis.js";
import { samplePoints } from "../src/data.js";
import {
  ANOMALY_SEGMENT,
  NORMAL_BASELINE_RANGE,
  THRESHOLD_RULE
} from "../src/config.js";
import {
  gothenburgRealAisDataset,
  syntheticPhase8Dataset
} from "../src/datasets.js";
import { buildSelectionSummary } from "../src/selection.js";
import {
  MAP_HELP_BODY_ID,
  PANEL_CONTENT_ID,
  renderAnomalyPanel,
  renderDatasetSwitcher,
  renderGroupSelectionPanel,
  renderMapHelp,
  renderPanelToggle,
  renderRuleEvidenceReview,
  renderRuleEvidenceSegmentPanel,
  renderNormalSegmentPanel
} from "../src/panels.js";

const model = buildTrajectoryModel(samplePoints, {
  anomalySegment: ANOMALY_SEGMENT,
  baselineRange: NORMAL_BASELINE_RANGE,
  thresholdRule: THRESHOLD_RULE
});

test("anomaly panel renders the three rule evidence review items", () => {
  const html = renderAnomalyPanel(model);

  assert.match(html, /Rule Evidence Review/);
  assert.match(html, /Point 5 → Point 6/);
  assert.match(html, /Point 6 → Point 7/);
  assert.match(html, /Point 7 → Point 8/);
  assert.match(html, /Primary RouteSense anomaly/);
  assert.match(html, /supporting\s+evidence and do not replace the main anomaly highlight/);
});

test("rule evidence renderer stays empty when there are no review items", () => {
  assert.equal(renderRuleEvidenceReview([]), "");
});

test("rule evidence review exposes a clear primary-versus-supporting hierarchy", () => {
  const html = renderRuleEvidenceReview(model.ruleEvidenceItems);

  assert.match(html, /1 primary anomaly · 2 supporting evidence items/);
  assert.match(html, /rule-evidence-badge--primary/);
  assert.match(html, />\s*Primary anomaly\s*</);
  assert.match(html, /rule-evidence-badge--supporting/);
  assert.match(html, />\s*Supporting evidence\s*</);
  assert.match(html, /data-evidence-priority="primary"/);
  assert.match(html, /data-evidence-priority="supporting"/);
});

test("rule evidence review keeps chronological segment order", () => {
  const html = renderRuleEvidenceReview(model.ruleEvidenceItems);

  const preIndex = html.indexOf("Point 5 → Point 6");
  const primaryIndex = html.indexOf("Point 6 → Point 7");
  const postIndex = html.indexOf("Point 7 → Point 8");

  assert.ok(preIndex < primaryIndex);
  assert.ok(primaryIndex < postIndex);
});



test("rule evidence review states supporting roles and heading-only trigger explicitly", () => {
  const html = renderRuleEvidenceReview(model.ruleEvidenceItems);

  assert.equal((html.match(/<strong>Review role:<\/strong> Supporting evidence/g) ?? []).length, 2);
  assert.equal((html.match(/<strong>Triggered by:<\/strong> Speed \+ heading change/g) ?? []).length, 2);
  assert.equal((html.match(/<strong>Triggered by:<\/strong> Heading change only/g) ?? []).length, 1);
});


test("supporting evidence segment panel focuses Point 5 to Point 6 without redefining the primary anomaly", () => {
  const reviewItem = model.ruleEvidenceItems.find(
    (item) => item.fromOrder === 5 && item.toOrder === 6
  );

  const html = renderRuleEvidenceSegmentPanel(reviewItem, {
    thresholds: model.thresholds,
    primaryAnomaly: model.anomalyEvidence
  });

  assert.match(html, /Supporting Rule Evidence/);
  assert.match(html, /Vessel Point 5 → Vessel Point 6/);
  assert.match(html, /Relation:<\/strong> Pre-anomaly rule evidence/);
  assert.match(html, /Triggered by:<\/strong> Speed \+ heading change/);
  assert.match(html, /Primary anomaly:<\/strong>[\s\S]*Vessel Point 6 → Vessel Point 7/);
  assert.match(html, /Select that segment to view the complete rule evidence review/);
  assert.doesNotMatch(html, /remains the primary RouteSense anomaly and the only primary map highlight/);
});

test("supporting evidence segment panel states that Point 7 to Point 8 is heading-only", () => {
  const reviewItem = model.ruleEvidenceItems.find(
    (item) => item.fromOrder === 7 && item.toOrder === 8
  );

  const html = renderRuleEvidenceSegmentPanel(reviewItem, {
    thresholds: model.thresholds,
    primaryAnomaly: model.anomalyEvidence
  });

  assert.match(html, /Vessel Point 7 → Vessel Point 8/);
  assert.match(html, /Triggered by:<\/strong> Heading change only/);
  assert.match(html, /Speed threshold:[\s\S]*Not triggered/);
  assert.match(html, /Heading threshold:[\s\S]*Triggered/);
});


test("normal segment panel gives Point 3 to Point 4 a segment-specific not-flagged response", () => {
  const segment = model.segments.find(
    (item) => item.fromOrder === 3 && item.toOrder === 4
  );

  const html = renderNormalSegmentPanel(segment, {
    thresholds: model.thresholds,
    primaryAnomaly: model.anomalyEvidence
  });

  assert.match(html, /Normal Segment Context/);
  assert.match(html, /Vessel Point 3 → Vessel Point 4/);
  assert.match(html, /Review role:<\/strong> Normal movement context/);
  assert.match(html, /Rule status:<\/strong> Not flagged/);
  assert.match(html, /Estimated speed:[\s\S]*km\/h/);
  assert.match(html, /Heading change:[\s\S]*0\.00°/);
  assert.match(html, /Speed threshold:[\s\S]*Not triggered/);
  assert.match(html, /Heading threshold:[\s\S]*Not triggered/);
});

test("first normal segment shows heading change as unavailable rather than zero", () => {
  const segment = model.segments.find(
    (item) => item.fromOrder === 1 && item.toOrder === 2
  );

  const html = renderNormalSegmentPanel(segment, {
    thresholds: model.thresholds,
    primaryAnomaly: model.anomalyEvidence
  });

  assert.match(html, /Vessel Point 1 → Vessel Point 2/);
  assert.match(html, /Heading change: N\/A/);
  assert.match(html, /A previous segment is required to calculate heading change/);
  assert.match(html, /N\/A does[\s\S]*not mean a 0° turn/);
  assert.match(html, /heading change unavailable/);
});

test("dataset switcher marks the active dataset and renders every option with its badge", () => {
  const html = renderDatasetSwitcher(
    [
      {
        id: "synthetic-phase8",
        label: "Phase 8 synthetic fixture",
        kind: "synthetic",
        reviewStatus: "fixture",
        badgeLabel: "Synthetic fixture",
        isActive: true
      },
      {
        id: "real-ais-gothenburg-2017",
        label: "Gothenburg real AIS sample (2017)",
        kind: "real-ais",
        reviewStatus: "unreviewed",
        badgeLabel: "Real AIS — unreviewed",
        isActive: false
      }
    ],
    "Danish Maritime Authority · Near Gothenburg, Sweden · 2017"
  );

  assert.match(html, /data-dataset-id="synthetic-phase8"/);
  assert.match(html, /data-dataset-id="real-ais-gothenburg-2017"/);
  assert.match(html, /Phase 8 synthetic fixture/);
  assert.match(html, /Gothenburg real AIS sample \(2017\)/);
  assert.match(html, /Synthetic fixture/);
  assert.match(html, /Real AIS — unreviewed/);
  assert.match(html, /dataset-switcher__badge--synthetic/);
  assert.match(html, /dataset-switcher__badge--real-ais/);
  assert.equal((html.match(/dataset-switcher__option--active/g) ?? []).length, 1);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
  assert.match(html, /Danish Maritime Authority · Near Gothenburg, Sweden · 2017/);
  assert.match(html, /Switching datasets reloads the page/);
});

test("dataset switcher renders nothing without options", () => {
  assert.equal(renderDatasetSwitcher([]), "");
  assert.equal(renderDatasetSwitcher(undefined), "");
});

// --- Map help and panel collapse -------------------------------------------

test("map help lists every gesture, including shift-drag", () => {
  const html = renderMapHelp();

  assert.match(html, /<kbd>Shift<\/kbd> \+ drag/);
  assert.match(html, /Select a stretch of the trajectory/);
  assert.match(html, /Click a point/);
  assert.match(html, /Click a segment/);
  assert.match(html, /Click empty water/);
});

test("collapsed map help keeps its toggle and drops the instruction body", () => {
  const collapsed = renderMapHelp({ isExpanded: false });

  assert.match(collapsed, /How to use this map/);
  assert.match(collapsed, /aria-expanded="false"/);
  assert.doesNotMatch(collapsed, new RegExp(`id="${MAP_HELP_BODY_ID}"`));
  assert.doesNotMatch(collapsed, /Click a point/);
});

test("map help starts expanded because shift-drag is otherwise undiscoverable", () => {
  const html = renderMapHelp();

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, new RegExp(`id="${MAP_HELP_BODY_ID}"`));
});

test("panel toggle states its action and points at the region it controls", () => {
  const expanded = renderPanelToggle(true);
  const collapsed = renderPanelToggle(false);

  assert.match(expanded, /Collapse/);
  assert.match(expanded, /aria-expanded="true"/);
  assert.match(collapsed, /Expand for more/);
  assert.match(collapsed, /aria-expanded="false"/);

  [expanded, collapsed].forEach((html) => {
    assert.match(html, new RegExp(`aria-controls="${PANEL_CONTENT_ID}"`));
    assert.match(html, /data-panel-toggle/);
  });
});

// --- Group selection (drag-box experiment) ---------------------------------

const groupSummaryFor = (orders) =>
  buildSelectionSummary(
    samplePoints.filter((point) => orders.includes(point.order)),
    model,
    { primaryAnomaly: ANOMALY_SEGMENT, baselineRange: NORMAL_BASELINE_RANGE }
  );

const renderGroupFor = (orders) =>
  renderGroupSelectionPanel(groupSummaryFor(orders), {
    model,
    dataset: syntheticPhase8Dataset,
    anomalySegment: ANOMALY_SEGMENT
  });

test("an empty drag box explains itself instead of rendering blank", () => {
  const html = renderGroupFor([]);

  assert.match(html, /No vessel points fell inside the drag box/);
});

test("a two-point selection reuses the existing segment panel rather than aggregating", () => {
  const html = renderGroupFor([3, 4]);

  assert.match(html, /Group Selection/);
  assert.match(html, /2 points ·\s*1 segment/);
  assert.match(html, /Normal Segment Context/);
  assert.match(html, /Vessel Point 3 → Vessel Point 4/);
  // A single segment has no meaningful spread to report.
  assert.doesNotMatch(html, /Per-segment speed range/);
});

test("a two-point selection names the excluded boundary segments", () => {
  const html = renderGroupFor([3, 4]);

  assert.match(html, /Boundary segments \(excluded\):<\/strong> 2 → 3, 4 → 5/);
  assert.match(html, /included only when both of its endpoints are selected/);
});

test("a points 5-8 selection states the rule-versus-narrative mismatch", () => {
  const html = renderGroupFor([5, 6, 7, 8]);

  assert.match(html, /Rule vs\. narrative/);
  assert.match(html, /3 of 3 segments flagged/);
  assert.match(html, /1 narrative anomaly/);
  assert.match(html, /flags more segments than the RouteSense narrative/);
  assert.match(html, /documented finding of the[\s\S]*project, not a defect/);
  assert.match(html, /Primary anomaly 6 → 7: fully in selection/);
});

test("every segment row in a group panel is a button carrying its endpoints", () => {
  const html = renderGroupFor([5, 6, 7, 8]);

  // One row per interior segment, each drillable.
  assert.equal((html.match(/data-select-segment/g) ?? []).length, 3);

  [[5, 6], [6, 7], [7, 8]].forEach(([fromOrder, toOrder]) => {
    assert.match(
      html,
      new RegExp(
        `data-select-segment[\\s\\S]*?data-from-order="${fromOrder}"[\\s\\S]*?data-to-order="${toOrder}"`
      )
    );
  });

  // A button, not an anchor: drilling in changes the selection, it does not
  // navigate anywhere.
  assert.doesNotMatch(html, /<a\s/);
  assert.match(html, /<button\s+type="button"\s+class="group-comparison-item__label"/);
});

test("a two-point selection has no segment rows to drill into", () => {
  const html = renderGroupFor([3, 4]);

  assert.doesNotMatch(html, /data-select-segment/);
});

test("a clipped anomaly is described as partial, never as absent", () => {
  const html = renderGroupFor([4, 5, 6]);

  assert.match(html, /Primary anomaly 6 → 7: partially in selection \(Point 6 only\)/);
  assert.doesNotMatch(html, /Primary anomaly 6 → 7: not in selection/);
});

test("aggregate movement reports heading coverage and the weighting formula", () => {
  const html = renderGroupFor([1, 2, 3]);

  assert.match(html, /Overall estimated speed:/);
  assert.match(html, /total distance ÷ total covered time/);
  assert.match(html, /Heading change: available for 1 of 2 segments/);
  assert.match(html, /measured against the preceding segment, which may lie[\s\S]*outside this selection/);
});

test("selecting the whole baseline range says so instead of presenting a new average", () => {
  const html = renderGroupFor([1, 2, 3, 4, 5]);

  assert.match(html, /Baseline range 1–5: fully covered by this selection/);
  assert.match(html, /these aggregates describe the baseline itself/);
});

test("a non-contiguous selection reports runs and withholds segment aggregates", () => {
  const html = renderGroupFor([2, 7]);

  assert.match(html, /2 runs, non-contiguous/);
  assert.match(html, /<strong>Points:<\/strong> 2, 7/);
  assert.match(html, /not consecutive, so no complete segment lies[\s\S]*inside the selection/);
  assert.doesNotMatch(html, /Rule vs\. narrative/);
});

test("the real AIS group panel stays descriptive and carries no detection language", () => {
  const displayModel = buildTrajectoryDisplayModel(
    gothenburgRealAisDataset.points,
    { measurementReviewProfile: gothenburgRealAisDataset.measurementReviewProfile }
  );

  const summary = buildSelectionSummary(
    gothenburgRealAisDataset.points.slice(0, 4),
    displayModel,
    { primaryAnomaly: null, baselineRange: null }
  );

  const html = renderGroupSelectionPanel(summary, {
    model: displayModel,
    dataset: gothenburgRealAisDataset
  });

  assert.match(html, /Descriptive measurement comparison/);
  assert.match(html, /Speed difference \(computed − reported\)/);
  assert.match(html, /not[\s\S]*error scores, validation results, or anomaly labels/);
  assert.doesNotMatch(html, /flagged/i);
  assert.doesNotMatch(html, /threshold rule is attached[\s\S]*?Triggered/i);
  assert.doesNotMatch(html, /Rule vs\. narrative/);
  assert.doesNotMatch(html, /Primary anomaly/);
  assert.doesNotMatch(html, /Baseline range/);
});
