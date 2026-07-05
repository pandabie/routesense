// Small static real-AIS sample used by Phase 9.3.
//
// Provenance is kept beside the records so the sample cannot drift away from
// its source description. These four consecutive observations were transcribed
// from the MovingPandas ship-data tutorial, which identifies the upstream data
// as Danish Maritime Authority AIS records from 5 July 2017 near Gothenburg.
//
// This file contains source observations only. It does not assert that any
// segment is anomalous, validated, or suitable as ground truth.

export const GOTHENBURG_AIS_SAMPLE_ID = "real-ais-gothenburg-2017";

export const GOTHENBURG_AIS_FIELD_MAP = Object.freeze({
  vesselId: "MMSI",
  timestamp: "Timestamp",
  latitude: "Latitude",
  longitude: "Longitude",
  sog: "SOG",
  cog: "COG",
  heading: "Heading",
  navigationalStatus: "Navigational status"
});

export const GOTHENBURG_AIS_PROVENANCE = Object.freeze({
  publisher: "Danish Maritime Authority",
  intermediary: "MovingPandas ship-data example",
  sourceTitle: "Ship data analysis example",
  sourceUrl:
    "https://movingpandas.github.io/movingpandas-website/2-analysis-examples/ship-data.html",
  upstreamDescriptionUrl:
    "https://github.com/movingpandas/movingpandas-examples/blob/main/data/README.md",
  sourceDate: "2017-07-05",
  geographicArea: "Near Gothenburg, Sweden",
  vesselNameAtObservation: "NORDIC HAMBURG",
  vesselId: "210035000",
  extraction:
    "Four consecutive observations transcribed from the public tutorial table.",
  accessedOn: "2026-06-27",
  timestampInterpretation:
    "The displayed source timestamps contain no UTC offset. This adapter treats them as UTC for deterministic normalization; verify the original archive time basis before research use.",
  licenseStatus:
    "Not asserted by RouteSense. Verify the upstream dataset terms before redistribution or research publication.",
  reviewStatus:
    "Trajectory imported for display and ingestion testing only; no anomaly validation has been performed."
});

export const GOTHENBURG_AIS_RAW_RECORDS = Object.freeze([
  Object.freeze({
    Timestamp: "2017-07-05 17:32:18",
    MMSI: "210035000",
    Latitude: 57.67612,
    Longitude: 11.80462,
    SOG: 9.8,
    COG: 52.8,
    Heading: null,
    "Navigational status": "Under way using engine",
    Name: "NORDIC HAMBURG",
    "Ship type": "Cargo"
  }),
  Object.freeze({
    Timestamp: "2017-07-05 17:33:18",
    MMSI: "210035000",
    Latitude: 57.67773,
    Longitude: 11.80875,
    SOG: 9.5,
    COG: 58.9,
    Heading: null,
    "Navigational status": "Under way using engine",
    Name: "NORDIC HAMBURG",
    "Ship type": "Cargo"
  }),
  Object.freeze({
    Timestamp: "2017-07-05 17:34:18",
    MMSI: "210035000",
    Latitude: 57.67879,
    Longitude: 11.81311,
    SOG: 9.3,
    COG: 70.5,
    Heading: null,
    "Navigational status": "Under way using engine",
    Name: "NORDIC HAMBURG",
    "Ship type": "Cargo"
  }),
  Object.freeze({
    Timestamp: "2017-07-05 17:35:28",
    MMSI: "210035000",
    Latitude: 57.67968,
    Longitude: 11.81855,
    SOG: 9.5,
    COG: 71.1,
    Heading: null,
    "Navigational status": "Under way using engine",
    Name: "NORDIC HAMBURG",
    "Ship type": "Cargo"
  })
]);
