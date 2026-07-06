import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MAX_COMPARISON_GAP_SECONDS,
  KNOTS_TO_KMH,
  MEASUREMENT_COMPARISON_BASIS,
  MEASUREMENT_COMPARISON_STATUS,
  calculateCircularDifference,
  compareReportedAndComputedMetrics,
  convertKnotsToKmh,
  getSegmentIntervalSeconds
} from "../src/measurement-review.js";
import {
  buildTrajectoryDisplayModel,
  buildTrajectoryModel
} from "../src/analysis.js";
import {
  gothenburgRealAisDataset,
  syntheticPhase8Dataset
} from "../src/datasets.js";
import {
  ANOMALY_SEGMENT,
  NORMAL_BASELINE_RANGE,
  THRESHOLD_RULE
} from "../src/config.js";
import { samplePoints } from "../src/data.js";
import {
  renderUnreviewedDatasetPanel,
  renderUnreviewedSegmentPanel
} from "../src/panels.js";

function makeSegment(overrides = {}) {
  const start = {
    order: 1,
    timestamp: "2026-06-24T12:00:00.000Z"
  };
  const end = {
    order: 2,
    timestamp: "2026-06-24T12:01:00.000Z",
    reported: {
      sogKnots: 10,
      cogDegrees: 359
    }
  };

  return {
    start,
    end,
    fromOrder: 1,
    toOrder: 2,
    estimatedSpeed: 20,
    heading: 1,
    ...overrides
  };
}

test("converts knots to kilometres per hour using the nautical-mile definition", () => {
  assert.equal(KNOTS_TO_KMH, 1.852);
  assert.equal(convertKnotsToKmh(10), 18.52);
  assert.equal(convertKnotsToKmh(0), 0);
});

test("returns null for unavailable or invalid speed values", () => {
  assert.equal(convertKnotsToKmh(null), null);
  assert.equal(convertKnotsToKmh(Number.NaN), null);
  assert.equal(convertKnotsToKmh(-1), null);
  assert.equal(convertKnotsToKmh("10"), null);
});

test("calculates circular direction difference across the zero-degree boundary", () => {
  assert.equal(calculateCircularDifference(359, 1), 2);
  assert.equal(calculateCircularDifference(1, 359), 2);
  assert.equal(calculateCircularDifference(0, 180), 180);
  assert.equal(calculateCircularDifference(370, 10), 0);
});

test("measures a positive observation interval in seconds", () => {
  assert.equal(getSegmentIntervalSeconds(makeSegment()), 60);
  assert.equal(
    getSegmentIntervalSeconds(
      makeSegment({
        end: {
          ...makeSegment().end,
          timestamp: "2026-06-24T11:59:00.000Z"
        }
      })
    ),
    null
  );
});

test("compares interval metrics with measurements from the destination observation", () => {
  const comparison = compareReportedAndComputedMetrics(makeSegment());

  assert.equal(comparison.status, MEASUREMENT_COMPARISON_STATUS.COMPARABLE);
  assert.equal(
    comparison.basis.type,
    MEASUREMENT_COMPARISON_BASIS.DESTINATION_OBSERVATION
  );
  assert.equal(comparison.basis.pointOrder, 2);
  assert.equal(comparison.intervalSeconds, 60);
  assert.equal(comparison.speed.reportedKmh, 18.52);
  assert.ok(Math.abs(comparison.speed.differenceKmh - 1.48) < 1e-12);
  assert.equal(comparison.direction.differenceDegrees, 2);
  assert.equal(comparison.interpretation, "descriptive-comparison-only");
});

test("keeps missing reported measurements distinct from insufficient computed evidence", () => {
  const comparison = compareReportedAndComputedMetrics(
    makeSegment({
      end: {
        ...makeSegment().end,
        reported: { sogKnots: null, cogDegrees: null }
      }
    })
  );

  assert.equal(
    comparison.speed.status,
    MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE
  );
  assert.equal(
    comparison.direction.status,
    MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE
  );
  assert.equal(
    comparison.status,
    MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE
  );
  assert.equal(comparison.speed.differenceKmh, null);
  assert.equal(comparison.direction.differenceDegrees, null);
});

test("marks comparisons unavailable when the timestamp gap exceeds the profile limit", () => {
  const comparison = compareReportedAndComputedMetrics(
    makeSegment({
      end: {
        ...makeSegment().end,
        timestamp: "2026-06-24T12:10:00.000Z"
      }
    }),
    { maxGapSeconds: 300 }
  );

  assert.equal(comparison.intervalSeconds, 600);
  assert.equal(
    comparison.speed.status,
    MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE
  );
  assert.equal(
    comparison.direction.status,
    MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE
  );
  assert.equal(comparison.speed.differenceKmh, null);
  assert.equal(comparison.direction.differenceDegrees, null);
});

test("uses an explicit insufficient-evidence state for invalid interval metrics", () => {
  const comparison = compareReportedAndComputedMetrics(
    makeSegment({ estimatedSpeed: null, heading: null })
  );

  assert.equal(
    comparison.speed.status,
    MEASUREMENT_COMPARISON_STATUS.INSUFFICIENT_EVIDENCE
  );
  assert.equal(
    comparison.direction.status,
    MEASUREMENT_COMPARISON_STATUS.INSUFFICIENT_EVIDENCE
  );
});

test("stores comparison assumptions on the real dataset rather than the synthetic fixture", () => {
  assert.equal(syntheticPhase8Dataset.measurementReviewProfile, null);
  assert.deepEqual(gothenburgRealAisDataset.measurementReviewProfile, {
    comparisonBasis: MEASUREMENT_COMPARISON_BASIS.DESTINATION_OBSERVATION,
    maxGapSeconds: DEFAULT_MAX_COMPARISON_GAP_SECONDS
  });
});

test("attaches descriptive measurement review to every real display segment", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points, {
    measurementReviewProfile: gothenburgRealAisDataset.measurementReviewProfile
  });

  assert.equal(model.segments.length, 3);
  for (const segment of model.segments) {
    assert.equal(
      segment.measurementReview.status,
      MEASUREMENT_COMPARISON_STATUS.COMPARABLE
    );
    assert.equal(segment.measurementReview.interpretation, "descriptive-comparison-only");
    assert.equal("detection" in segment, false);
  }
});

test("computes the expected first-segment Gothenburg measurement deltas", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points, {
    measurementReviewProfile: gothenburgRealAisDataset.measurementReviewProfile
  });
  const review = model.segments[0].measurementReview;

  assert.ok(Math.abs(review.speed.reportedKmh - 17.594) < 1e-12);
  assert.ok(Math.abs(review.speed.computedKmh - 18.23290883302892) < 1e-12);
  assert.ok(Math.abs(review.speed.differenceKmh - 0.6389088330289183) < 1e-12);
  assert.ok(Math.abs(review.direction.differenceDegrees - 4.996558701798704) < 1e-12);
});

test("renders reported values, computed values, deltas, and the non-verdict caveat", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points, {
    measurementReviewProfile: gothenburgRealAisDataset.measurementReviewProfile
  });
  const html = renderUnreviewedSegmentPanel(
    model.segments[0],
    gothenburgRealAisDataset
  );

  assert.match(html, /Real AIS Segment Context: Measurement Review/);
  assert.match(html, /AIS-reported measurements at Point 2/);
  assert.match(html, /SOG:[\s\S]*9\.50 kn[\s\S]*17\.59 km\/h/);
  assert.match(html, /RouteSense-computed movement metrics/);
  assert.match(html, /Speed difference \(computed − reported\):[\s\S]*\+0\.64 km\/h/);
  assert.match(html, /Direction difference \(circular\):[\s\S]*5\.00°/);
  assert.match(html, /difference is not an error score, validation result, or anomaly label/);
  assert.match(html, /No baseline, threshold rule, or anomaly conclusion is attached/);
});

test("surfaces provenance limitations in the real dataset overview", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points, {
    measurementReviewProfile: gothenburgRealAisDataset.measurementReviewProfile
  });
  const html = renderUnreviewedDatasetPanel(gothenburgRealAisDataset, model);

  assert.match(html, /Timestamp basis:/);
  assert.match(html, /treats them as UTC/);
  assert.match(html, /License note:/);
  assert.match(html, /Not asserted by RouteSense/);
  assert.match(html, /descriptive measurement comparison/);
});

test("does not attach the real-data measurement review to the synthetic analysis model", () => {
  const model = buildTrajectoryModel(samplePoints, {
    anomalySegment: ANOMALY_SEGMENT,
    baselineRange: NORMAL_BASELINE_RANGE,
    thresholdRule: THRESHOLD_RULE
  });

  assert.equal(model.anomalyEvidence.fromOrder, 6);
  assert.equal(model.anomalyEvidence.toOrder, 7);
  assert.ok(model.segments.every((segment) => !("measurementReview" in segment)));
});
