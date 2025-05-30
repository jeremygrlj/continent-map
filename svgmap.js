import { GeoJSON2SVG } from 'geojson2svg';
import * as turf from '@turf/turf';
import * as d3 from 'd3-geo';
import AF from './continents/AF-simplified.json';
import AN from './continents/AN-simplified.json';
import AS from './continents/AS-simplified.json';
import EU from './continents/EU-simplified.json';
import NA from './continents/NA-simplified.json';
import OC from './continents/OC-simplified.json';
import SA from './continents/SA-simplified.json';

const continents = [AF, AN, AS, EU, NA, OC, SA];

// Wrap each Feature in a FeatureCollection
const featureCollections = continents.map(continent => ({
  type: 'FeatureCollection',
  features: [continent]
}));

// Combine all GeoJSON features into a single FeatureCollection, filtering out invalid features
const combinedGeoJSON = {
  type: 'FeatureCollection',
  features: featureCollections.flatMap(fc => fc.features.filter(feature => feature.geometry && feature.geometry.coordinates))
};

// Log the combined GeoJSON data for debugging
console.log('Combined GeoJSON:', combinedGeoJSON);

// Check if the combined GeoJSON has valid features
if (combinedGeoJSON.features.length === 0) {
  throw new Error('No valid GeoJSON features found');
}

// Define a projection (e.g., Mercator projection)
const projection = d3.geoMercator()
  .fitSize([1000, 500], combinedGeoJSON);

// Project the GeoJSON data
const projectedGeoJSON = turf.featureCollection(combinedGeoJSON.features.map(feature => {
  const projectedCoordinates = feature.geometry.coordinates.map(polygon =>
    polygon.map(ring => ring.map(coord => {
      const [x, y] = projection(coord);
      return [isFinite(x) ? x : 0, isFinite(y) ? y : 0]; // Handle potential Infinity values
    }))
  );
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: projectedCoordinates
    }
  };
}));

// Calculate the bounding box of the projected GeoJSON
const bbox = turf.bbox(projectedGeoJSON);
const [minX, minY, maxX, maxY] = bbox;

// Log the bounding box values for debugging
console.log('Bounding Box:', bbox);

// Check for invalid bounding box values
if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
  throw new Error('Invalid bounding box values');
}

// Calculate the aspect ratio
const width = maxX - minX;
const height = maxY - minY;
const aspectRatio = width / height;

// Set the viewport size maintaining the aspect ratio
const viewportWidth = 1000; // You can adjust this value as needed
const viewportHeight = viewportWidth / aspectRatio;

const svgOptions = {
  viewportSize: { width: viewportWidth, height: viewportHeight },
  mapExtent: { left: minX, bottom: minY, right: maxX, top: maxY },
  attributes: ['properties.class', 'properties.foo'],
  r: 2
};

const svgConverter = new GeoJSON2SVG(svgOptions);
const svgPaths = svgConverter.convert(projectedGeoJSON);

const svgElement = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet">
  ${svgPaths.join('\n')}
</svg>`;

document.body.innerHTML += svgElement;
