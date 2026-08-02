import test from "node:test";
import assert from "node:assert/strict";

import {
  ANOMALY_CONTAINMENT,
  BASELINE_OVERLAP,
  SELECTION_TIER,
  buildSelectionSummary,
  classifySegmentsBySelection,
  describeAnomalyContainment,
  describeBaselineOverlap,
  formatOrderRuns,
  groupOrdersIntoRuns,
  selectPointsInExtent,
  summarizeMeasurementComparison,
  summarizeRuleComparison,
  summarizeSelectionMovement
} from "../src/selection.js";
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
import { gothenburgRealAisDataset } from "../src/datasets.js";
import { MEASUREMENT_COMPARISON_STATUS } from "../src/measurement-review.js";

const reviewedModel = buildTrajectoryModel(samplePoints, {
  anomalySegment: ANOMALY_SEGMENT,
  baselineRange: NORMAL_BASELINE_RANGE,
  thresholdRule: THRESHOLD_RULE
});

const analysisContext = {
  primaryAnomaly: ANOMALY_SEGMENT,
  baselineRange: NORMAL_BASELINE_RANGE
};

const pointsByOrder = (orders) =>
  samplePoints.filter((point) => orders.includes(point.order));

// --- Extent boundary --------------------------------------------------------

test("extent selection accepts a box dragged in any direction", () => {
  const boxAroundPointsThreeAndFour = {
    xmin: -63.57,
    ymin: 44.645,
    xmax: -63.555,
    ymax: 44.655
  };

  const reversedBox = {
    xmin: -63.555,
    ymin: 44.655,
    xmax: -63.57,
    ymax: 44.645
  };

  const forward = selectPointsInExtent(samplePoints, boxAroundPointsThreeAndFour);
  const reversed = selectPointsInExtent(samplePoints, reversedBox);

  assert.deepEqual(forward.map((point) => point.order), [3, 4]);
  assert.deepEqual(reversed.map((point) => point.order), [3, 4]);
});

test("extent selection returns nothing for a missing or malformed box", () => {
  assert.deepEqual(selectPointsInExtent(samplePoints, null), []);
  assert.deepEqual(
    selectPointsInExtent(samplePoints, { xmin: NaN, ymin: 0, xmax: 1, ymax: 1 }),
    []
  );
});

// --- Runs -------------------------------------------------------------------

test("non-consecutive orders collapse into separate runs", () => {
  assert.deepEqual(groupOrdersIntoRuns([7, 1, 2, 8]), [
    { fromOrder: 1, toOrder: 2 },
    { fromOrder: 7, toOrder: 8 }
  ]);

  assert.equal(formatOrderRuns(groupOrdersIntoRuns([7, 1, 2, 8])), "1–2, 7–8");
  assert.equal(formatOrderRuns(groupOrdersIntoRuns([4])), "4");
  assert.equal(formatOrderRuns([]), "None");
});

// --- Segment classification -------------------------------------------------

test("a segment joins the selection only when both endpoints are selected", () => {
  const { interior, boundary } = classifySegmentsBySelection(
    reviewedModel.segments,
    [3, 4]
  );

  assert.deepEqual(
    interior.map((segment) => `${segment.fromOrder}->${segment.toOrder}`),
    ["3->4"]
  );
  assert.deepEqual(
    boundary.map((segment) => `${segment.fromOrder}->${segment.toOrder}`),
    ["2->3", "4->5"]
  );
});

// --- Movement aggregation ---------------------------------------------------

test("overall speed is total distance over total covered time", () => {
  const { interior } = classifySegmentsBySelection(
    reviewedModel.segments,
    [5, 6, 7, 8]
  );

  const movement = summarizeSelectionMovement(interior);

  assert.equal(
    movement.overallSpeedKmh,
    movement.totalDistanceKm / movement.totalDurationHours
  );
});

// The sample fixture uses a uniform 10-minute interval, so there the weighted
// speed and a plain mean of segment speeds coincide. Uneven intervals are what
// separates them, so the weighting is pinned against a fixture that has them.
test("overall speed weights by duration instead of averaging segment speeds", () => {
  const unevenSegments = [
    {
      distanceKm: 1,
      estimatedSpeed: 1,
      headingChange: null,
      start: { timestamp: "2026-04-28 10:00" },
      end: { timestamp: "2026-04-28 11:00" }
    },
    {
      distanceKm: 10,
      estimatedSpeed: 5,
      headingChange: 12,
      start: { timestamp: "2026-04-28 11:00" },
      end: { timestamp: "2026-04-28 13:00" }
    }
  ];

  const movement = summarizeSelectionMovement(unevenSegments);
  const meanOfSegmentSpeeds = (1 + 5) / 2;

  assert.equal(movement.totalDistanceKm, 11);
  assert.equal(movement.totalDurationHours, 3);
  assert.equal(movement.overallSpeedKmh, 11 / 3);
  assert.notEqual(movement.overallSpeedKmh, meanOfSegmentSpeeds);
});

test("heading-change coverage reports the segment without a preceding segment", () => {
  const { interior } = classifySegmentsBySelection(
    reviewedModel.segments,
    [1, 2, 3]
  );

  const movement = summarizeSelectionMovement(interior);

  assert.equal(movement.headingChangeCoverage.total, 2);
  assert.equal(movement.headingChangeCoverage.available, 1);
});

test("an empty selection produces null aggregates instead of zeros", () => {
  const movement = summarizeSelectionMovement([]);

  assert.equal(movement.totalDistanceKm, null);
  assert.equal(movement.totalDurationHours, null);
  assert.equal(movement.overallSpeedKmh, null);
  assert.equal(movement.speedRangeKmh, null);
});

// --- Rule versus narrative --------------------------------------------------

test("a selection over points 5-8 exposes the documented over-flagging mismatch", () => {
  const summary = buildSelectionSummary(
    pointsByOrder([5, 6, 7, 8]),
    reviewedModel,
    analysisContext
  );

  assert.equal(summary.tier, SELECTION_TIER.MULTI_SEGMENT);
  assert.equal(summary.rule.segmentCount, 3);
  assert.equal(summary.rule.flaggedCount, 3);
  assert.equal(summary.rule.narrativeAnomalyCount, 1);
  assert.equal(summary.rule.hasRuleNarrativeMismatch, true);
});

test("a clipped anomaly is reported as partially selected, never as absent", () => {
  const partial = describeAnomalyContainment(ANOMALY_SEGMENT, [4, 5, 6]);

  assert.equal(partial.status, ANOMALY_CONTAINMENT.PARTIAL);
  assert.deepEqual(partial.selectedEndpoints, [6]);

  assert.equal(
    describeAnomalyContainment(ANOMALY_SEGMENT, [6, 7]).status,
    ANOMALY_CONTAINMENT.FULL
  );
  assert.equal(
    describeAnomalyContainment(ANOMALY_SEGMENT, [1, 2]).status,
    ANOMALY_CONTAINMENT.ABSENT
  );
});

test("baseline overlap distinguishes partial cover from full cover", () => {
  assert.equal(
    describeBaselineOverlap(NORMAL_BASELINE_RANGE, [1, 2, 3, 4, 5]).status,
    BASELINE_OVERLAP.COMPLETE
  );
  assert.equal(
    describeBaselineOverlap(NORMAL_BASELINE_RANGE, [4, 5, 6]).status,
    BASELINE_OVERLAP.PARTIAL
  );
  assert.equal(
    describeBaselineOverlap(NORMAL_BASELINE_RANGE, [7, 8]).status,
    BASELINE_OVERLAP.NONE
  );
});

test("rule comparison marks the narrative anomaly apart from rule-only segments", () => {
  const { interior } = classifySegmentsBySelection(
    reviewedModel.segments,
    [5, 6, 7, 8]
  );

  const comparison = summarizeRuleComparison(interior, {
    ruleEvidenceItems: reviewedModel.ruleEvidenceItems,
    primaryAnomaly: ANOMALY_SEGMENT,
    baselineRange: NORMAL_BASELINE_RANGE,
    selectedOrders: [5, 6, 7, 8]
  });

  const narrative = comparison.items.filter((item) => item.isPrimaryAnomaly);
  const ruleOnly = comparison.items.filter(
    (item) => item.flagged && !item.isPrimaryAnomaly
  );

  assert.equal(narrative.length, 1);
  assert.equal(narrative[0].label, "Point 6 → Point 7");
  assert.equal(ruleOnly.length, 2);
});

// --- Tier resolution --------------------------------------------------------

test("selection size selects the panel tier", () => {
  const tierFor = (orders) =>
    buildSelectionSummary(pointsByOrder(orders), reviewedModel, analysisContext)
      .tier;

  assert.equal(tierFor([]), SELECTION_TIER.EMPTY);
  assert.equal(tierFor([3]), SELECTION_TIER.SINGLE_POINT);
  assert.equal(tierFor([3, 4]), SELECTION_TIER.SINGLE_SEGMENT);
  assert.equal(tierFor([3, 4, 5]), SELECTION_TIER.MULTI_SEGMENT);
});

test("two non-consecutive points yield no interior segment", () => {
  const summary = buildSelectionSummary(
    pointsByOrder([2, 7]),
    reviewedModel,
    analysisContext
  );

  assert.equal(summary.tier, SELECTION_TIER.MULTI_SEGMENT);
  assert.equal(summary.interiorSegments.length, 0);
  assert.equal(summary.isContiguous, false);
  assert.equal(summary.runsLabel, "2, 7");
});

// --- Real AIS boundary ------------------------------------------------------

test("an unreviewed dataset gets a measurement comparison and no rule block", () => {
  const realDataset = gothenburgRealAisDataset;

  const displayModel = buildTrajectoryDisplayModel(realDataset.points, {
    measurementReviewProfile: realDataset.measurementReviewProfile
  });

  const summary = buildSelectionSummary(
    realDataset.points.slice(0, 4),
    displayModel,
    { primaryAnomaly: null, baselineRange: null }
  );

  assert.equal(summary.rule, null);
  assert.ok(summary.measurement);
  assert.equal(summary.measurement.segmentCount, 3);
});

test("measurement differences are summarized as ranges, never as a mean", () => {
  const segments = [
    {
      fromOrder: 1,
      toOrder: 2,
      measurementReview: {
        speed: {
          status: MEASUREMENT_COMPARISON_STATUS.COMPARABLE,
          differenceKmh: -1.2
        },
        direction: {
          status: MEASUREMENT_COMPARISON_STATUS.COMPARABLE,
          differenceDegrees: 4
        }
      }
    },
    {
      fromOrder: 2,
      toOrder: 3,
      measurementReview: {
        speed: {
          status: MEASUREMENT_COMPARISON_STATUS.COMPARABLE,
          differenceKmh: 0.8
        },
        direction: {
          status: MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE,
          differenceDegrees: null
        }
      }
    }
  ];

  const measurement = summarizeMeasurementComparison(segments);

  // Speed and direction keep separate statuses: the second segment's direction
  // was never comparable, so no combined verdict may imply it was.
  assert.equal(measurement.items.length, 2);
  assert.equal(measurement.items[1].speed.status, MEASUREMENT_COMPARISON_STATUS.COMPARABLE);
  assert.equal(measurement.items[1].speed.difference, 0.8);
  assert.equal(
    measurement.items[1].direction.status,
    MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE
  );
  assert.equal(measurement.items[1].direction.difference, null);

  assert.deepEqual(measurement.speedDifferenceRangeKmh, { min: -1.2, max: 0.8 });
  assert.equal(measurement.directionDifferenceRangeDegrees.min, 4);
  assert.equal(
    measurement.directionStatusCounts[
      MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE
    ],
    1
  );
  assert.equal(measurement.speedDifferenceRangeKmh.mean, undefined);
});
