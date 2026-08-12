# Android location and DPR media readiness

The manifest declares `INTERNET`, `ACCESS_FINE_LOCATION`, and `ACCESS_COARSE_LOCATION`. The existing DPR/selfie flow uses an HTML file/camera intent through Capacitor rather than directly opening Android camera hardware, so a broad `CAMERA` or media-library permission is not required by the current implementation. Reassess if a native camera plugin is added.

Location is requested at runtime through the WebView geolocation API. The UI distinguishes Android GPS from browser location and reports permission denial, permanent denial, GPS unavailable/off, poor accuracy, and timeout. Native buttons open app permission settings or location-source settings. Production never substitutes coordinates.

Validate on at least one Android device for: first permission grant, denial, “don’t ask again”, GPS disabled, poor indoor accuracy, timeout, camera capture, gallery selection, DPR upload, offline attendance queue, reconnection, and successful server acknowledgement. Emulator-only validation is insufficient for final acceptance.
