import test from "node:test";
import assert from "node:assert/strict";

import {
  DATASET_KINDS,
  DATASET_REGISTRY,
  DATASET_REVIEW_STATUS,
  DatasetSelectionError,
  REAL_GOTHENBURG_DATASET_ID,
  SYNTHETIC_PHASE8_DATASET_ID,
  adaptRealAisDataset,
  adaptSyntheticDataset,
  buildDatasetSwitcherOptions,
  createDatasetRegistry,
  getDatasetAnalysisOptions,
  gothenburgRealAisDataset,
  selectDataset,
  summarizeDatasetProvenance,
  syntheticPhase8Dataset
} from "../src/datasets.js";
import {
  ANOMALY_SEGMENT,
  NORMAL_BASELINE_RANGE,
  THRESHOLD_RULE
} from "../src/config.js";
import { samplePoints, trajectoryMetadata } from "../src/data.js";

function makeAisRecords() {
  return [
    {
      MMSI: "316000001",
      BaseDateTime: "2026-06-24T12:10:00Z",
      LAT: "44.65",
      LON: "-63.57",
      SOG: "7.3",
      COG: "130",
      Heading: "129",
      Status: "0"
    },
    {
      MMSI: "316000001",
      BaseDateTime: "2026-06-24T12:00:00Z",
      LAT: "44.64",
      LON: "-63.58",
      SOG: "7.1",
      COG: "128",
      Heading: "127",
      Status: "0"
    }
  ];
}

function makeRealDataset(overrides = {}) {
  return adaptRealAisDataset({
    id: "real-test-trajectory",
    label: "Test AIS trajectory",
    rawRecords: makeAisRecords(),
    ...overrides
  });
}

test("adapts the Phase 8 synthetic fixture without re-normalizing it", () => {
  const dataset = adaptSyntheticDataset({
    id: SYNTHETIC_PHASE8_DATASET_ID,
    label: "Synthetic fixture",
    metadata: trajectoryMetadata,
    points: samplePoints,
    anomalySegment: ANOMALY_SEGMENT,
    baselineRange: NORMAL_BASELINE_RANGE,
    thresholdRule: THRESHOLD_RULE
  });

  assert.equal(dataset.kind, DATASET_KINDS.SYNTHETIC);
  assert.equal(dataset.points, samplePoints);
  assert.equal(dataset.points[0].timestamp, "2026-04-28 10:00");
  assert.equal(dataset.ingestion, null);
  assert.equal(dataset.analysisProfile.reviewStatus, DATASET_REVIEW_STATUS.FIXTURE);
  assert.equal(dataset.analysisProfile.anomalySegment, ANOMALY_SEGMENT);
});

test("exports the registered synthetic dataset as the safe default fixture", () => {
  assert.equal(syntheticPhase8Dataset.id, SYNTHETIC_PHASE8_DATASET_ID);
  assert.equal(syntheticPhase8Dataset.points, samplePoints);
  assert.equal(syntheticPhase8Dataset.analysisProfile.anomalySegment.fromOrder, 6);
  assert.equal(syntheticPhase8Dataset.analysisProfile.anomalySegment.toOrder, 7);
});

test("adapts static AIS records through the Phase 9.1 normalizer", () => {
  const dataset = makeRealDataset({
    metadata: { routeName: "Adapter test route" }
  });

  assert.equal(dataset.kind, DATASET_KINDS.REAL_AIS);
  assert.equal(dataset.metadata.routeName, "Adapter test route");
  assert.equal(dataset.metadata.vesselId, "316000001");
  assert.deepEqual(
    dataset.points.map((point) => point.timestamp),
    ["2026-06-24T12:00:00.000Z", "2026-06-24T12:10:00.000Z"]
  );
  assert.equal(dataset.points[0].source.datasetId, "real-test-trajectory");
  assert.equal(dataset.ingestion.stats.inputCount, 2);
  assert.equal(dataset.ingestion.stats.outputCount, 2);
});

test("keeps AIS-reported measurements separate from RouteSense-derived metrics", () => {
  const dataset = makeRealDataset();
  const point = dataset.points[0];

  assert.equal(typeof point.reported.sogKnots, "number");
  assert.equal(typeof point.reported.cogDegrees, "number");
  assert.equal("estimatedSpeed" in point, false);
  assert.equal("headingChange" in point, false);
});

test("marks every newly adapted real AIS dataset as unreviewed", () => {
  const dataset = makeRealDataset();

  assert.deepEqual(dataset.analysisProfile, {
    reviewStatus: DATASET_REVIEW_STATUS.UNREVIEWED,
    anomalySegment: null,
    baselineRange: null,
    thresholdRule: null
  });
  assert.equal(getDatasetAnalysisOptions(dataset), null);
});

test("returns dataset-owned analysis options for the synthetic fixture", () => {
  assert.deepEqual(getDatasetAnalysisOptions(syntheticPhase8Dataset), {
    anomalySegment: ANOMALY_SEGMENT,
    baselineRange: NORMAL_BASELINE_RANGE,
    thresholdRule: THRESHOLD_RULE
  });
});

test("selects a requested registered dataset without fallback", () => {
  const realDataset = makeRealDataset();
  const registry = createDatasetRegistry([syntheticPhase8Dataset, realDataset]);
  const selection = selectDataset(registry, realDataset.id, {
    fallbackId: SYNTHETIC_PHASE8_DATASET_ID
  });

  assert.equal(selection.dataset, realDataset);
  assert.equal(selection.selectedId, realDataset.id);
  assert.equal(selection.usedFallback, false);
});

test("falls back explicitly to the synthetic fixture for an unknown id", () => {
  const registry = createDatasetRegistry([syntheticPhase8Dataset]);
  const selection = selectDataset(registry, "missing-real-dataset", {
    fallbackId: SYNTHETIC_PHASE8_DATASET_ID
  });

  assert.equal(selection.dataset, syntheticPhase8Dataset);
  assert.equal(selection.requestedId, "missing-real-dataset");
  assert.equal(selection.selectedId, SYNTHETIC_PHASE8_DATASET_ID);
  assert.equal(selection.usedFallback, true);
});

test("fails selection when neither requested nor fallback dataset exists", () => {
  const registry = createDatasetRegistry([syntheticPhase8Dataset]);

  assert.throws(
    () => selectDataset(registry, "missing", { fallbackId: "also-missing" }),
    (error) => {
      assert.ok(error instanceof DatasetSelectionError);
      assert.deepEqual(error.details.availableDatasetIds, [SYNTHETIC_PHASE8_DATASET_ID]);
      return true;
    }
  );
});

test("rejects duplicate dataset ids in a registry", () => {
  assert.throws(
    () => createDatasetRegistry([syntheticPhase8Dataset, syntheticPhase8Dataset]),
    (error) => {
      assert.ok(error instanceof DatasetSelectionError);
      assert.equal(error.details.datasetId, SYNTHETIC_PHASE8_DATASET_ID);
      return true;
    }
  );
});

test("builds switcher options in registry order with labels, badges, and active flag", () => {
  const realDataset = makeRealDataset();
  const registry = createDatasetRegistry([syntheticPhase8Dataset, realDataset]);
  const options = buildDatasetSwitcherOptions(registry, SYNTHETIC_PHASE8_DATASET_ID);

  assert.deepEqual(options, [
    {
      id: SYNTHETIC_PHASE8_DATASET_ID,
      label: "Phase 8 synthetic fixture",
      kind: DATASET_KINDS.SYNTHETIC,
      reviewStatus: DATASET_REVIEW_STATUS.FIXTURE,
      badgeLabel: "Synthetic fixture",
      isActive: true
    },
    {
      id: realDataset.id,
      label: "Test AIS trajectory",
      kind: DATASET_KINDS.REAL_AIS,
      reviewStatus: DATASET_REVIEW_STATUS.UNREVIEWED,
      badgeLabel: "Real AIS — unreviewed",
      isActive: false
    }
  ]);
});

test("marks exactly one option active and none for an unknown active id", () => {
  const realDataset = makeRealDataset();
  const registry = createDatasetRegistry([syntheticPhase8Dataset, realDataset]);

  const realActive = buildDatasetSwitcherOptions(registry, realDataset.id);
  assert.deepEqual(realActive.map((option) => option.isActive), [false, true]);

  const unknownActive = buildDatasetSwitcherOptions(registry, "not-registered");
  assert.deepEqual(unknownActive.map((option) => option.isActive), [false, false]);
});

test("exposes both application datasets to the switcher with distinguishing badges", () => {
  const options = buildDatasetSwitcherOptions(DATASET_REGISTRY, REAL_GOTHENBURG_DATASET_ID);

  assert.deepEqual(
    options.map((option) => option.id),
    [SYNTHETIC_PHASE8_DATASET_ID, REAL_GOTHENBURG_DATASET_ID]
  );
  assert.deepEqual(
    options.map((option) => option.badgeLabel),
    ["Synthetic fixture", "Real AIS — unreviewed"]
  );
  assert.deepEqual(
    options.map((option) => option.isActive),
    [false, true]
  );
});

test("rejects switcher option requests without a valid registry", () => {
  assert.throws(() => buildDatasetSwitcherOptions(null, "any"), TypeError);
  assert.throws(() => buildDatasetSwitcherOptions({}, "any"), TypeError);
});

test("summarizes descriptor provenance as source, region, and year", () => {
  assert.equal(
    summarizeDatasetProvenance(gothenburgRealAisDataset),
    "Danish Maritime Authority · Near Gothenburg, Sweden · 2017"
  );
  assert.equal(
    summarizeDatasetProvenance(syntheticPhase8Dataset),
    "RouteSense project (hand-authored fixture) · Halifax Harbour, Canada (fictional trajectory) · 2026"
  );
});

test("keeps missing provenance explicit instead of inventing it", () => {
  const withoutProvenance = makeRealDataset();
  assert.equal(
    summarizeDatasetProvenance(withoutProvenance),
    "No provenance recorded for this dataset."
  );

  const partialProvenance = makeRealDataset({
    provenance: { geographicArea: "Test area" }
  });
  assert.equal(
    summarizeDatasetProvenance(partialProvenance),
    "Source not documented · Test area · Year not documented"
  );
});
