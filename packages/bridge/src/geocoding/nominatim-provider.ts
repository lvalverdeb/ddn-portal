import type { GeocodeResult, GeocodingProvider } from "./provider";

/**
 * The portal's sole geocoding provider (CLAUDE.md: OpenStreetMap only, no
 * Mapbox) -- Nominatim, OSM's standard geocoding API. No API key, but its
 * usage policy requires every caller to identify itself with a descriptive
 * User-Agent (https://operations.osmfoundation.org/policies/nominatim/),
 * so the caller must supply one rather than this class defaulting to
 * something generic. That policy also caps the public instance at ~1
 * request/second and disallows bulk geocoding -- fine at this repo's
 * current volume, but a real deployment should run its own Nominatim
 * instance rather than hammer the public one; not implemented here.
 */
export class NominatimGeocodingProvider implements GeocodingProvider {
  constructor(private readonly userAgent: string) {}

  async geocode(address: string): Promise<GeocodeResult> {
    if (!this.userAgent) {
      throw new Error(
        "NominatimGeocodingProvider has no User-Agent configured -- required by Nominatim's usage policy",
      );
    }
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address,
    )}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!res.ok) {
      throw new Error(`Nominatim geocoding failed: ${res.status}`);
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string; importance?: number }>;
    const top = data[0];
    if (!top) {
      throw new Error(`Nominatim returned no match for address: ${address}`);
    }
    const importance = top.importance ?? 0;
    const confidence: GeocodeResult["confidence"] =
      importance >= 0.6 ? "high" : importance >= 0.3 ? "medium" : "low";
    return { lat: Number(top.lat), lon: Number(top.lon), confidence };
  }
}
