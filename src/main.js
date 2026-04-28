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
      note: "Possible movement point along the harbour"
    },
    {
      name: "Vessel Point C",
      order: 3,
      longitude: -63.5350,
      latitude: 44.6315,
      timestamp: "2026-04-28 10:20",
      note: "Sample point closer to the harbour entrance"
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

  view.graphics.add(trajectoryLine);

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