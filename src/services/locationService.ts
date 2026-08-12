import { Capacitor, registerPlugin } from "@capacitor/core";
import type { GeoLocationPoint } from "@/types/attendance";

const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

interface DeviceSettingsPlugin {
  openAppSettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
}

const deviceSettings = registerPlugin<DeviceSettingsPlugin>("DeviceSettings");

export type LocationFailureCode =
  | "permission_denied"
  | "permission_denied_permanently"
  | "gps_off"
  | "poor_accuracy"
  | "timeout"
  | "unavailable";

export class LocationCaptureError extends Error {
  constructor(message: string, public readonly code: LocationFailureCode) {
    super(message);
  }
}

export const locationService = {
  capture(options?: { maxAccuracyMeters?: number }): Promise<GeoLocationPoint> {
    const maxAccuracy =
      options?.maxAccuracyMeters ?? MAX_ACCEPTABLE_ACCURACY_METERS;
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new LocationCaptureError("This device does not support location services.", "unavailable"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = Math.round(position.coords.accuracy);
          if (accuracy > maxAccuracy) {
            reject(
              new LocationCaptureError(
                `GPS accuracy is ${accuracy} m. Move to an open area and try again.`,
                "poor_accuracy",
              ),
            );
            return;
          }
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy,
            capturedAt: new Date().toISOString(),
            source: Capacitor.isNativePlatform() ? "android" : "browser",
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(new LocationCaptureError("Location permission was denied. Enable it in device settings and try again.", Capacitor.isNativePlatform() ? "permission_denied_permanently" : "permission_denied"));
          } else if (error.code === error.TIMEOUT) {
            reject(new LocationCaptureError("Location capture timed out. Move to an open area and retry.", "timeout"));
          } else {
            reject(new LocationCaptureError("Location is unavailable. Check that device GPS is turned on.", "gps_off"));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        },
      );
    });
  },

  async openSettings(kind: "app" | "location" = "app") {
    if (!Capacitor.isNativePlatform()) throw new Error("Open your browser or operating-system location settings.");
    if (kind === "location") await deviceSettings.openLocationSettings();
    else await deviceSettings.openAppSettings();
  },
};
