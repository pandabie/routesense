// Mock AIS-like trajectory data used to prototype the visual design
// before connecting to real maritime data.

export const trajectoryMetadata = {
  routeName: "Halifax Harbour Expanded Sample Trajectory",
  vesselId: "SAMPLE-VESSEL-001",
  description:
    "An expanded AIS-like sample route with multiple normal movement points " +
    "and one highlighted anomalous segment for perception-aware visualization testing."
};

export const samplePoints = [
  {
    name: "Vessel Point 1", order: 1,
    longitude: -63.59, latitude: 44.665, timestamp: "2026-04-28 10:00",
    note: "Starting point near the inner harbour. The vessel begins moving in a steady southeast direction."
  },
  {
    name: "Vessel Point 2", order: 2,
    longitude: -63.579, latitude: 44.659, timestamp: "2026-04-28 10:10",
    note: "Normal movement point. The vessel continues along a smooth harbour trajectory."
  },
  {
    name: "Vessel Point 3", order: 3,
    longitude: -63.568, latitude: 44.653, timestamp: "2026-04-28 10:20",
    note: "Normal movement point. Direction and spacing remain consistent."
  },
  {
    name: "Vessel Point 4", order: 4,
    longitude: -63.557, latitude: 44.647, timestamp: "2026-04-28 10:30",
    note: "Normal movement point. This reinforces the expected movement rhythm before the anomaly."
  },
  {
    name: "Vessel Point 5", order: 5,
    longitude: -63.546, latitude: 44.641, timestamp: "2026-04-28 10:40",
    note: "Normal movement point. The vessel still follows the expected route pattern."
  },
  {
    name: "Vessel Point 6", order: 6,
    longitude: -63.553461, latitude: 44.618908, timestamp: "2026-04-28 10:50",
    note: "Anomalous movement point. The vessel suddenly detours away from the established route."
  },
  {
    name: "Vessel Point 7", order: 7,
    longitude: -63.535, latitude: 44.632, timestamp: "2026-04-28 11:00",
    note: "Anomalous return movement. The vessel sharply shifts back toward the harbour path."
  },
  {
    name: "Vessel Point 8", order: 8,
    longitude: -63.525, latitude: 44.626, timestamp: "2026-04-28 11:10",
    note: "Normal movement resumes after the unusual detour."
  }
];
