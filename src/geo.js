// Pure helper functions: geometry, time, statistics, formatting.
// No side effects, no DOM, no ArcGIS — everything here is unit-testable.

export const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle distance between two {latitude, longitude} points, in km.
export function getDistanceKm(start, end) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLon = toRadians(end.longitude - start.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(start.latitude)) *
      Math.cos(toRadians(end.latitude)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// NOTE: timestamps are parsed in the browser's local timezone. Acceptable for
// mock data; real AIS timestamps are UTC and must be parsed as such before
// this prototype touches real data (append "Z" or use a date library).
export const parseTimestamp = (timestamp) => new Date(timestamp.replace(" ", "T"));

// Elapsed time between two points, in hours.
export const getTimeDiffHours = (start, end) =>
  (parseTimestamp(end.timestamp) - parseTimestamp(start.timestamp)) / 3600000;

// Estimated speed for a segment, in km/h. Returns null for zero/negative time.
export function getEstimatedSpeed(start, end) {
  const hours = getTimeDiffHours(start, end);
  return hours > 0 ? getDistanceKm(start, end) / hours : null;
}

// Compass bearing (0-360 deg) from start to end. Used for trajectory analysis.
export function getHeading(start, end) {
  const deltaLon = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);

  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);

  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

// Absolute difference between two headings, normalised to 0-180 deg.
export function getHeadingChange(previousHeading, currentHeading) {
  const change = Math.abs(currentHeading - previousHeading);
  return change > 180 ? 360 - change : change;
}

// Screen-space rotation angle (degrees) for drawing a direction arrow.
// NOTE: this is a display-only cartesian angle, NOT a compass heading.
// It differs from getHeading() on purpose - the two are not interchangeable.
export function getArrowAngle(start, end) {
  const deltaLon = end.longitude - start.longitude;
  const deltaLat = end.latitude - start.latitude;
  return -Math.atan2(deltaLat, deltaLon) * (180 / Math.PI);
}

// Naive coordinate midpoint — fine at harbour scale, not for long segments.
export const getMidpoint = (start, end) => ({
  longitude: (start.longitude + end.longitude) / 2,
  latitude: (start.latitude + end.latitude) / 2
});

// Mean of an array, ignoring null/undefined/NaN. Returns null if nothing valid.
export function average(values) {
  const valid = values.filter((v) => v != null && !Number.isNaN(v));
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null;
}

// Percent difference of `value` relative to `baseline`.
export function percentDifference(value, baseline) {
  if (value == null || baseline == null || baseline === 0) return null;
  return ((value - baseline) / baseline) * 100;
}

// Format a number for display, or "N/A" if it isn't a real number.
export function formatNumber(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(decimals);
}
