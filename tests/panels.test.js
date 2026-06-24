import test from "node:test";
import assert from "node:assert/strict";

import { buildTrajectoryModel } from "../src/analysis.js";
import { samplePoints } from "../src/data.js";
import {
  ANOMALY_SEGMENT,
  NORMAL_BASELINE_RANGE,
  THRESHOLD_RULE
} from "../src/config.js";
import {
  renderAnomalyPanel,
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
