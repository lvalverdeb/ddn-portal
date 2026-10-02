import type { GeocodeResult, GeocodingProvider } from "./provider";

/**
 * Placeholder, not wired to a real account yet -- the architecture plan
 * lists the geocoding provider choice as an open item to settle once real
 * customer geographies are known. This class exists so `BridgeSubmitter`
 * has a concrete default to construct against; swapping providers later is
 * a `GeocodingProvider` implementation, not a `BridgeSubmitter` change.
 */
export class MapboxGeocodingProvider implements GeocodingProvider {
  constructor(private readonly apiKey: string) {}

  async geocode(address: string): Promise<GeocodeResult> {
    if (!this.apiKey) {
      throw new Error(
        "MapboxGeocodingProvider has no API key configured -- geocoding " +
          "provider choice is an open item, see the architecture plan",
      );
    }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address,
    )}.json?access_token=${this.apiKey}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox geocoding failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      features: Array<{ center: [number, number]; relevance: number }>;
    };
    const top = data.features[0];
    if (!top) {
      throw new Error(`Mapbox returned no match for address: ${address}`);
    }
    const [lon, lat] = top.center;
    const confidence: GeocodeResult["confidence"] =
      top.relevance >= 0.9 ? "high" : top.relevance >= 0.6 ? "medium" : "low";
    return { lat, lon, confidence };
  }
}
