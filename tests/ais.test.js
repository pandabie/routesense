import test from "node:test";
import assert from "node:assert/strict";

import {
  AIS_TIMESTAMP_MODES,
  AisValidationError,
  normalizeAisRecord,
  normalizeAisTrajectory
} from "../src/ais.js";

function makeRecord(overrides = {}) {
  return {
    MMSI: "316000001",
    BaseDateTime: "2026-06-24T12:00:00Z",
    LAT: "44.6488",
    LON: "-63.5752",
    SOG: "7.4",
    COG: "132.5",
    Heading: "130",
    Status: "0",
    ...overrides
  };
}

function issueCodes(error) {
  assert.ok(error instanceof AisValidationError);
  return error.issues.map((item) => item.code);
}

test("normalizes a valid AIS record into the canonical point schema", () => {
  const point = normalizeAisRecord(makeRecord(), {
    datasetId: "contract-test",
    rowIndex: 24,
    order: 3
  });

  assert.equal(point.id, "316000001@2026-06-24T12:00:00.000Z");
  assert.equal(point.order, 3);
  assert.equal(point.name, "Vessel Point 3");
  assert.equal(point.vesselId, "316000001");
  assert.equal(point.timestamp, "2026-06-24T12:00:00.000Z");
  assert.equal(point.latitude, 44.6488);
  assert.equal(point.longitude, -63.5752);
  assert.deepEqual(point.reported, {
    sogKnots: 7.4,
    cogDegrees: 132.5,
    headingDegrees: 130,
    navigationalStatus: { code: 0, text: null }
  });
  assert.deepEqual(point.source, {
    datasetId: "contract-test",
    rowIndex: 24,
    recordId: null
  });

  assert.equal("estimatedSpeed" in point, false);
  assert.equal("headingChange" in point, false);
});

test("reports missing required fields instead of coercing blanks", () => {
  assert.throws(
    () => normalizeAisTrajectory([
      makeRecord(),
      makeRecord({ MMSI: "", BaseDateTime: "2026-06-24T12:10:00Z" })
    ]),
    (error) => {
      assert.deepEqual(issueCodes(error), ["MISSING_REQUIRED_FIELD"]);
      assert.equal(error.issues[0].field, "MMSI");
      assert.equal(error.issues[0].rowIndex, 1);
      return true;
    }
  );
});

test("rejects invalid latitude and longitude values", () => {
  assert.throws(
    () => normalizeAisTrajectory([
      makeRecord({ LAT: 91 }),
      makeRecord({ BaseDateTime: "2026-06-24T12:10:00Z", LON: -181 })
    ]),
    (error) => {
      assert.deepEqual(issueCodes(error), ["INVALID_LATITUDE", "INVALID_LONGITUDE"]);
      return true;
    }
  );
});

test("sorts observations by timestamp before assigning final order", () => {
  const result = normalizeAisTrajectory([
    makeRecord({ BaseDateTime: "2026-06-24T12:20:00Z", LAT: 44.66 }),
    makeRecord({ BaseDateTime: "2026-06-24T12:00:00Z", LAT: 44.64 }),
    makeRecord({ BaseDateTime: "2026-06-24T12:10:00Z", LAT: 44.65 })
  ]);

  assert.deepEqual(
    result.points.map((point) => [point.order, point.timestamp, point.latitude]),
    [
      [1, "2026-06-24T12:00:00.000Z", 44.64],
      [2, "2026-06-24T12:10:00.000Z", 44.65],
      [3, "2026-06-24T12:20:00.000Z", 44.66]
    ]
  );
});

test("removes exact duplicate observations and records a warning", () => {
  const duplicate = makeRecord();
  const result = normalizeAisTrajectory([
    duplicate,
    { ...duplicate },
    makeRecord({ BaseDateTime: "2026-06-24T12:10:00Z", LAT: 44.65 })
  ]);

  assert.equal(result.points.length, 2);
  assert.equal(result.stats.inputCount, 3);
  assert.equal(result.stats.outputCount, 2);
  assert.equal(result.stats.duplicateCount, 1);
  assert.deepEqual(result.warnings, [
    {
      code: "DUPLICATE_OBSERVATION",
      rowIndex: 1,
      duplicateOfRowIndex: 0,
      message: "Duplicate AIS observation removed."
    }
  ]);
});

test("rejects the same vessel and timestamp when coordinates conflict", () => {
  assert.throws(
    () => normalizeAisTrajectory([
      makeRecord(),
      makeRecord({ LAT: 44.7 })
    ]),
    (error) => {
      assert.deepEqual(issueCodes(error), ["CONFLICTING_TIMESTAMP"]);
      return true;
    }
  );
});

test("rejects mixed vessels in a single trajectory", () => {
  assert.throws(
    () => normalizeAisTrajectory([
      makeRecord(),
      makeRecord({ MMSI: "316000002", BaseDateTime: "2026-06-24T12:10:00Z" })
    ]),
    (error) => {
      assert.deepEqual(issueCodes(error), ["MIXED_VESSELS"]);
      return true;
    }
  );
});

test("converts standard AIS unavailable sentinels to null", () => {
  const point = normalizeAisRecord(makeRecord({
    SOG: 102.3,
    COG: 360,
    Heading: 511,
    Status: "Under way using engine"
  }));

  assert.deepEqual(point.reported, {
    sogKnots: null,
    cogDegrees: null,
    headingDegrees: null,
    navigationalStatus: { code: null, text: "Under way using engine" }
  });
});



test("rejects invalid optional AIS measurements", () => {
  assert.throws(
    () => normalizeAisTrajectory([
      makeRecord({ SOG: -1 }),
      makeRecord({ BaseDateTime: "2026-06-24T12:10:00Z", COG: 400 }),
      makeRecord({ BaseDateTime: "2026-06-24T12:20:00Z", Heading: 12.5 })
    ]),
    (error) => {
      assert.deepEqual(issueCodes(error), [
        "INVALID_SOG",
        "INVALID_COG",
        "INVALID_HEADING"
      ]);
      return true;
    }
  );
});

test("requires an explicit timestamp zone by default", () => {
  assert.throws(
    () => normalizeAisRecord(makeRecord({ BaseDateTime: "2026-06-24 12:00:00" })),
    (error) => {
      assert.deepEqual(issueCodes(error), ["TIMESTAMP_TIME_ZONE_REQUIRED"]);
      return true;
    }
  );
});

test("allows a source adapter to declare naive timestamps as UTC", () => {
  const point = normalizeAisRecord(
    makeRecord({ BaseDateTime: "2026-06-24 12:00:00" }),
    { timestampMode: AIS_TIMESTAMP_MODES.ASSUME_UTC }
  );

  assert.equal(point.timestamp, "2026-06-24T12:00:00.000Z");
});
