export interface GeocodeResult {
  lat: number;
  lon: number;
  confidence: "high" | "medium" | "low";
}

export interface GeocodingProvider {
  geocode(address: string): Promise<GeocodeResult>;
}
