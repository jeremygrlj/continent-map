import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

// Array of GeoJSON file paths
const geoJsonFiles = [
	"continents/SA-simplified.json",
	"continents/OC-simplified.json",
	"continents/NA-simplified.json",
	"continents/EU-simplified.json",
	"continents/AS-simplified.json",
	"continents/AN-simplified.json",
	"continents/AF-simplified.json",
];

const map = new maplibregl.Map({
	container: "map",
	style: {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#FFFFFF' // Set the background color to white
        }
      }
    ]
  },
	center: [10, 50], // Adjust the center to fit all continents
	zoom: 2,
});

// Create a popup, but don't add it to the map yet.
const popup = new maplibregl.Popup({
	closeButton: false,
	closeOnClick: false,
});

map.on("load", () => {
	geoJsonFiles.forEach((filePath, index) => {
		fetch(filePath)
			.then((response) => response.json())
			.then((data) => {
				const sourceId = `continent-${index}`;
				const layerId = `continent-layer-${index}`;

				// Add the GeoJSON source
				map.addSource(sourceId, {
					type: "geojson",
					data: data,
				});

				// Add a layer to use the GeoJSON source
				map.addLayer({
					id: layerId,
					type: "fill",
					source: sourceId,
					layout: {},
					paint: {
						"fill-color": "#F7AD49",
						"fill-outline-color": "#fff",
					},
				});

				// Add event listeners for hover effect
				map.on("mouseenter", layerId, () => {
					// Change the fill color on hover
					map.setPaintProperty(layerId, "fill-color", "#697985"); // Change to desired hover color
					map.getCanvas().style.cursor = "pointer";
				});

				map.on("mouseleave", layerId, () => {
					// Reset the fill color when the mouse leaves
					map.setPaintProperty(layerId, "fill-color", "#F7AD49"); // Reset to original color
					map.getCanvas().style.cursor = "";
				});

				// Add event listeners for hover effect
				map.on("mousemove", layerId, (e) => {
					map.getCanvas().style.cursor = "pointer";
					const coordinates = e.lngLat;
					const properties = e.features[0].properties;

					const description =
						properties.continent_code || "No continent code available";

					// Calculate the offset coordinates (e.g., 10 pixels to the right and 10 pixels down)
					const offsetLngLat = map.unproject([
						map.project(coordinates).x + 30,
						map.project(coordinates).y + 60,
					]);

					// Ensure the popup appears over the copy being pointed to
					while (Math.abs(e.lngLat.lng - offsetLngLat.lng) > 180) {
						offsetLngLat.lng += e.lngLat.lng > offsetLngLat.lng ? 360 : -360;
					}

					// Populate the popup and set its coordinates
					popup.setLngLat(offsetLngLat).setHTML(description).addTo(map);
				});

				map.on("mouseleave", layerId, () => {
					map.getCanvas().style.cursor = "";
					popup.remove();
				});
			})
			.catch((error) =>
				console.error(`Error loading GeoJSON data from ${filePath}:`, error)
			);
	});
});
