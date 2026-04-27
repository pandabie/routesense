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

  const samplePoints = [
    {
      name: "Vessel Point A",
      longitude: -63.5667,
      latitude: 44.6460,
      note: "Sample AIS-like point near Halifax Harbour"
    },
    {
      name: "Vessel Point B",
      longitude: -63.5510,
      latitude: 44.6425,
      note: "Possible movement point along the harbour"
    },
    {
      name: "Vessel Point C",
      longitude: -63.5350,
      latitude: 44.6315,
      note: "Sample point closer to the harbour entrance"
    }
  ];

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
        content: point.note
      }
    });

    view.graphics.add(graphic);
  });
});