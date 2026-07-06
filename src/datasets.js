// Dataset adapters and selection boundary.
//
// This module keeps source-specific ingestion separate from the application
// composition root. Synthetic fixtures and normalized AIS trajectories share a
// small dataset descriptor, but they do not share analysis assumptions.
// Optional map framing and provenance travel with each descriptor as well.

import {
  AIS_TIMESTAMP_MODES,
  COMMON_AIS_FIELD_MAP,
  normalizeAisTrajectory
} from "./ais.js";
import {
  ANOMALY_SEGMENT,
  MAP_CONFIG,
  NORMAL_BASELINE_RANGE,
  THRESHOLD_RULE
} from "./config.js";
import { samplePoints, trajectoryMetadata } from "./data.js";
import {
  DEFAULT_MAX_COMPARISON_GAP_SECONDS,
  MEASUREMENT_COMPARISON_BASIS
} from "./measurement-review.js";
import {
  GOTHENBURG_AIS_FIELD_MAP,
  GOTHENBURG_AIS_PROVENANCE,
  GOTHENBURG_AIS_RAW_RECORDS,
  GOTHENBURG_AIS_SAMPLE_ID
} from "./real-ais-sample.js";

export const DATASET_KINDS = Object.freeze({
  SYNTHETIC: "synthetic",
  REAL_AIS: "real-ais"
});

export const DATASET_REVIEW_STATUS = Object.freeze({
  FIXTURE: "fixture",
  UNREVIEWED: "unreviewed",
  REVIEWED: "reviewed"
});

export const SYNTHETIC_PHASE8_DATASET_ID = "synthetic-phase8";
export const REAL_GOTHENBURG_DATASET_ID = GOTHENBURG_AIS_SAMPLE_ID;

export class DatasetSelectionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DatasetSelectionError";
    this.details = details;
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function requirePointArray(points, label = "points") {
  if (!Array.isArray(points) || points.length < 2) {
    throw new TypeError(`${label} must contain at least two trajectory points.`);
  }

  return points;
}

function copyOptionalObject(value, label) {
  if (value == null) return null;

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object or null.`);
  }

  return { ...value };
}

function createAnalysisProfile({
  reviewStatus,
  anomalySegment = null,
  baselineRange = null,
  thresholdRule = null
}) {
  return {
    reviewStatus,
    anomalySegment,
    baselineRange,
    thresholdRule
  };
}

/**
 * Adapt the controlled Phase 8 fixture into the shared dataset descriptor.
 *
 * Synthetic timestamps and narrative assumptions are preserved exactly. They
 * are deliberately not passed through the AIS normalizer.
 */
export function adaptSyntheticDataset({
  id,
  label,
  metadata,
  points,
  anomalySegment,
  baselineRange,
  thresholdRule,
  mapView = null,
  provenance = null
}) {
  const datasetId = requireNonEmptyString(id, "Synthetic dataset id");
  const datasetLabel = requireNonEmptyString(label, "Synthetic dataset label");
  requirePointArray(points, "Synthetic dataset points");

  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Synthetic dataset metadata must be an object.");
  }

  if (!anomalySegment || !baselineRange || !thresholdRule) {
    throw new TypeError(
      "Synthetic fixture datasets require explicit anomaly, baseline, and threshold configuration."
    );
  }

  return {
    id: datasetId,
    label: datasetLabel,
    kind: DATASET_KINDS.SYNTHETIC,
    metadata: { ...metadata },
    points,
    mapView: copyOptionalObject(mapView, "Synthetic dataset mapView"),
    provenance: copyOptionalObject(provenance, "Synthetic dataset provenance"),
    measurementReviewProfile: null,
    ingestion: null,
    analysisProfile: createAnalysisProfile({
      reviewStatus: DATASET_REVIEW_STATUS.FIXTURE,
      anomalySegment,
      baselineRange,
      thresholdRule
    })
  };
}

/**
 * Adapt source-specific static AIS records into the shared dataset descriptor.
 *
 * The adapter delegates all record validation and normalization to ais.js. A
 * newly adapted real trajectory is always unreviewed and receives no anomaly,
 * baseline, or threshold interpretation automatically.
 */
export function adaptRealAisDataset({
  id,
  label,
  rawRecords,
  metadata = {},
  fieldMap = COMMON_AIS_FIELD_MAP,
  timestampMode = AIS_TIMESTAMP_MODES.EXPLICIT_ZONE,
  minimumPoints = 2,
  mapView = null,
  provenance = null,
  measurementReviewProfile = null
}) {
  const datasetId = requireNonEmptyString(id, "Real AIS dataset id");
  const datasetLabel = requireNonEmptyString(label, "Real AIS dataset label");

  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Real AIS dataset metadata must be an object.");
  }

  const customMeasurementProfile = copyOptionalObject(
    measurementReviewProfile,
    "Real AIS dataset measurementReviewProfile"
  );

  const normalized = normalizeAisTrajectory(rawRecords, {
    datasetId,
    fieldMap,
    timestampMode,
    minimumPoints
  });

  const vesselId = normalized.points[0].vesselId;

  return {
    id: datasetId,
    label: datasetLabel,
    kind: DATASET_KINDS.REAL_AIS,
    metadata: {
      routeName: metadata.routeName ?? datasetLabel,
      vesselId,
      description:
        metadata.description ??
        "Static AIS trajectory normalized for RouteSense. No anomaly has been validated.",
      ...metadata,
      vesselId
    },
    points: normalized.points,
    mapView: copyOptionalObject(mapView, "Real AIS dataset mapView"),
    provenance: copyOptionalObject(provenance, "Real AIS dataset provenance"),
    measurementReviewProfile: {
      comparisonBasis:
        customMeasurementProfile?.comparisonBasis ??
        MEASUREMENT_COMPARISON_BASIS.DESTINATION_OBSERVATION,
      maxGapSeconds:
        customMeasurementProfile?.maxGapSeconds ??
        DEFAULT_MAX_COMPARISON_GAP_SECONDS
    },
    ingestion: {
      warnings: normalized.warnings,
      stats: normalized.stats
    },
    analysisProfile: createAnalysisProfile({
      reviewStatus: DATASET_REVIEW_STATUS.UNREVIEWED
    })
  };
}

/**
 * Create a small immutable registry API around dataset descriptors.
 * Dataset objects themselves remain ordinary objects so tests and later review
 * steps can create revised descriptors without mutating a global singleton.
 */
export function createDatasetRegistry(datasets) {
  if (!Array.isArray(datasets)) {
    throw new TypeError("datasets must be an array.");
  }

  const byId = new Map();

  datasets.forEach((dataset) => {
    if (dataset == null || typeof dataset !== "object" || Array.isArray(dataset)) {
      throw new TypeError("Each dataset registry entry must be an object.");
    }

    const id = requireNonEmptyString(dataset.id, "Dataset id");

    if (byId.has(id)) {
      throw new DatasetSelectionError(`Duplicate dataset id: ${id}`, { datasetId: id });
    }

    byId.set(id, dataset);
  });

  return Object.freeze({
    ids: Object.freeze([...byId.keys()]),
    has(datasetId) {
      return byId.has(datasetId);
    },
    get(datasetId) {
      return byId.get(datasetId) ?? null;
    }
  });
}

/**
 * Select a dataset by id, optionally falling back to a known safe fixture.
 * The return value makes fallback explicit so the caller can surface it.
 */
export function selectDataset(registry, requestedId, { fallbackId = null } = {}) {
  if (!registry || typeof registry.get !== "function") {
    throw new TypeError("registry must be created by createDatasetRegistry().");
  }

  const requestedDataset = registry.get(requestedId);

  if (requestedDataset) {
    return {
      dataset: requestedDataset,
      requestedId,
      selectedId: requestedDataset.id,
      usedFallback: false
    };
  }

  const fallbackDataset = fallbackId == null ? null : registry.get(fallbackId);

  if (fallbackDataset) {
    return {
      dataset: fallbackDataset,
      requestedId,
      selectedId: fallbackDataset.id,
      usedFallback: true
    };
  }

  throw new DatasetSelectionError(
    `Dataset "${requestedId}" is not registered and no valid fallback is available.`,
    {
      requestedId,
      fallbackId,
      availableDatasetIds: registry.ids
    }
  );
}

/**
 * Resolve the dataset request from configuration plus an optional URL query.
 * A `?dataset=<id>` value is useful for portfolio demonstrations without
 * changing the safe synthetic default in source control.
 */
export function resolveRequestedDatasetId(configuredId, search = "") {
  const safeConfiguredId = requireNonEmptyString(configuredId, "Configured dataset id");
  const query = new URLSearchParams(search);
  const requestedId = query.get("dataset")?.trim();

  return requestedId || safeConfiguredId;
}

/**
 * Return analysis options only when the selected dataset explicitly owns a
 * complete, reviewed/configured analysis profile.
 */
export function getDatasetAnalysisOptions(dataset) {
  const profile = dataset?.analysisProfile;

  if (
    !profile ||
    profile.reviewStatus === DATASET_REVIEW_STATUS.UNREVIEWED ||
    !profile.anomalySegment ||
    !profile.baselineRange ||
    !profile.thresholdRule
  ) {
    return null;
  }

  return {
    anomalySegment: profile.anomalySegment,
    baselineRange: profile.baselineRange,
    thresholdRule: profile.thresholdRule
  };
}

/**
 * Human-readable badge for the dataset switcher. The badge answers "what am I
 * looking at" (controlled fixture vs. real source data) without implying any
 * detection capability for real AIS.
 */
export function getDatasetBadgeLabel(dataset) {
  if (dataset?.kind === DATASET_KINDS.SYNTHETIC) {
    return "Synthetic fixture";
  }

  if (dataset?.kind === DATASET_KINDS.REAL_AIS) {
    return dataset.analysisProfile?.reviewStatus === DATASET_REVIEW_STATUS.REVIEWED
      ? "Real AIS — reviewed"
      : "Real AIS — unreviewed";
  }

  return "Unclassified dataset";
}

/**
 * Produce the dataset switcher's option list from a registry.
 * Pure data out: the renderer decides markup, main.js decides behavior
 * (updating `?dataset=` and reloading — never a runtime swap).
 */
export function buildDatasetSwitcherOptions(registry, activeDatasetId) {
  if (!registry || typeof registry.get !== "function" || !Array.isArray(registry.ids)) {
    throw new TypeError("registry must be created by createDatasetRegistry().");
  }

  return registry.ids.map((id) => {
    const dataset = registry.get(id);

    return {
      id,
      label: dataset.label,
      kind: dataset.kind,
      reviewStatus: dataset.analysisProfile?.reviewStatus ?? null,
      badgeLabel: getDatasetBadgeLabel(dataset),
      isActive: id === activeDatasetId
    };
  });
}

/**
 * Short provenance line (source · region · year) for the active dataset,
 * pulled from the descriptor. Descriptive only; missing fields stay explicit
 * rather than being invented.
 */
export function summarizeDatasetProvenance(dataset) {
  const provenance = dataset?.provenance;

  if (!provenance) {
    return "No provenance recorded for this dataset.";
  }

  const source = provenance.publisher ?? "Source not documented";
  const region = provenance.geographicArea ?? "Region not documented";
  const year =
    typeof provenance.sourceDate === "string" && provenance.sourceDate.length >= 4
      ? provenance.sourceDate.slice(0, 4)
      : "Year not documented";

  return `${source} · ${region} · ${year}`;
}

export const syntheticPhase8Dataset = adaptSyntheticDataset({
  id: SYNTHETIC_PHASE8_DATASET_ID,
  label: "Phase 8 synthetic fixture",
  metadata: trajectoryMetadata,
  points: samplePoints,
  anomalySegment: ANOMALY_SEGMENT,
  baselineRange: NORMAL_BASELINE_RANGE,
  thresholdRule: THRESHOLD_RULE,
  mapView: MAP_CONFIG,
  provenance: {
    publisher: "RouteSense project (hand-authored fixture)",
    geographicArea: "Halifax Harbour, Canada (fictional trajectory)",
    sourceDate: "2026-04-28"
  }
});

export const gothenburgRealAisDataset = adaptRealAisDataset({
  id: REAL_GOTHENBURG_DATASET_ID,
  label: "Gothenburg real AIS sample (2017)",
  rawRecords: GOTHENBURG_AIS_RAW_RECORDS,
  fieldMap: GOTHENBURG_AIS_FIELD_MAP,
  timestampMode: AIS_TIMESTAMP_MODES.ASSUME_UTC,
  metadata: {
    routeName: "NORDIC HAMBURG near Gothenburg",
    vesselName: "NORDIC HAMBURG",
    shipType: "Cargo",
    description:
      "Four consecutive real AIS observations integrated for display and ingestion review. No anomaly has been validated."
  },
  mapView: {
    basemap: MAP_CONFIG.basemap,
    center: [11.8116, 57.6780],
    zoom: 14
  },
  provenance: GOTHENBURG_AIS_PROVENANCE
});

export const DATASET_REGISTRY = createDatasetRegistry([
  syntheticPhase8Dataset,
  gothenburgRealAisDataset
]);
