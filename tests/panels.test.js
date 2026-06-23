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
