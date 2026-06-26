// AIS ingestion boundary: raw source records -> canonical RouteSense points.
// Pure functions only. No ArcGIS, DOM, rendering, or anomaly interpretation.

export const COMMON_AIS_FIELD_MAP = Object.freeze({
  vesselId: "MMSI",
  timestamp: "BaseDateTime",
  latitude: "LAT",
  longitude: "LON",
  sog: "SOG",
  cog: "COG",
  heading: "Heading",
  navigationalStatus: "Status"
});

export const AIS_TIMESTAMP_MODES = Object.freeze({
  EXPLICIT_ZONE: "explicit-zone",
  ASSUME_UTC: "assume-utc"
});

const EXPLICIT_TIME_ZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;

/**
 * Canonical RouteSense trajectory point produced by the AIS boundary.
 *
 * Reported AIS measurements stay under `reported`; movement metrics computed
 * by RouteSense belong to derived segment objects in analysis.js.
 *
 * @typedef {Object} CanonicalTrajectoryPoint
 * @property {string} id
 * @property {number} order
 * @property {string} name
 * @property {string} vesselId
 * @property {string} timestamp ISO-8601 UTC timestamp
 * @property {number} latitude
 * @property {number} longitude
 * @property {{
 *   sogKnots: number | null,
 *   cogDegrees: number | null,
 *   headingDegrees: number | null,
 *   navigationalStatus: {code: number | null, text: string | null}
 * }} reported
 * @property {{datasetId: string, rowIndex: number, recordId: string | null}} source
 * @property {string | null} note
 */

export class AisValidationError extends Error {
  constructor(issues, message = "AIS validation failed.") {
    super(message);
    this.name = "AisValidationError";
    this.issues = issues;
  }
}

function isBlank(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function issue(code, rowIndex, field, value, message) {
  return { code, rowIndex, field, value, message };
}

function readMappedValue(rawRecord, fieldMap, canonicalField) {
  const sourceField = fieldMap[canonicalField];
  return sourceField == null ? undefined : rawRecord[sourceField];
}

function normalizeVesselId(value, { rowIndex, sourceField }) {
  if (isBlank(value)) {
    throw new AisValidationError([
      issue(
        "MISSING_REQUIRED_FIELD",
        rowIndex,
        sourceField,
        value,
        "Vessel identifier is required."
      )
    ]);
  }

  return String(value).trim();
}

function normalizeRequiredNumber(value, {
  rowIndex,
  sourceField,
  canonicalField,
  minimum,
  maximum
}) {
  if (isBlank(value)) {
    throw new AisValidationError([
      issue(
        "MISSING_REQUIRED_FIELD",
        rowIndex,
        sourceField,
        value,
        `${canonicalField} is required.`
      )
    ]);
  }

  const numericValue = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(numericValue)) {
    throw new AisValidationError([
      issue(
        `INVALID_${canonicalField.toUpperCase()}`,
        rowIndex,
        sourceField,
        value,
        `${canonicalField} must be a finite number.`
      )
    ]);
  }

  if (numericValue < minimum || numericValue > maximum) {
    throw new AisValidationError([
      issue(
        `INVALID_${canonicalField.toUpperCase()}`,
        rowIndex,
        sourceField,
        value,
        `${canonicalField} must be between ${minimum} and ${maximum}.`
      )
    ]);
  }

  return numericValue;
}

function normalizeTimestamp(value, {
  rowIndex,
  sourceField,
  timestampMode
}) {
  if (isBlank(value)) {
    throw new AisValidationError([
      issue(
        "MISSING_REQUIRED_FIELD",
        rowIndex,
        sourceField,
        value,
        "Timestamp is required."
      )
    ]);
  }

  let timestampText = String(value).trim().replace(" ", "T");
  const hasExplicitTimeZone = EXPLICIT_TIME_ZONE_PATTERN.test(timestampText);

  if (timestampMode === AIS_TIMESTAMP_MODES.EXPLICIT_ZONE && !hasExplicitTimeZone) {
    throw new AisValidationError([
      issue(
        "TIMESTAMP_TIME_ZONE_REQUIRED",
        rowIndex,
        sourceField,
        value,
        "Timestamp must include Z or an explicit UTC offset."
      )
    ]);
  }

  if (timestampMode === AIS_TIMESTAMP_MODES.ASSUME_UTC && !hasExplicitTimeZone) {
    timestampText += "Z";
  }

  const parsed = new Date(timestampText);

  if (Number.isNaN(parsed.getTime())) {
    throw new AisValidationError([
      issue(
        "INVALID_TIMESTAMP",
        rowIndex,
        sourceField,
        value,
        "Timestamp must be a valid date and time."
      )
    ]);
  }

  return parsed.toISOString();
}

function normalizeOptionalMeasurement(value, {
  rowIndex,
  sourceField,
  code,
  label,
  minimum,
  maximumExclusive,
  unavailableValue,
  integer = false
}) {
  if (isBlank(value)) return null;

  const numericValue = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(numericValue)) {
    throw new AisValidationError([
      issue(code, rowIndex, sourceField, value, `${label} must be a finite number.`)
    ]);
  }

  if (numericValue === unavailableValue) return null;

  if (integer && !Number.isInteger(numericValue)) {
    throw new AisValidationError([
      issue(code, rowIndex, sourceField, value, `${label} must be an integer.`)
    ]);
  }

  if (numericValue < minimum || numericValue >= maximumExclusive) {
    throw new AisValidationError([
      issue(
        code,
        rowIndex,
        sourceField,
        value,
        `${label} must be at least ${minimum} and less than ${maximumExclusive}.`
      )
    ]);
  }

  return numericValue;
}

function normalizeNavigationalStatus(value) {
  if (isBlank(value)) {
    return { code: null, text: null };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { code: value, text: null };
  }

  const text = String(value).trim();

  if (/^-?\d+$/.test(text)) {
    return { code: Number(text), text: null };
  }

  return { code: null, text };
}

function collectRecordIssues(rawRecord, options) {
  try {
    return { point: normalizeAisRecord(rawRecord, options), issues: [] };
  } catch (error) {
    if (error instanceof AisValidationError) {
      return { point: null, issues: error.issues };
    }
    throw error;
  }
}

/**
 * Normalize one raw AIS observation.
 *
 * For a complete trajectory, prefer normalizeAisTrajectory(), which sorts,
 * deduplicates, validates vessel consistency, and assigns final point order.
 */
export function normalizeAisRecord(rawRecord, {
  datasetId = "unknown-ais-dataset",
  fieldMap = COMMON_AIS_FIELD_MAP,
  timestampMode = AIS_TIMESTAMP_MODES.EXPLICIT_ZONE,
  rowIndex = 0,
  order = rowIndex + 1
} = {}) {
  if (rawRecord == null || typeof rawRecord !== "object" || Array.isArray(rawRecord)) {
    throw new AisValidationError([
      issue(
        "INVALID_RECORD",
        rowIndex,
        null,
        rawRecord,
        "AIS record must be an object."
      )
    ]);
  }

  if (!Object.values(AIS_TIMESTAMP_MODES).includes(timestampMode)) {
    throw new TypeError(`Unsupported AIS timestamp mode: ${timestampMode}`);
  }

  const vesselField = fieldMap.vesselId;
  const timestampField = fieldMap.timestamp;
  const latitudeField = fieldMap.latitude;
  const longitudeField = fieldMap.longitude;

  const vesselId = normalizeVesselId(
    readMappedValue(rawRecord, fieldMap, "vesselId"),
    { rowIndex, sourceField: vesselField }
  );

  const timestamp = normalizeTimestamp(
    readMappedValue(rawRecord, fieldMap, "timestamp"),
    { rowIndex, sourceField: timestampField, timestampMode }
  );

  const latitude = normalizeRequiredNumber(
    readMappedValue(rawRecord, fieldMap, "latitude"),
    {
      rowIndex,
      sourceField: latitudeField,
      canonicalField: "latitude",
      minimum: -90,
      maximum: 90
    }
  );

  const longitude = normalizeRequiredNumber(
    readMappedValue(rawRecord, fieldMap, "longitude"),
    {
      rowIndex,
      sourceField: longitudeField,
      canonicalField: "longitude",
      minimum: -180,
      maximum: 180
    }
  );

  const sogKnots = normalizeOptionalMeasurement(
    readMappedValue(rawRecord, fieldMap, "sog"),
    {
      rowIndex,
      sourceField: fieldMap.sog,
      code: "INVALID_SOG",
      label: "SOG",
      minimum: 0,
      maximumExclusive: 102.3,
      unavailableValue: 102.3
    }
  );

  const cogDegrees = normalizeOptionalMeasurement(
    readMappedValue(rawRecord, fieldMap, "cog"),
    {
      rowIndex,
      sourceField: fieldMap.cog,
      code: "INVALID_COG",
      label: "COG",
      minimum: 0,
      maximumExclusive: 360,
      unavailableValue: 360
    }
  );

  const headingDegrees = normalizeOptionalMeasurement(
    readMappedValue(rawRecord, fieldMap, "heading"),
    {
      rowIndex,
      sourceField: fieldMap.heading,
      code: "INVALID_HEADING",
      label: "Heading",
      minimum: 0,
      maximumExclusive: 360,
      unavailableValue: 511,
      integer: true
    }
  );

  const navigationalStatus = normalizeNavigationalStatus(
    readMappedValue(rawRecord, fieldMap, "navigationalStatus")
  );

  return {
    id: `${vesselId}@${timestamp}`,
    order,
    name: `Vessel Point ${order}`,
    vesselId,
    timestamp,
    latitude,
    longitude,
    reported: {
      sogKnots,
      cogDegrees,
      headingDegrees,
      navigationalStatus
    },
    source: {
      datasetId,
      rowIndex,
      recordId: null
    },
    note: null
  };
}

/**
 * Normalize one vessel trajectory.
 *
 * This boundary does not detect anomalies and does not create RouteSense
 * movement metrics. It only produces validated, chronological observations.
 */
export function normalizeAisTrajectory(rawRecords, {
  datasetId = "unknown-ais-dataset",
  fieldMap = COMMON_AIS_FIELD_MAP,
  timestampMode = AIS_TIMESTAMP_MODES.EXPLICIT_ZONE,
  minimumPoints = 2
} = {}) {
  if (!Array.isArray(rawRecords)) {
    throw new TypeError("rawRecords must be an array.");
  }

  const normalizedRecords = [];
  const validationIssues = [];

  rawRecords.forEach((rawRecord, rowIndex) => {
    const { point, issues } = collectRecordIssues(rawRecord, {
      datasetId,
      fieldMap,
      timestampMode,
      rowIndex
    });

    if (point) normalizedRecords.push(point);
    validationIssues.push(...issues);
  });

  if (validationIssues.length > 0) {
    throw new AisValidationError(validationIssues);
  }

  const vesselIds = [...new Set(normalizedRecords.map((point) => point.vesselId))];

  if (vesselIds.length > 1) {
    throw new AisValidationError([
      issue(
        "MIXED_VESSELS",
        null,
        fieldMap.vesselId,
        vesselIds,
        "One normalized trajectory must contain observations from exactly one vessel."
      )
    ]);
  }

  const sortedRecords = [...normalizedRecords].sort((a, b) => {
    const timeDifference = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    return timeDifference || a.source.rowIndex - b.source.rowIndex;
  });

  const points = [];
  const warnings = [];
  let duplicateCount = 0;

  for (const point of sortedRecords) {
    const previousPoint = points.at(-1);

    if (previousPoint && previousPoint.timestamp === point.timestamp) {
      const sameCoordinates =
        previousPoint.latitude === point.latitude &&
        previousPoint.longitude === point.longitude;

      if (!sameCoordinates) {
        throw new AisValidationError([
          issue(
            "CONFLICTING_TIMESTAMP",
            point.source.rowIndex,
            fieldMap.timestamp,
            point.timestamp,
            `Rows ${previousPoint.source.rowIndex} and ${point.source.rowIndex} have the same vessel and timestamp but different coordinates.`
          )
        ]);
      }

      duplicateCount += 1;
      warnings.push({
        code: "DUPLICATE_OBSERVATION",
        rowIndex: point.source.rowIndex,
        duplicateOfRowIndex: previousPoint.source.rowIndex,
        message: "Duplicate AIS observation removed."
      });
      continue;
    }

    points.push(point);
  }

  if (points.length < minimumPoints) {
    throw new AisValidationError([
      issue(
        "INSUFFICIENT_OBSERVATIONS",
        null,
        null,
        points.length,
        `Trajectory requires at least ${minimumPoints} unique observations.`
      )
    ]);
  }

  const orderedPoints = points.map((point, index) => {
    const order = index + 1;
    return {
      ...point,
      order,
      name: `Vessel Point ${order}`
    };
  });

  return {
    points: orderedPoints,
    warnings,
    stats: {
      inputCount: rawRecords.length,
      outputCount: orderedPoints.length,
      duplicateCount
    }
  };
}
