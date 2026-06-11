// Unit / regression tests for the pure analysis pipeline.
// Run with: node --test
// (requires "type": "module" in package.json, which Vite projects already have)
//
// The "over-flagging" test deliberately pins the research finding documented
// in the README: the Phase 7 threshold rule flags three segments, not only
// the narrative anomaly. If Phase 8 rule tuning changes that behaviour,
// this test fails and the README finding must be updated alongside it.

import test from "node:test";
import assert from "node:assert/strict";

import { buildTrajectoryModel, buildSegments, computeBaseline, applyDetection } from "../src/analysis.js";
import { getHeadingChange, getDistanceKm, average } from "../src/geo.js";
import { samplePoints } from "../src/data.js";
import { ANOMALY_SEGMENT, NORMAL_BASELINE_RANGE, THRESHOLD_RULE } from "../src/config.js";

const model = buildTrajectoryModel(samplePoints, {
  anomalySegment: ANOMALY_SEGMENT,
  baselineRange: NORMAL_BASELINE_RANGE,
  thresholdRule: THRESHOLD_RULE
});

test("builds one segment per consecutive point pair", () => {
  assert.equal(model.segments.length, samplePoints.length - 1);
});

test("first segment has no heading change; all others do", () => {
  assert.equal(model.segments[0].headingChange, null);
  for (const segment of model.segments.slice(1)) {
    assert.ok(segment.headingChange != null);
  }
});

test("baseline is computed from the four normal segments (points 1-5)", () => {
  assert.equal(model.baseline.segmentCount, 4);
  assert.ok(model.baseline.averageSpeed > 0);
});

test("primary anomaly segment 6\u21927 exists and is flagged", () => {
  assert.ok(model.anomalyEvidence);
  assert.equal(model.anomalyEvidence.fromOrder, 6);
  assert.equal(model.anomalyEvidence.toOrder, 7);
  assert.equal(model.anomalyEvidence.detection.flagged, true);
});

test("README finding: threshold rule over-flags 5\u21926, 6\u21927 and 7\u21928", () => {
  const flagged = model.flaggedSegments.map((s) => `${s.fromOrder}\u2192${s.toOrder}`);
  assert.deepEqual(flagged, ["5\u21926", "6\u21927", "7\u21928"]);
});

test("README finding: 7\u21928 is flagged by heading change alone, not speed", () => {
  const segment = model.segments.find((s) => s.fromOrder === 7);
  assert.equal(segment.detection.speedFlagged, false);
  assert.equal(segment.detection.headingFlagged, true);
});

test("heading change is normalised to 0-180 degrees", () => {
  assert.equal(getHeadingChange(350, 10), 20);
  assert.equal(getHeadingChange(10, 350), 20);
  assert.equal(getHeadingChange(0, 180), 180);
});

test("haversine distance: identical points are 0 km apart", () => {
  const p = { latitude: 44.65, longitude: -63.57 };
  assert.equal(getDistanceKm(p, p), 0);
});

test("average ignores null values and returns null for empty input", () => {
  assert.equal(average([2, null, 4]), 3);
  assert.equal(average([null, undefined]), null);
  assert.equal(average([]), null);
});

test("detection degrades safely when the baseline has no valid speed", () => {
  const segments = buildSegments(samplePoints, ANOMALY_SEGMENT);
  const emptyBaseline = computeBaseline(segments, { fromOrder: 99, toOrder: 99 });
  assert.equal(emptyBaseline.averageSpeed, null);

  const { segments: detected, thresholds } = applyDetection(segments, emptyBaseline, THRESHOLD_RULE);
  assert.equal(thresholds.speedThreshold, null);
  for (const segment of detected) {
    assert.equal(segment.detection.speedFlagged, false);
  }
});
