// Descriptive comparison between AIS-reported measurements and movement
// metrics computed by RouteSense from consecutive observations.
//
// This module is deliberately pure: it imports no ArcGIS or DOM APIs and does
// not classify a segment as normal, abnormal, valid, or anomalous. Differences
// are evidence for human review only because AIS SOG/COG may represent an
// instantaneous vessel state while RouteSense speed/bearing summarize the
// interval between two observations.

export const KNOTS_TO_KMH = 1.852;
export const DEFAULT_MAX_COMPARISON_GAP_SECONDS = 300;

export const MEASUREMENT_COMPARISON_BASIS = Object.freeze({
  DESTINATION_OBSERVATION: "destination-observation"
});

export const MEASUREMENT_COMPARISON_STATUS = Object.freeze({
  COMPARABLE: "comparable",
  REPORTED_VALUE_UNAVAILABLE: "reported-value-unavailable",
  TIMESTAMP_GAP_TOO_LARGE: "timestamp-gap-too-large",
  INSUFFICIENT_EVIDENCE: "insufficient-evidence"
});

function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeDegrees(value) {
  const number = asFiniteNumber(value);
  if (number == null) return null;
  return ((number % 360) + 360) % 360;
}

export function convertKnotsToKmh(knots) {
  const value = asFiniteNumber(knots);
  return value != null && value >= 0 ? value * KNOTS_TO_KMH : null;
}

// Smallest absolute angular difference, normalized to 0-180 degrees.
export function calculateCircularDifference(firstDegrees, secondDegrees) {
  const first = normalizeDegrees(firstDegrees);
  const second = normalizeDegrees(secondDegrees);

  if (first == null || second == null) return null;

  const difference = Math.abs(first - second);
  return difference > 180 ? 360 - difference : difference;
}

export function getSegmentIntervalSeconds(segment) {
  const startMs = Date.parse(segment?.start?.timestamp ?? "");
  const endMs = Date.parse(segment?.end?.timestamp ?? "");

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  const seconds = (endMs - startMs) / 1000;
  return seconds > 0 ? seconds : null;
}

function getMetricStatus({
  reportedValue,
  computedValue,
  intervalSeconds,
  maxGapSeconds
}) {
  if (intervalSeconds == null || computedValue == null) {
    return MEASUREMENT_COMPARISON_STATUS.INSUFFICIENT_EVIDENCE;
  }

  if (intervalSeconds > maxGapSeconds) {
    return MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE;
  }

  if (reportedValue == null) {
    return MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE;
  }

  return MEASUREMENT_COMPARISON_STATUS.COMPARABLE;
}

function summarizeStatus(speedStatus, directionStatus) {
  if (
    speedStatus === MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE ||
    directionStatus === MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE
  ) {
    return MEASUREMENT_COMPARISON_STATUS.TIMESTAMP_GAP_TOO_LARGE;
  }

  if (
    speedStatus === MEASUREMENT_COMPARISON_STATUS.COMPARABLE ||
    directionStatus === MEASUREMENT_COMPARISON_STATUS.COMPARABLE
  ) {
    return MEASUREMENT_COMPARISON_STATUS.COMPARABLE;
  }

  if (
    speedStatus === MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE &&
    directionStatus === MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE
  ) {
    return MEASUREMENT_COMPARISON_STATUS.REPORTED_VALUE_UNAVAILABLE;
  }

  return MEASUREMENT_COMPARISON_STATUS.INSUFFICIENT_EVIDENCE;
}

/**
 * Compare interval-derived movement with source measurements reported at the
 * destination observation. The destination basis is explicit so the interface
 * never implies that the AIS value was measured over the full segment.
 */
export function compareReportedAndComputedMetrics(
  segment,
  {
    comparisonBasis = MEASUREMENT_COMPARISON_BASIS.DESTINATION_OBSERVATION,
    maxGapSeconds = DEFAULT_MAX_COMPARISON_GAP_SECONDS
  } = {}
) {
  if (segment == null || typeof segment !== "object" || Array.isArray(segment)) {
    throw new TypeError("segment must be an object.");
  }

  if (comparisonBasis !== MEASUREMENT_COMPARISON_BASIS.DESTINATION_OBSERVATION) {
    throw new RangeError(`Unsupported measurement comparison basis: ${comparisonBasis}`);
  }

  if (!Number.isFinite(maxGapSeconds) || maxGapSeconds <= 0) {
    throw new RangeError("maxGapSeconds must be a positive finite number.");
  }

  const reportedPoint = segment.end ?? null;
  const reported = reportedPoint?.reported ?? {};
  const intervalSeconds = getSegmentIntervalSeconds(segment);

  const reportedSpeedKnots = asFiniteNumber(reported.sogKnots);
  const reportedSpeedKmh = convertKnotsToKmh(reportedSpeedKnots);
  const computedSpeedKmh = asFiniteNumber(segment.estimatedSpeed);
  const reportedCourseDegrees = asFiniteNumber(reported.cogDegrees);
  const computedBearingDegrees = asFiniteNumber(segment.heading);

  const speedStatus = getMetricStatus({
    reportedValue: reportedSpeedKmh,
    computedValue: computedSpeedKmh,
    intervalSeconds,
    maxGapSeconds
  });

  const directionStatus = getMetricStatus({
    reportedValue: reportedCourseDegrees,
    computedValue: computedBearingDegrees,
    intervalSeconds,
    maxGapSeconds
  });

  return {
    status: summarizeStatus(speedStatus, directionStatus),
    interpretation: "descriptive-comparison-only",
    basis: {
      type: comparisonBasis,
      pointOrder: reportedPoint?.order ?? null,
      timestamp: reportedPoint?.timestamp ?? null
    },
    intervalSeconds,
    maxGapSeconds,
    speed: {
      status: speedStatus,
      reportedKnots: reportedSpeedKnots,
      reportedKmh: reportedSpeedKmh,
      computedKmh: computedSpeedKmh,
      differenceKmh:
        speedStatus === MEASUREMENT_COMPARISON_STATUS.COMPARABLE
          ? computedSpeedKmh - reportedSpeedKmh
          : null
    },
    direction: {
      status: directionStatus,
      reportedCogDegrees: reportedCourseDegrees,
      computedBearingDegrees,
      differenceDegrees:
        directionStatus === MEASUREMENT_COMPARISON_STATUS.COMPARABLE
          ? calculateCircularDifference(
              reportedCourseDegrees,
              computedBearingDegrees
            )
          : null
    }
  };
}
