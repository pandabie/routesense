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
  renderRuleEvidenceReview
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

