export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(
  from: Coordinates,
  to: Coordinates,
) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function evaluateGeofence(
  location: Coordinates,
  project: Coordinates & { geofenceRadius: number },
) {
  const distanceMeters = haversineDistanceMeters(location, project);
  return {
    distanceMeters,
    atSite: distanceMeters <= project.geofenceRadius,
  };
}
