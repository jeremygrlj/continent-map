import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import * as turf from "@turf/turf";

// Initialize the map
const map = new maplibregl.Map({
    container: "map",
    style: {
        version: 8,
        sources: {},
        layers: [
            {
                id: "background",
                type: "background",
                paint: {
                    "background-color": "#FFFFFF",
                },
            },
        ],
    },
    center: [0, 45],
    zoom: 1,
    renderWorldCopies: false,
});

const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
});

// Load and add GeoJSON data to the map
map.on("load", async () => {
    try {
        console.log("Map loaded, fetching GeoJSON data...");
        const response = await fetch("./custom.geo.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("GeoJSON data loaded:", data.features.length, "features");

        // Verify data structure
        const sampleFeature = data.features[0];
        console.log("Sample feature:", {
            name: sampleFeature.properties.name,
            continent: sampleFeature.properties.continent
        });

        // Define colors
        const colors = {
            continentDefault: "#F7AD49",
            continentHover: "#697985",
            countryDefault: "#697985",
            countryHover: "#374753",
            borderHighlight: "#FFFFFF"
        };

        // Get unique continents from the data
        const continents = [...new Set(data.features.map(f => f.properties.continent))];
        console.log("Found continents:", continents);

        // Add the original data source for countries
        map.addSource("countries", {
            type: "geojson",
            data: data
        });

// Create continent features by combining country geometries
const continentFeatures = continents.map(continent => {
    const countries = data.features.filter(f => f.properties.continent === continent);
    console.log(`${continent}: found ${countries.length} countries`);

    if (countries.length === 0) return null;

    try {
        // First combine the countries
        const combined = turf.combine(turf.featureCollection(countries));

        // Then create a very small buffer
        const buffered = turf.buffer(
            combined,
            0.01, // very small buffer distance
            { units: 'degrees' }
        );

        // Simplify the geometry to remove artifacts
        const simplified = turf.simplify(buffered, {
            tolerance: 0.01,
            highQuality: true
        });

        // Create the continent feature
        return {
            type: "Feature",
            properties: { continent },
            geometry: geometry
        };
    } catch (e) {
        console.warn(`Error processing ${continent}, using simple combine:`, e);
        // Fallback to simple combine without buffer
        const combined = turf.combine(turf.featureCollection(countries));
        return {
            type: "Feature",
            properties: { continent },
            geometry: combined.features[0].geometry
        };
    }
}).filter(feature => feature !== null);

        // Add continent source
        map.addSource("continents", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: continentFeatures
            }
        });

        // Add continent layers
        continents.forEach(continent => {
            // Add continent fill layer
            map.addLayer({
                id: `continent-${continent}-fill`,
                type: "fill",
                source: "continents",
                filter: ["==", ["get", "continent"], continent],
                paint: {
                    "fill-color": colors.continentDefault,
                    "fill-opacity": 1
                }
            });

            // Add continent border layer
            map.addLayer({
                id: `continent-${continent}-border`,
                type: "line",
                source: "continents",
                filter: ["==", ["get", "continent"], continent],
                paint: {
                    "line-color": colors.continentDefault,
                    "line-opacity": 1,
                    "line-width": 0.5
                }
            });
        });

        // Add country layers (initially hidden)
        map.addLayer({
            id: "country-fills",
            type: "fill",
            source: "countries",
            paint: {
                "fill-color": colors.countryDefault,
                "fill-opacity": 1
            },
            layout: {
                visibility: "none"
            }
        });            // Track the currently selected continent
        let selectedContinent = null;

        // Add hover effects for countries
        map.on("mousemove", "country-fills", (e) => {
            if (!e.features || !e.features[0]) return;

            const feature = e.features[0];

            // Always show cursor as pointer over countries
            map.getCanvas().style.cursor = "pointer";

            // Show tooltip and change color based on continent selection
            if (!selectedContinent || feature.properties.continent === selectedContinent) {
                // Change fill color on hover
                map.setPaintProperty("country-fills", "fill-color", [
                    "case",
                    ["==", ["get", "name"], feature.properties.name],
                    colors.countryHover,
                    colors.countryDefault
                ]);

                popup.setLngLat(e.lngLat)
                    .setHTML(`<strong>${feature.properties.name}</strong>`)
                    .addTo(map);
            }
        });

        map.on("mouseleave", "country-fills", () => {
            map.getCanvas().style.cursor = "";
            popup.remove();
            // Reset the fill color
            map.setPaintProperty("country-fills", "fill-color", colors.countryDefault);
        });

        // Add click handler for the background to return to continent view
        map.on("click", (e) => {
            // Check if we clicked on a country or continent
            const features = map.queryRenderedFeatures(e.point, {
                layers: ['country-fills', ...continents.map(c => `continent-${c}-fill`)]
            });

            // If we didn't click on any feature and we have a selected continent
            if (features.length === 0 && selectedContinent) {
                resetView();
                selectedContinent = null;
            }
        });

        // Add country borders layer
        map.addLayer({
            id: "country-borders",
            type: "line",
            source: "countries",
            paint: {
                "line-color": colors.borderHighlight,
                "line-width": 0.5
            },
            layout: {
                visibility: "none"
            }
        });

        // Add click handlers for continents
        continents.forEach(continent => {
            map.on("click", `continent-${continent}-fill`, (e) => {
                selectedContinent = continent;
                const features = data.features.filter(f => f.properties.continent === continent);
                const bbox = turf.bbox({
                    type: "FeatureCollection",
                    features: features
                });

                // Hide all continent layers
                continents.forEach(c => {
                    map.setLayoutProperty(`continent-${c}-fill`, "visibility", "none");
                    map.setLayoutProperty(`continent-${c}-border`, "visibility", "none");
                });

                // Show all countries but highlight the selected continent
                map.setFilter("country-fills", null);
                map.setFilter("country-borders", null);
                map.setLayoutProperty("country-fills", "visibility", "visible");
                map.setLayoutProperty("country-borders", "visibility", "visible");

                // Update opacity to highlight selected continent
                map.setPaintProperty("country-fills", "fill-opacity", [
                    "case",
                    ["==", ["get", "continent"], continent],
                    0.7,  // Selected continent countries
                    0.2   // Other continents' countries
                ]);

                // Zoom to continent
                map.fitBounds(bbox, {
                    padding: 50,
                    duration: 1000
                });

                // Show back button
                backButton.style.display = "block";
            });

            // Add hover effects
            map.on("mousemove", `continent-${continent}-fill`, (e) => {
                map.getCanvas().style.cursor = "pointer";

                // Change fill and border colors on hover
                map.setPaintProperty(`continent-${continent}-fill`, "fill-color", colors.continentHover);
                map.setPaintProperty(`continent-${continent}-border`, "line-color", colors.borderHighlight);

                // Show tooltip that follows the cursor
                popup.setLngLat(e.lngLat)
                    .setHTML(`<strong>${continent}</strong>`)
                    .addTo(map);
            });

            map.on("mouseleave", `continent-${continent}-fill`, () => {
                map.getCanvas().style.cursor = "";
                popup.remove();
                // Reset colors
                map.setPaintProperty(`continent-${continent}-fill`, "fill-color", colors.continentDefault);
                map.setPaintProperty(`continent-${continent}-border`, "line-color", colors.continentDefault);
            });
        });

        // Add click handlers for countries
        map.on("click", "country-fills", (e) => {
            if (!e.features || !e.features[0]) return;

            const feature = e.features[0];
            const isInSelectedContinent = feature.properties.continent === selectedContinent;

            // If we click on a country outside the selected continent, return to continent view
            if (selectedContinent && !isInSelectedContinent) {
                resetView();
                return;
            }

            // Handle country click behavior when it's in the selected continent
            if (!selectedContinent || isInSelectedContinent) {
                // Get the clicked country's bounds
                const bbox = turf.bbox(feature);

                // Zoom to the country
                map.fitBounds(bbox, {
                    padding: 50,
                    duration: 1000
                });

                // Show all countries by removing filters
                map.setFilter("country-fills", null);
                map.setFilter("country-borders", null);

                // Update visuals for country focus
                map.setPaintProperty("country-fills", "fill-opacity", [
                    "case",
                    ["==", ["get", "name"], feature.properties.name],
                    1, // Selected country is most visible
                    ["==", ["get", "continent"], selectedContinent],
                    1, // Same continent countries are prominent
                    0.3  // Other countries are subdued
                ]);

                map.setPaintProperty("country-borders", "line-opacity", [
                    "case",
                    ["==", ["get", "continent"], "Europe"],
                    1,
                    0.3
                ]);
            }
        });

        // Create and add back button with reset functionality
        const backButton = document.createElement("button");
        backButton.textContent = "Back to Continents";
        backButton.style.display = "none";
        document.body.appendChild(backButton);

        const resetView = () => {
            selectedContinent = null;
            // Show continent layers
            continents.forEach(continent => {
                map.setLayoutProperty(`continent-${continent}-fill`, "visibility", "visible");
                map.setLayoutProperty(`continent-${continent}-border`, "visibility", "visible");
            });

            // Hide country layers
            map.setLayoutProperty("country-fills", "visibility", "none");
            map.setLayoutProperty("country-borders", "visibility", "none");

            // Reset paint properties
            map.setPaintProperty("country-fills", "fill-opacity", [
                "case",
                ["==", ["get", "continent"], "Europe"],
                0.7,
                0.3
            ]);

            // Reset view
            map.fitBounds([[-180, -60], [180, 80]], {
                padding: 50,
                duration: 1000
            });

            backButton.style.display = "none";
        };

        backButton.addEventListener("click", resetView);

        // Log available sources and layers
        console.log("Available sources:", Object.keys(map.getStyle().sources));
        console.log("Available layers:", map.getStyle().layers.map(l => l.id));

    } catch (error) {
        console.error("Error loading or processing data:", error);
    }
});

// Add error handler for the map
map.on('error', (e) => {
    console.error('Map error:', e);
});
