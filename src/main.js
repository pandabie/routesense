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
    routeName: "Halifax Harbour Sample Trajectory",
    vesselId: "SAMPLE-VESSEL-001",
    description: "A simple sample route connecting AIS-like vessel points."
  };

  const samplePoints = [
    {
      name: "Vessel Point A",
      order: 1,
      longitude: -63.5667,
      latitude: 44.6460,
      timestamp: "2026-04-28 10:00",
      note: "Sample AIS-like point near Halifax Harbour"
    },
    {
      name: "Vessel Point B",
      order: 2,
      longitude: -63.5510,
      latitude: 44.6425,
      timestamp: "2026-04-28 10:10",
      note: "Possible movement point along the harbour",
      anomalySegment: true
    },
    {
      name: "Vessel Point C",
      order: 3,
      longitude: -63.5350,
      latitude: 44.6315,
      timestamp: "2026-04-28 10:20",
      note: "Sample point closer to the harbour entrance",
      anomalySegment: true
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
        <b>Segment:</b> Vessel Point B → Vessel Point C<br>
        <b>Anomaly Type:</b> Mock unusual trajectory segment<br>
        <b>Reason:</b> This segment is highlighted as a perception-aware visual cue for unusual vessel movement.<br>
        <b>Interpretation:</b> The vessel appears to shift movement toward the harbour entrance, making this segment useful for testing anomaly highlighting.
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