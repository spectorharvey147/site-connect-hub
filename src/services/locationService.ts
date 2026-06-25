import type { GeoLocationPoint } from "@/types/attendance";

const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

export const locationService = {
  capture(options?: { maxAccuracyMeters?: number }): Promise<GeoLocationPoint> {
    const maxAccuracy =
      options?.maxAccuracyMeters ?? MAX_ACCEPTABLE_ACCURACY_METERS;
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("This device does not support location services."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = Math.round(position.coords.accuracy);
          if (accuracy > maxAccuracy) {
            reject(
              new Error(
                `GPS accuracy is ${accuracy} m. Move to an open area and try again.`,
              ),
            );
            return;
          }
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy,
            capturedAt: new Date().toISOString(),
          });
        },
        (error) => {
          const message =
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : "Unable to capture a reliable GPS location.";
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        },
      );
    });
  },
};
