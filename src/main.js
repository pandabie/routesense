require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic"
], function (Map, MapView, Graphic) {
  const map = new Map({
    basemap: "streets-navigation-vector"
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [-63.5752, 44.6488], // Halifax, Nova Scotia
    zoom: 12
  });

  const trajectoryMetadata = {
    routeName: "Halifax Harbour Expanded Sample Trajectory",
    vesselId: "SAMPLE-VESSEL-001",
    description: "An expanded AIS-like sample route with multiple normal movement points and one highlighted anomalous segment for perception-aware visualization testing."
  };

  const samplePoints = [
    {
      name: "Vessel Point 1",
      order: 1,
      longitude: -63.5900,
      latitude: 44.6650,
      timestamp: "2026-04-28 10:00",
      note: "Starting point near the inner harbour. The vessel begins moving in a steady southeast direction."
    },
    {
      name: "Vessel Point 2",
      order: 2,
      longitude: -63.5790,
      latitude: 44.6590,
      timestamp: "2026-04-28 10:10",
      note: "Normal movement point. The vessel continues along a smooth harbour trajectory."
    },
    {
      name: "Vessel Point 3",
      order: 3,
      longitude: -63.5680,
      latitude: 44.6530,
      timestamp: "2026-04-28 10:20",
      note: "Normal movement point. Direction and spacing remain consistent."
    },
    {
      name: "Vessel Point 4",
      order: 4,
      longitude: -63.5570,
      latitude: 44.6470,
      timestamp: "2026-04-28 10:30",
      note: "Normal movement point. This reinforces the expected movement rhythm before the anomaly."
    },
    {
      name: "Vessel Point 5",
      order: 5,
      longitude: -63.5460,
      latitude: 44.6410,
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
      longitude: -63.5350,
      latitude: 44.6320,
      timestamp: "2026-04-28 11:00",
      note: "Anomalous return movement. The vessel sharply shifts back toward the harbour path.",
      anomalySegment: true
    },
    {
      name: "Vessel Point 8",
      order: 8,
      longitude: -63.5250,
      latitude: 44.6260,
      timestamp: "2026-04-28 11:10",
      note: "Normal movement resumes after the unusual detour."
    }
  ];

  const trajectoryLine = new Graphic({
    geometry: {
      type: "polyline",
      paths: [
        samplePoints.map(function (point) {
          return [point.longitude, point.latitude];
        })
      ]
    },

    symbol: {
      type: "simple-line",
      color: [0, 102, 255],
      width: 4
    },

    popupTemplate: {
      title: trajectoryMetadata.routeName,
      content:
        "Vessel ID: " + trajectoryMetadata.vesselId +
        "<br>Description: " + trajectoryMetadata.description
    }
  });

  const anomalyPoints = samplePoints.filter((point) => point.anomalySegment);

  const anomalySegmentGraphic = new Graphic({
    geometry: {
      type: "polyline",
      paths: [
        anomalyPoints.map((point) => [point.longitude, point.latitude])
      ]
    },
    symbol: {
      type: "simple-line",
      color: [255, 0, 0],
      width: 6
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

  view.graphics.add(trajectoryLine);
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

      popupTemplate: {
        title: "Trajectory Direction",
        content:
          "From: " + startPoint.name +
          "<br>To: " + endPoint.name
      }
    });

    view.graphics.add(directionArrow);
  }

  samplePoints.forEach(function (point) {
    const graphic = new Graphic({
      geometry: {
        type: "point",
        longitude: point.longitude,
        latitude: point.latitude
      },

      symbol: {
        type: "simple-marker",
        color: "orange",
        size: "12px",
        outline: {
          color: "white",
          width: 1
        }
      },

      popupTemplate: {
        title: point.name,
        content:
          "Order: " + point.order +
          "<br>Time: " + point.timestamp +
          "<br>Note: " + point.note
      }
    });

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
          size: 10,
          weight: "bold"
        },
        haloColor: "black",
        haloSize: 1,
        yoffset: 10

      }
    });

    view.graphics.add(orderLabel);

  });
});