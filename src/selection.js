// Group (drag-box) selection logic for the rule-versus-narrative comparison
// experiment. Pure functions only — no DOM, no ArcGIS, no ArcGIS geometry types.
//
// Selection unit: vessel points. Segments are never selected directly; they are
// derived. A segment belongs to the selection only when BOTH of its endpoints
// are selected. A segment with exactly one selected endpoint is reported as a
// boundary segment so the panel can explain the omission instead of silently
// dropping it.
//
// Every aggregate here is deliberately conservative:
//   - overall speed is distance-weighted, never a mean of segment speeds
//   - heading-change coverage is always reported alongside any heading value
//   - measurement differences are reported as ranges and status counts, never
//     as a single averaged number that would read like an error score
// These are honesty constraints, not stylistic preferences.

import { getTimeDiffHours } from "./geo.js";
import { MEASUREMENT_COMPARISON_STATUS } from "./measurement-review.js";

// Selection size changes the shape of the panel, not just its numbers.
export const SELECTION_TIER = Object.freeze({
  EMPTY: "empty",
  SINGLE_POINT: "single-point",
  SINGLE_SEGMENT: "single-segment",
  MULTI_SEGMENT: "multi-segment"
});

// A drag box can clip the primary anomaly by catching only one of its two
// endpoints. That third state has to exist: reporting such a selection as
// "anomaly not included" would be false.
export const ANOMALY_CONTAINMENT = Object.freeze({
  FULL: "fully-in-selection",
  PARTIAL: "partially-in-selection",
  ABSENT: "not-in-selection",
  NOT_APPLICABLE: "not-applicable"
});

export const BASELINE_OVERLAP = Object.freeze({
  NONE: "none",
  PARTIAL: "partial",
  COMPLETE: "complete",
  NOT_APPLICABLE: "not-applicable"
});

// --- Geometry boundary ------------------------------------------------------

/**
 * Points whose coordinates fall inside a longitude/latitude box.
 * The caller is responsible for converting screen coordinates to geographic
 * ones; this function never touches a map view.
 */
export function selectPointsInExtent(points = [], extent = null) {
  if (extent == null || typeof extent !== "object") return [];

  const { xmin, ymin, xmax, ymax } = extent;

  if (![xmin, ymin, xmax, ymax].every((value) => Number.isFinite(value))) {
    return [];
  }

  // Normalized so a box dragged right-to-left or bottom-to-top behaves the same.
  const left = Math.min(xmin, xmax);
  const right = Math.max(xmin, xmax);
  const bottom = Math.min(ymin, ymax);
  const top = Math.max(ymin, ymax);

  return points.filter(
    (point) =>
      Number.isFinite(point?.longitude) &&
      Number.isFinite(point?.latitude) &&
      point.longitude >= left &&
      point.longitude <= right &&
      point.latitude >= bottom &&
      point.latitude <= top
  );
}

// --- Order runs -------------------------------------------------------------

/**
 * Collapse selected trajectory orders into contiguous runs. A rectangular box
 * over a route that doubles back can catch non-consecutive points, so a single
 * "from-to" range is not a safe description of a selection.
 */
export function groupOrdersIntoRuns(orders = []) {
  const sorted = [...new Set(orders)]
    .filter((order) => Number.isFinite(order))
    .sort((a, b) => a - b);

  return sorted.reduce((runs, order) => {
    const current = runs[runs.length - 1];

    if (current && order === current.toOrder + 1) {
      current.toOrder = order;
      return runs;
    }

    runs.push({ fromOrder: order, toOrder: order });
    return runs;
  }, []);
}

export function formatOrderRuns(runs = []) {
  if (!Array.isArray(runs) || runs.length === 0) return "None";

  return runs
    .map((run) =>
      run.fromOrder === run.toOrder
        ? `${run.fromOrder}`
        : `${run.fromOrder}–${run.toOrder}`
    )
    .join(", ");
}

// --- Segment classification -------------------------------------------------

export function classifySegmentsBySelection(segments = [], selectedOrders = []) {
  const selected = new Set(selectedOrders);
  const interior = [];
  const boundary = [];

  segments.forEach((segment) => {
    const hasStart = selected.has(segment.fromOrder);
    const hasEnd = selected.has(segment.toOrder);

    if (hasStart && hasEnd) {
      interior.push(segment);
    } else if (hasStart || hasEnd) {
      boundary.push(segment);
    }
  });

  return { interior, boundary };
}

// --- Movement aggregation ---------------------------------------------------

function sum(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function range(values) {
  return values.length
    ? { min: Math.min(...values), max: Math.max(...values) }
    : null;
}

export function summarizeSelectionMovement(interiorSegments = []) {
  const distances = interiorSegments
    .map((segment) => segment.distanceKm)
    .filter((value) => Number.isFinite(value));

  const durations = interiorSegments
    .map((segment) => getTimeDiffHours(segment.start, segment.end))
    .filter((value) => Number.isFinite(value) && value > 0);

  const speeds = interiorSegments
    .map((segment) => segment.estimatedSpeed)
    .filter((value) => Number.isFinite(value));

  const totalDistanceKm = sum(distances);
  const totalDurationHours = sum(durations);

  return {
    segmentCount: interiorSegments.length,
    totalDistanceKm,
    totalDurationHours,
    // Total distance over total covered time. A mean of per-segment speeds
    // would weight a 200 m segment the same as a 5 km one.
    overallSpeedKmh:
      totalDistanceKm != null && totalDurationHours != null && totalDurationHours > 0
        ? totalDistanceKm / totalDurationHours
        : null,
    speedRangeKmh: range(speeds),
    // The first segment of a trajectory has no preceding segment, so its
    // heading change is null. Coverage travels with the value so no aggregate
    // can imply that every segment contributed one.
    headingChangeCoverage: {
      available: interiorSegments.filter(
        (segment) => segment.headingChange != null
      ).length,
      total: interiorSegments.length
    }
  };
}

// --- Rule-versus-narrative comparison (reviewed synthetic dataset only) ------

export function describeAnomalyContainment(primaryAnomaly, selectedOrders = []) {
  if (primaryAnomaly == null) {
    return {
      status: ANOMALY_CONTAINMENT.NOT_APPLICABLE,
      label: null,
      selectedEndpoints: []
    };
  }

  const selected = new Set(selectedOrders);
  const selectedEndpoints = [primaryAnomaly.fromOrder, primaryAnomaly.toOrder]
    .filter((order) => selected.has(order));

  const status =
    selectedEndpoints.length === 2
      ? ANOMALY_CONTAINMENT.FULL
      : selectedEndpoints.length === 1
        ? ANOMALY_CONTAINMENT.PARTIAL
        : ANOMALY_CONTAINMENT.ABSENT;

  return {
    status,
    label: `${primaryAnomaly.fromOrder} → ${primaryAnomaly.toOrder}`,
    fromOrder: primaryAnomaly.fromOrder,
    toOrder: primaryAnomaly.toOrder,
    selectedEndpoints
  };
}

export function describeBaselineOverlap(baselineRange, selectedOrders = []) {
  if (baselineRange == null) {
    return {
      status: BASELINE_OVERLAP.NOT_APPLICABLE,
      label: null,
      selectedInRange: 0,
      rangeSize: 0
    };
  }

  const selectedInRange = selectedOrders.filter(
    (order) =>
      order >= baselineRange.fromOrder && order <= baselineRange.toOrder
  ).length;

  const rangeSize = baselineRange.toOrder - baselineRange.fromOrder + 1;

  const status =
    selectedInRange === 0
      ? BASELINE_OVERLAP.NONE
      : selectedInRange >= rangeSize
        ? BASELINE_OVERLAP.COMPLETE
        : BASELINE_OVERLAP.PARTIAL;

  return {
    status,
    label: `${baselineRange.fromOrder}–${baselineRange.toOrder}`,
    selectedInRange,
    rangeSize
  };
}

function buildRuleComparisonItems(interiorSegments, ruleEvidenceItems = []) {
  return interiorSegments.map((segment) => {
    const evidence = ruleEvidenceItems.find(
      (item) =>
        item.fromOrder === segment.fromOrder && item.toOrder === segment.toOrder
    ) ?? null;

    return {
      fromOrder: segment.fromOrder,
      toOrder: segment.toOrder,
      label: `Point ${segment.fromOrder} → Point ${segment.toOrder}`,
      flagged: Boolean(segment.detection?.flagged),
      isPrimaryAnomaly: Boolean(segment.isPrimaryAnomaly),
      role: evidence?.role ?? "not-flagged",
      triggers: {
        speed: Boolean(segment.detection?.speedFlagged),
        heading: Boolean(segment.detection?.headingFlagged)
      },
      metrics: {
        estimatedSpeed: segment.estimatedSpeed,
        headingChange: segment.headingChange
      }
    };
  });
}

export function summarizeRuleComparison(
  interiorSegments = [],
  {
    ruleEvidenceItems = [],
    primaryAnomaly = null,
    baselineRange = null,
    selectedOrders = []
  } = {}
) {
  const items = buildRuleComparisonItems(interiorSegments, ruleEvidenceItems);
  const flaggedCount = items.filter((item) => item.flagged).length;
  const narrativeAnomalyCount = items.filter(
    (item) => item.isPrimaryAnomaly
  ).length;

  return {
    items,
    segmentCount: items.length,
    flaggedCount,
    narrativeAnomalyCount,
    // The point of this experiment: inside one selection, how many segments the
    // threshold rule flags versus how many the RouteSense narrative treats as
    // the anomaly. The mismatch is the documented research finding and must not
    // be smoothed away.
    hasRuleNarrativeMismatch: flaggedCount > narrativeAnomalyCount,
    primaryAnomaly: describeAnomalyContainment(primaryAnomaly, selectedOrders),
    baseline: describeBaselineOverlap(baselineRange, selectedOrders)
  };
}

// --- Descriptive measurement comparison (real AIS dataset only) -------------

function countByStatus(reviews, metric) {
  return reviews.reduce((counts, review) => {
    const status =
      review?.[metric]?.status ??
      MEASUREMENT_COMPARISON_STATUS.INSUFFICIENT_EVIDENCE;

    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function comparableDifferences(reviews, metric, field) {
  return reviews
    .filter(
      (review) =>
        review?.[metric]?.status === MEASUREMENT_COMPARISON_STATUS.COMPARABLE
    )
    .map((review) => review[metric][field])
    .filter((value) => Number.isFinite(value));
}

export function summarizeMeasurementComparison(interiorSegments = []) {
  const reviews = interiorSegments
    .map((segment) => segment.measurementReview)
    .filter(Boolean);

  if (reviews.length === 0) return null;

  return {
    segmentCount: reviews.length,
    speedStatusCounts: countByStatus(reviews, "speed"),
    directionStatusCounts: countByStatus(reviews, "direction"),
    // Ranges, not means. A single averaged difference would read as an error
    // score, and this dataset carries no reference value that could justify one.
    speedDifferenceRangeKmh: range(
      comparableDifferences(reviews, "speed", "differenceKmh")
    ),
    directionDifferenceRangeDegrees: range(
      comparableDifferences(reviews, "direction", "differenceDegrees")
    )
  };
}

// --- Composition ------------------------------------------------------------

function resolveTier(pointCount, interiorSegmentCount) {
  if (pointCount === 0) return SELECTION_TIER.EMPTY;
  if (pointCount === 1) return SELECTION_TIER.SINGLE_POINT;
  if (interiorSegmentCount === 1) return SELECTION_TIER.SINGLE_SEGMENT;
  return SELECTION_TIER.MULTI_SEGMENT;
}

/**
 * The single object every group-selection renderer reads from. Which comparison
 * block is populated depends on the dataset's analysis mode: a reviewed model
 * carries thresholds and gets the rule comparison, an unreviewed real-AIS model
 * carries neither and gets the descriptive measurement comparison instead.
 * They are never both present.
 */
export function buildSelectionSummary(
  selectedPoints = [],
  model = {},
  { primaryAnomaly = null, baselineRange = null } = {}
) {
  const points = [...selectedPoints].sort((a, b) => a.order - b.order);
  const selectedOrders = points.map((point) => point.order);

  const { interior, boundary } = classifySegmentsBySelection(
    model.segments ?? [],
    selectedOrders
  );

  const runs = groupOrdersIntoRuns(selectedOrders);
  const hasReviewedAnalysis = model.thresholds != null;

  return {
    tier: resolveTier(points.length, interior.length),
    points,
    selectedOrders,
    pointCount: points.length,
    runs,
    runsLabel: formatOrderRuns(runs),
    isContiguous: runs.length <= 1,
    interiorSegments: interior,
    boundarySegments: boundary,
    span:
      points.length > 0
        ? { start: points[0], end: points[points.length - 1] }
        : null,
    movement: summarizeSelectionMovement(interior),
    rule: hasReviewedAnalysis
      ? summarizeRuleComparison(interior, {
          ruleEvidenceItems: model.ruleEvidenceItems ?? [],
          primaryAnomaly,
          baselineRange,
          selectedOrders
        })
      : null,
    measurement: hasReviewedAnalysis
      ? null
      : summarizeMeasurementComparison(interior)
  };
}
