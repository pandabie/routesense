// RouteSense prototype
// This file builds a perception-aware maritime trajectory visualization
// using ArcGIS Maps SDK for JavaScript.
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";

import "@arcgis/core/assets/esri/themes/light/main.css";
import "./style.css";

// Map setup: creates the base map and initial view around the study area.
const map = new Map({
  basemap: "streets-navigation-vector"
});

const view = new MapView({
  container: "viewDiv",
  map: map,
  center: [-63.5752, 44.6488], // Halifax, Nova Scotia
  zoom: 12
});

view.popupEnabled = false;

const trajectoryMetadata = {
  routeName: "Halifax Harbour Expanded Sample Trajectory",
  vesselId: "SAMPLE-VESSEL-001",
  description:
    "An expanded AIS-like sample route with multiple normal movement points and one highlighted anomalous segment for perception-aware visualization testing."
};

// Sample vessel trajectory points.
// These mock AIS-like points are used to prototype the visual design
// before connecting the application to real maritime data.
const samplePoints = [
  {
    name: "Vessel Point 1",
    order: 1,
    longitude: -63.59,
    latitude: 44.665,
    timestamp: "2026-04-28 10:00",
    note: "Starting point near the inner harbour. The vessel begins moving in a steady southeast direction."
  },
  {
    name: "Vessel Point 2",
    order: 2,
    longitude: -63.579,
    latitude: 44.659,
    timestamp: "2026-04-28 10:10",
    note: "Normal movement point. The vessel continues along a smooth harbour trajectory."
  },
  {
    name: "Vessel Point 3",
    order: 3,
    longitude: -63.568,
    latitude: 44.653,
    timestamp: "2026-04-28 10:20",
    note: "Normal movement point. Direction and spacing remain consistent."
  },
  {
    name: "Vessel Point 4",
    order: 4,
    longitude: -63.557,
    latitude: 44.647,
    timestamp: "2026-04-28 10:30",
    note: "Normal movement point. This reinforces the expected movement rhythm before the anomaly."
  },
  {
    name: "Vessel Point 5",
    order: 5,
    longitude: -63.546,
    latitude: 44.641,
    timestamp: "2026-04-28 10:40",
    note: "Normal movement point. The vessel still follows the expected route pattern."
  },
  {
    name: "Vessel Point 6",
    order: 6,
    longitude: -63.553461,
    latitude: 44.618908,
    timestamp: "2026-04-28 10:50",
    note: "Anomalous movement point. The vessel suddenly detours away from the established route.",
    anomalySegment: true
  },
  {
    name: "Vessel Point 7",
    order: 7,
    longitude: -63.535,
    latitude: 44.632,
    timestamp: "2026-04-28 11:00",
    note: "Anomalous return movement. The vessel sharply shifts back toward the harbour path.",
    anomalySegment: true
  },
  {
    name: "Vessel Point 8",
    order: 8,
    longitude: -63.525,
    latitude: 44.626,
    timestamp: "2026-04-28 11:10",
    note: "Normal movement resumes after the unusual detour."
  }
];

const anomalySegment = {
  fromOrder: 6,
  toOrder: 7,
  label: "Point 6 → Point 7",
  reason:
    "This segment is manually selected as the prototype anomaly because it breaks the surrounding movement rhythm.",
};


// Main trajectory line: connects vessel positions to show movement over time.
const trajectoryLine = new Graphic({
  geometry: {
    type: "polyline",
    paths: [samplePoints.map((point) => [point.longitude, point.latitude])]
  },

  symbol: {
    type: "simple-line",
    color: [0, 102, 255],
    width: 4
  },

  attributes: {
    graphicType: "trajectory-line"
  },

  popupTemplate: {
    title: trajectoryMetadata.routeName,
    content:
      "Vessel ID: " +
      trajectoryMetadata.vesselId +
      "<br>Description: " +
      trajectoryMetadata.description
  }
});

const anomalyPoints = samplePoints.filter((point) => point.anomalySegment);

// Perception-aware anomaly cue.
// The cue is designed to attract attention without relying only on color.
const anomalyGlowGraphic = new Graphic({
  geometry: {
    type: "polyline",
    paths: [anomalyPoints.map((point) => [point.longitude, point.latitude])]
  },

  symbol: {
    type: "simple-line",
    color: [255, 120, 80, 0.25],
    width: 13,
    style: "solid"
  }
});

// Mock anomaly segment.
// This segment is manually selected to test how unusual movement can be
// visually emphasized before rule-based anomaly detection is implemented.
const anomalySegmentGraphic = new Graphic({
  geometry: {
    type: "polyline",
    paths: [anomalyPoints.map((point) => [point.longitude, point.latitude])]
  },

  symbol: {
    type: "simple-line",
    color: [255, 80, 60, 0.95],
    width: 7,
    style: "dash"
  },

  attributes: {
    graphicType: "anomaly-segment"
  },

  popupTemplate: {
    title: "Mock Anomaly Segment",
    content: `
      <b>Segment:</b> Vessel Point 6 → Vessel Point 7<br>
      <b>Anomaly Type:</b> Sharp return after unusual detour<br>
      <b>Reason:</b> The vessel first moves away from the established harbour trajectory, then sharply returns toward the expected route.<br>
      <b>Interpretation:</b> Because Points 1–5 create a visible normal movement rhythm, the 6–7 segment becomes easier to perceive as unusual.
    `
  }
});

const segmentEvidence = samplePoints.slice(0, -1).map((point, index) => {
  const nextPoint = samplePoints[index + 1];

  const heading = getAngle(point, nextPoint);
  const estimatedSpeed = getEstimatedSpeed(point, nextPoint);
  const distanceKm = getDistanceKm(point, nextPoint);
  const timeDiffHours = getTimeDiffHours(point, nextPoint);

  return {
    id: `${point.order}-${nextPoint.order}`,
    fromOrder: point.order,
    toOrder: nextPoint.order,
    fromName: point.name,
    toName: nextPoint.name,
    heading,
    estimatedSpeed,
    distanceKm,
    timeDiffHours,
    isManuallySelectedAnomaly:
      point.order === anomalySegment.fromOrder &&
      nextPoint.order === anomalySegment.toOrder,
  };
});

segmentEvidence.forEach((segment, index) => {
  if (index === 0) {
    segment.headingChange = null;
    return;
  }

  segment.headingChange = getHeadingChange(
    segmentEvidence[index - 1],
    segment
  );
});

const anomalyRule = {
  name: "Prototype trajectory evidence rule",
  status: "Evidence only",
  description:
    "This prototype rule summarizes computed trajectory evidence for the manually selected anomaly segment. It does not perform automated anomaly detection yet.",
  evidenceFields: ["estimated speed", "heading change"],
};

const selectedAnomalyEvidence = segmentEvidence.find(
  (segment) => segment.isManuallySelectedAnomaly
);

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toFixed(decimals);
}

view.graphics.add(trajectoryLine);
view.graphics.add(anomalyGlowGraphic);
view.graphics.add(anomalySegmentGraphic);

function getMidpoint(startPoint, endPoint) {
  return {
    longitude: (startPoint.longitude + endPoint.longitude) / 2,
    latitude: (startPoint.latitude + endPoint.latitude) / 2
  };
}

function getAngle(startPoint, endPoint) {
  const deltaLongitude = endPoint.longitude - startPoint.longitude;
  const deltaLatitude = endPoint.latitude - startPoint.latitude;

  return -Math.atan2(deltaLatitude, deltaLongitude) * (180 / Math.PI);
}

function parseTimestamp(timestamp) {
  return new Date(timestamp.replace(" ", "T"));
}

function getDistanceKm(start, end) {
  const earthRadiusKm = 6371;

  const startLatRad = (start.latitude * Math.PI) / 180;
  const endLatRad = (end.latitude * Math.PI) / 180;
  const deltaLatRad = ((end.latitude - start.latitude) * Math.PI) / 180;
  const deltaLonRad = ((end.longitude - start.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(startLatRad) *
      Math.cos(endLatRad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function getTimeDiffHours(start, end) {
  const startTime = parseTimestamp(start.timestamp);
  const endTime = parseTimestamp(end.timestamp);

  const diffMs = endTime - startTime;
  return diffMs / (1000 * 60 * 60);
}

function getEstimatedSpeed(start, end) {
  const distanceKm = getDistanceKm(start, end);
  const timeHours = getTimeDiffHours(start, end);

  if (timeHours <= 0) {
    return null;
  }

  return distanceKm / timeHours;
}

function getHeadingChange(previousSegment, currentSegment) {
  const change = Math.abs(currentSegment.heading - previousSegment.heading);

  return change > 180 ? 360 - change : change;
}


for (let i = 0; i < samplePoints.length - 1; i++) {
  const startPoint = samplePoints[i];
  const endPoint = samplePoints[i + 1];
  const midpoint = getMidpoint(startPoint, endPoint);

  const directionArrow = new Graphic({
    geometry: {
      type: "point",
      longitude: midpoint.longitude,
      latitude: midpoint.latitude
    },

    symbol: {
      type: "text",
      color: "white",
      text: "➜",
      font: {
        size: 18,
        weight: "bold"
      },
      haloColor: "black",
      haloSize: 1,
      angle: getAngle(startPoint, endPoint)
    },

    attributes: {
      graphicType: "direction-arrow",
      fromPoint: startPoint.name,
      toPoint: endPoint.name
    },

    popupTemplate: {
      title: "Trajectory Direction",
      content: "From: " + startPoint.name + "<br>To: " + endPoint.name
    }
  });

  view.graphics.add(directionArrow);
}

let selectedPointOrder = null;

// Vessel point markers: shows each timestamped vessel position.
const createPointGraphic = (point) => {
  const isSelected = point.order === selectedPointOrder;

  return new Graphic({
    geometry: {
      type: "point",
      longitude: point.longitude,
      latitude: point.latitude
    },

    symbol: {
      type: "simple-marker",
      style: "circle",
      color: isSelected ? [255, 220, 80, 0.95] : "orange",
      size: isSelected ? "18px" : "12px",
      outline: {
        color: isSelected ? [255, 255, 255, 1] : "white",
        width: isSelected ? 3 : 1
      }
    },

    attributes: {
      ...point,
      graphicType: "vessel-point"
    },

    popupTemplate: {
      title: point.name,
      content:
        "Order: " +
        point.order +
        "<br>Time: " +
        point.timestamp +
        "<br>Note: " +
        point.note
    }

  });
};

const vesselPointGraphics = [];

samplePoints.forEach((point) => {
  const graphic = createPointGraphic(point);
  vesselPointGraphics.push(graphic);
  view.graphics.add(graphic);

  const orderLabel = new Graphic({
    geometry: {
      type: "point",
      longitude: point.longitude,
      latitude: point.latitude
    },

    symbol: {
      type: "text",
      color: "white",
      text: point.order.toString(),
      font: {
        size: 12,
        weight: "bold"
      },
      haloColor: "black",
      haloSize: 1,
      yoffset: 10
    }
  });

  view.graphics.add(orderLabel);
});
  
const refreshPointGraphics = () => {
  vesselPointGraphics.forEach((graphic) => {
    view.graphics.remove(graphic);
  });

  vesselPointGraphics.length = 0;

  samplePoints.forEach((point) => {
    const graphic = createPointGraphic(point);
    vesselPointGraphics.push(graphic);
    view.graphics.add(graphic);
  });
};



// Anomaly explanation panel.
// Provides context so the user can interpret why the highlighted movement
// may be unusual.
const infoPanel = document.createElement("div");

infoPanel.className = "info-panel";

const showDefaultInfoPanel = () => {
  infoPanel.innerHTML = `
    <h3>Perception-Aware Anomaly Cue</h3>
    <p>
      The highlighted segment marks an unusual movement that becomes noticeable
      when compared with the surrounding trajectory context.
    </p>
    <p>
      Click a vessel point to inspect its local trajectory context and compare
      it with the manually highlighted anomaly segment.
    </p>
    <ul>
      <li><span class="legend-line normal-line"></span> Normal movement context</li>
      <li><span class="legend-line anomaly-line"></span> Anomalous deviation</li>
    </ul>
  `;
};

showDefaultInfoPanel();

view.ui.add(infoPanel, "top-right");

const updateInfoPanel = (point) => {
  const anomalyText = point.anomalySegment
    ? `<p class="panel-warning">
        This point is one endpoint of the manually selected anomaly segment.
      </p>`
    : "";
  const isAffectedByPrototypeRule =
    point.order === anomalySegment.fromOrder ||
    point.order === anomalySegment.toOrder;
  infoPanel.innerHTML = `
    <h3>${point.name}</h3>
    <p><strong>Time:</strong> ${point.timestamp}</p>
    <p><strong>Trajectory order:</strong> ${point.order}</p>
    <p>${point.note}</p>
    ${anomalyText}
    <hr />
    <p>
      <strong>Prototype note:</strong>
      This interaction helps users inspect the trajectory point-by-point before
      automated anomaly detection is added.
    </p>
    <ul>
      <li><span class="legend-line normal-line"></span> Normal movement context</li>
      <li><span class="legend-line anomaly-line"></span> Anomalous deviation</li>
    </ul>
    ${
      isAffectedByPrototypeRule
        ? `
          <div class="panel-section">
            <h3>Prototype rule note</h3>
            <p>
              This point is affected by the current prototype rule evidence because it forms part of the selected 6→7 segment.
            </p>
          </div>
        `
        : ""
    }
  `;
};


view.on("click", (event) => {
  view.hitTest(event).then((response) => {
    const clickedGraphicResult = response.results.find((result) => {
      return result.graphic?.attributes?.graphicType;
    });

    if (!clickedGraphicResult) {
      selectedPointOrder = null;
      showDefaultInfoPanel();
      refreshPointGraphics();
      return;
    }

    const clickedAttributes = clickedGraphicResult.graphic.attributes;
    const graphicType = clickedAttributes.graphicType;

    if (graphicType !== "vessel-point") {
      selectedPointOrder = null;
      refreshPointGraphics();
    }

    if (graphicType === "vessel-point") {
      selectedPointOrder = clickedAttributes.order;
      updateInfoPanel(clickedAttributes);
      refreshPointGraphics();
      return;
    }

    if (graphicType === "trajectory-line") {
      showTrajectoryPanel();
      return;
    }

    if (graphicType === "anomaly-segment") {
      showAnomalySegmentPanel();
      return;
    }

    if (graphicType === "direction-arrow") {
      showDirectionPanel(clickedAttributes);
      return;
    }
  });
});

const showTrajectoryPanel = () => {
  infoPanel.innerHTML = `
    <h3>Trajectory Overview</h3>
    <p><strong>Route:</strong> ${trajectoryMetadata.routeName}</p>
    <p><strong>Vessel ID:</strong> ${trajectoryMetadata.vesselId}</p>
    <p>${trajectoryMetadata.description}</p>
    <hr />
    <p>
      This line represents the full mock AIS-like trajectory used as context
      for interpreting the highlighted anomaly segment.
    </p>
    <p>
      Points 1–5 establish the expected movement rhythm, while the highlighted
      segment shows a manually selected deviation for visualization purposes.
    </p>
  `;
};

const showAnomalySegmentPanel = () => {
  const speedText = selectedAnomalyEvidence
  ? `${formatNumber(selectedAnomalyEvidence.estimatedSpeed)} km/h`
  : "N/A";

  const headingChangeText =
  selectedAnomalyEvidence && selectedAnomalyEvidence.headingChange !== null
    ? `${formatNumber(selectedAnomalyEvidence.headingChange)}°`
    : "N/A";
  infoPanel.innerHTML = `
    <h3>Mock Anomaly Segment</h3>
    <p><strong>Segment:</strong> Vessel Point 6 → Vessel Point 7</p>
    <p><strong>Anomaly Type:</strong> Sharp return after unusual detour</p>
    <p>
      <strong>Reason:</strong>
      The vessel first moves away from the established harbour trajectory,
      then sharply returns toward the expected route.
    </p>
    <p>
      <strong>Interpretation:</strong>
      Because Points 1–5 create a visible normal movement rhythm, the 6–7
      segment becomes easier to perceive as unusual.
    </p>
    <hr />
    <p>
      <strong>Prototype note:</strong>
      This anomaly is manually selected for visualization purposes. Automated
      rule-based anomaly detection has not been added yet.
    </p>
    <div class="panel-section">
      <h3>Prototype rule evidence</h3>
      <p>
        This segment is still manually selected as the anomaly. The values below
        provide early computed evidence, not automated anomaly detection.
      </p>
      <ul>
        <li><strong>Estimated speed:</strong> ${speedText}</li>
        <li><strong>Heading change:</strong> ${headingChangeText}</li>
        <li><strong>Rule status:</strong> ${anomalyRule.status}</li>
      </ul>
    </div>
  `;
};

const showDirectionPanel = (graphicAttributes) => {
  infoPanel.innerHTML = `
    <h3>Trajectory Direction</h3>
    <p><strong>From:</strong> ${graphicAttributes.fromPoint}</p>
    <p><strong>To:</strong> ${graphicAttributes.toPoint}</p>
    <hr />
    <p>
      This arrow indicates the vessel's movement direction between two
      consecutive sampled positions.
    </p>
    <p>
      Direction cues help users read the trajectory as an ordered movement
      pattern rather than a disconnected set of points.
    </p>
  `;
};
