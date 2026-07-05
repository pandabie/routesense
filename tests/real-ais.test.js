import test from "node:test";
import assert from "node:assert/strict";

import {
  DATASET_REGISTRY,
  DATASET_REVIEW_STATUS,
  REAL_GOTHENBURG_DATASET_ID,
  getDatasetAnalysisOptions,
  gothenburgRealAisDataset,
  resolveRequestedDatasetId,
  selectDataset,
  SYNTHETIC_PHASE8_DATASET_ID
} from "../src/datasets.js";
import {
  buildSegments,
  buildTrajectoryDisplayModel
} from "../src/analysis.js";
import {
  GOTHENBURG_AIS_PROVENANCE,
  GOTHENBURG_AIS_RAW_RECORDS
} from "../src/real-ais-sample.js";
import {
  renderUnreviewedDatasetPanel,
  renderUnreviewedPointPanel,
  renderUnreviewedSegmentPanel
} from "../src/panels.js";

test("bundles four consecutive source-shaped AIS observations with provenance", () => {
  assert.equal(GOTHENBURG_AIS_RAW_RECORDS.length, 4);
  assert.deepEqual(
    GOTHENBURG_AIS_RAW_RECORDS.map((record) => record.Timestamp),
    [
      "2017-07-05 17:32:18",
      "2017-07-05 17:33:18",
      "2017-07-05 17:34:18",
      "2017-07-05 17:35:28"
    ]
  );
  assert.equal(GOTHENBURG_AIS_PROVENANCE.publisher, "Danish Maritime Authority");
  assert.match(GOTHENBURG_AIS_PROVENANCE.intermediary, /MovingPandas/);
  assert.equal(GOTHENBURG_AIS_PROVENANCE.sourceDate, "2017-07-05");
  assert.match(GOTHENBURG_AIS_PROVENANCE.licenseStatus, /Not asserted/);
});

test("registers the real Gothenburg sample beside the synthetic fallback", () => {
  assert.deepEqual(DATASET_REGISTRY.ids, [
    SYNTHETIC_PHASE8_DATASET_ID,
    REAL_GOTHENBURG_DATASET_ID
  ]);
  assert.equal(DATASET_REGISTRY.get(REAL_GOTHENBURG_DATASET_ID), gothenburgRealAisDataset);
});

test("normalizes the static real sample into chronological canonical points", () => {
  const dataset = gothenburgRealAisDataset;

  assert.equal(dataset.points.length, 4);
  assert.deepEqual(dataset.points.map((point) => point.order), [1, 2, 3, 4]);
  assert.deepEqual(
    dataset.points.map((point) => point.timestamp),
    [
      "2017-07-05T17:32:18.000Z",
      "2017-07-05T17:33:18.000Z",
      "2017-07-05T17:34:18.000Z",
      "2017-07-05T17:35:28.000Z"
    ]
  );
  assert.equal(dataset.metadata.vesselId, "210035000");
  assert.equal(dataset.ingestion.stats.inputCount, 4);
  assert.equal(dataset.ingestion.stats.outputCount, 4);
  assert.equal(dataset.ingestion.stats.duplicateCount, 0);
});

test("keeps source SOG and COG on points without creating derived metrics there", () => {
  const firstPoint = gothenburgRealAisDataset.points[0];

  assert.equal(firstPoint.reported.sogKnots, 9.8);
  assert.equal(firstPoint.reported.cogDegrees, 52.8);
  assert.equal(firstPoint.reported.headingDegrees, null);
  assert.equal(firstPoint.reported.navigationalStatus.text, "Under way using engine");
  assert.equal("estimatedSpeed" in firstPoint, false);
  assert.equal("headingChange" in firstPoint, false);
});

test("keeps the real sample unreviewed with no inherited anomaly assumptions", () => {
  assert.deepEqual(gothenburgRealAisDataset.analysisProfile, {
    reviewStatus: DATASET_REVIEW_STATUS.UNREVIEWED,
    anomalySegment: null,
    baselineRange: null,
    thresholdRule: null
  });
  assert.equal(getDatasetAnalysisOptions(gothenburgRealAisDataset), null);
});

test("provides dataset-specific map framing near Gothenburg", () => {
  assert.deepEqual(gothenburgRealAisDataset.mapView.center, [11.8116, 57.678]);
  assert.equal(gothenburgRealAisDataset.mapView.zoom, 14);
});

test("builds a display-only movement model without detection claims", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points);

  assert.equal(model.mode, "unreviewed-trajectory-display");
  assert.equal(model.segments.length, 3);
  assert.equal(model.anomalyEvidence, null);
  assert.equal(model.baseline, null);
  assert.equal(model.thresholds, null);
  assert.deepEqual(model.flaggedSegments, []);

  for (const segment of model.segments) {
    assert.equal(segment.isPrimaryAnomaly, false);
    assert.equal("detection" in segment, false);
    assert.equal(typeof segment.distanceKm, "number");
    assert.equal(typeof segment.estimatedSpeed, "number");
  }
});

test("allows segment construction without an anomaly configuration", () => {
  const segments = buildSegments(gothenburgRealAisDataset.points);

  assert.equal(segments.length, 3);
  assert.ok(segments.every((segment) => segment.isPrimaryAnomaly === false));
});

test("supports a URL dataset override while preserving the configured default", () => {
  assert.equal(
    resolveRequestedDatasetId(
      SYNTHETIC_PHASE8_DATASET_ID,
      `?dataset=${REAL_GOTHENBURG_DATASET_ID}`
    ),
    REAL_GOTHENBURG_DATASET_ID
  );
  assert.equal(
    resolveRequestedDatasetId(SYNTHETIC_PHASE8_DATASET_ID, "?dataset=%20%20"),
    SYNTHETIC_PHASE8_DATASET_ID
  );

  const selection = selectDataset(DATASET_REGISTRY, REAL_GOTHENBURG_DATASET_ID, {
    fallbackId: SYNTHETIC_PHASE8_DATASET_ID
  });
  assert.equal(selection.usedFallback, false);
  assert.equal(selection.dataset, gothenburgRealAisDataset);
});

test("renders a provenance-aware real dataset overview with an explicit review boundary", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points);
  const html = renderUnreviewedDatasetPanel(gothenburgRealAisDataset, model);

  assert.match(html, /Real AIS Trajectory: Observation Only/);
  assert.match(html, /Review status:<\/strong> Unreviewed/);
  assert.match(html, /Danish Maritime Authority/);
  assert.match(html, /MovingPandas ship-data example/);
  assert.match(html, /has not[\s\S]*validated anomaly/);
  assert.match(html, /AIS-reported SOG and COG/);
});

test("renders reported point measurements without assigning a point anomaly", () => {
  const html = renderUnreviewedPointPanel(
    gothenburgRealAisDataset.points[0],
    gothenburgRealAisDataset
  );

  assert.match(html, /SOG: 9\.80 kn/);
  assert.match(html, /COG: 52\.80°/);
  assert.match(html, /Under way using engine/);
  assert.match(html, /not a point-level anomaly label/);
});

test("renders computed real segment context without threshold or detection status", () => {
  const model = buildTrajectoryDisplayModel(gothenburgRealAisDataset.points);
  const html = renderUnreviewedSegmentPanel(
    model.segments[0],
    gothenburgRealAisDataset
  );

  assert.match(html, /Real AIS Segment Context/);
  assert.match(html, /RouteSense-computed movement metrics/);
  assert.match(html, /Estimated speed:[\s\S]*km\/h/);
  assert.match(html, /Interpretation status:<\/strong> Observation only/);
  assert.match(html, /No[\s\S]*threshold rule[\s\S]*anomaly conclusion/);
  assert.doesNotMatch(html, /Rule status:<\/strong> Flagged/);
});
