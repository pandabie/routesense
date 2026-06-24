// Derived-data pipeline: points -> segments -> baseline -> detection.
// Pure functions only — no DOM, no ArcGIS. This is the part of RouteSense
// that constitutes "research logic", so it is isolated and unit-tested
// (see tests/analysis.test.js).

import {
  getDistanceKm,
  getEstimatedSpeed,
  getHeading,
  getHeadingChange,
  average,
  percentDifference
} from "./geo.js";

// One pass builds every segment with its computed trajectory features.
export function buildSegments(points, anomalySegment) {
  const segments = [];

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const heading = getHeading(start, end);
    const previousSegment = segments[i - 1];

    segments.push({
      index: i,
      start,
      end,
      fromOrder: start.order,
      toOrder: end.order,
      distanceKm: getDistanceKm(start, end),
      estimatedSpeed: getEstimatedSpeed(start, end),
      heading,
      headingChange: previousSegment
        ? getHeadingChange(previousSegment.heading, heading)
        : null,
      isPrimaryAnomaly:
        start.order === anomalySegment.fromOrder &&
        end.order === anomalySegment.toOrder
    });
  }

  return segments;
}

// Baseline statistics from the normal-movement segments.
export function computeBaseline(segments, range) {
  const baselineSegments = segments.filter(
    (s) => s.fromOrder >= range.fromOrder && s.toOrder <= range.toOrder
  );

  return {
    description: `Average of normal movement segments (Point ${range.fromOrder} \u2192 Point ${range.toOrder})`,
    segmentCount: baselineSegments.length,
    averageSpeed: average(baselineSegments.map((s) => s.estimatedSpeed)),
    averageHeadingChange: average(baselineSegments.map((s) => s.headingChange))
  };
}

// Threshold-based detection (Phase 7 starter). Returns new segment objects
// annotated with per-segment flags, plus the shared thresholds — thresholds
// are properties of the rule, not of any individual segment, so they are
// returned once instead of being copied onto all segments.
export function applyDetection(segments, baseline, rule) {
  const speedThreshold =
    baseline.averageSpeed != null
      ? baseline.averageSpeed * rule.speedMultiplier
      : null;

  const thresholds = {
    speedThreshold,
    headingThreshold: rule.headingChangeDegrees
  };

  const detectedSegments = segments.map((segment) => {
    const speedFlagged =
      speedThreshold != null &&
      segment.estimatedSpeed != null &&
      segment.estimatedSpeed > speedThreshold;

    // headingChange is null for the first segment; treat that as 0 (no turn).
    const headingFlagged =
      (segment.headingChange ?? 0) > rule.headingChangeDegrees;

    return {
      ...segment,
      detection: { flagged: speedFlagged || headingFlagged, speedFlagged, headingFlagged }
    };
  });

  return { segments: detectedSegments, thresholds };
}

// Deviation of the primary anomaly segment from the baseline.
export function computeAnomalyDeviation(anomalyEvidence, baseline) {
  if (!anomalyEvidence) {
    return { speedPercent: null, headingChangeDifference: null };
  }

  return {
    speedPercent: percentDifference(
      anomalyEvidence.estimatedSpeed,
      baseline.averageSpeed
    ),
    headingChangeDifference:
      anomalyEvidence.headingChange != null &&
      baseline.averageHeadingChange != null
        ? anomalyEvidence.headingChange - baseline.averageHeadingChange
        : null
  };
}

// Convenience composition: the full pipeline in one call.
// `model` is the single source of truth for all downstream rendering code.
export function buildTrajectoryModel(points, { anomalySegment, baselineRange, thresholdRule }) {
  const baseSegments = buildSegments(points, anomalySegment);
  const baseline = computeBaseline(baseSegments, baselineRange);
  const { segments, thresholds } = applyDetection(baseSegments, baseline, thresholdRule);

  const anomalyEvidence = segments.find((s) => s.isPrimaryAnomaly) ?? null;
  const flaggedSegments = segments.filter((s) => s.detection.flagged);

  return {
    segments,
    baseline,
    thresholds,
    anomalyEvidence,
    anomalyDeviation: computeAnomalyDeviation(anomalyEvidence, baseline),
    // Exposed directly because the over-flagging behaviour of the threshold
    // rule is a documented research finding (see README) and is pinned by a
    // regression test.
    flaggedSegments,
    // Phase 8 presentation model. Keeping this derived value inside the
    // trajectory model preserves a single source of truth for panel rendering.
    ruleEvidenceItems: createRuleEvidenceReviewItems(flaggedSegments, anomalySegment)
  };
}

export const PRIMARY_ROUTESENSE_ANOMALY = {
  fromOrder: 6,
  toOrder: 7,
};

export function getSegmentKey(fromOrder, toOrder) {
  return `${fromOrder}->${toOrder}`;
}

export function classifyRuleEvidenceSegment(
  segment,
  primarySegment = PRIMARY_ROUTESENSE_ANOMALY
) {
  const { fromOrder, toOrder } = segment;

  if (
    fromOrder === primarySegment.fromOrder &&
    toOrder === primarySegment.toOrder
  ) {
    return {
      role: "primary-anomaly",
      title: "Primary RouteSense anomaly",
      description:
        "This segment is the main perception-aware anomaly used in the RouteSense narrative.",
    };
  }

  if (toOrder === primarySegment.fromOrder) {
    return {
      role: "pre-anomaly-evidence",
      title: "Pre-anomaly rule evidence",
      description:
        "This segment occurs immediately before the primary anomaly and helps reviewers inspect the lead-in pattern.",
    };
  }

  if (fromOrder === primarySegment.toOrder) {
    return {
      role: "post-anomaly-evidence",
      title: "Post-anomaly rule evidence",
      description:
        "This segment occurs immediately after the primary anomaly and helps reviewers inspect the continuation pattern.",
    };
  }

  return {
    role: "supporting-rule-evidence",
    title: "Supporting rule evidence",
    description:
      "This segment was flagged by the prototype rule and is available for review.",
  };
}

export function buildRuleEvidenceReasons(segment) {
  const reasons = [];

  if (segment.detection?.speedFlagged) {
    reasons.push("Estimated speed triggered the prototype speed threshold.");
  }

  if (segment.detection?.headingFlagged) {
    reasons.push("Heading change triggered the prototype heading threshold.");
  }

  if (reasons.length === 0) {
    reasons.push("Flagged by the threshold-based prototype rule.");
  }

  return reasons;
}

export function createRuleEvidenceReviewItems(
  ruleFlaggedSegments,
  primarySegment = PRIMARY_ROUTESENSE_ANOMALY
) {
  return ruleFlaggedSegments.map((segment) => {
    const relation = classifyRuleEvidenceSegment(segment, primarySegment);

    return {
      id: `rule-evidence-${segment.fromOrder}-${segment.toOrder}`,
      segmentKey: getSegmentKey(segment.fromOrder, segment.toOrder),
      label: `Point ${segment.fromOrder} → Point ${segment.toOrder}`,
      fromOrder: segment.fromOrder,
      toOrder: segment.toOrder,

      role: relation.role,
      title: relation.title,
      description: relation.description,

      isPrimaryAnomaly: relation.role === "primary-anomaly",
      isSupportingEvidence: relation.role !== "primary-anomaly",

      triggers: {
        speed: Boolean(segment.detection?.speedFlagged),
        heading: Boolean(segment.detection?.headingFlagged)
      },

      reasons: segment.reasons ?? buildRuleEvidenceReasons(segment),

      metrics: {
        estimatedSpeed: segment.estimatedSpeed,
        headingChange: segment.headingChange
      }
    };
  });
}
