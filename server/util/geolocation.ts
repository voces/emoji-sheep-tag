/**
 * IP geolocation utilities with caching
 */

export type Coordinates = { lat: number; lon: number };

type GeoCache = {
  name?: string;
  coordinates?: Coordinates;
  timestamp: number;
};

const ipGeoCache = new Map<string, GeoCache>();
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Check if an IP is localhost or private (non-routable) */
export const isPrivateIp = (ip: string): boolean => {
  // Localhost
  if (ip === "localhost" || ip === "127.0.0.1" || ip === "::1") return true;
  // IPv4 private ranges
  if (
    ip.startsWith("192.168.") || ip.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)
  ) return true;
  // IPv6 link-local (fe80::) and unique local (fc00::/fd00::)
  if (/^fe80:/i.test(ip) || /^f[cd][0-9a-f]{2}:/i.test(ip)) return true;
  return false;
};

export type GeoResult = { name?: string; coordinates?: Coordinates };

/** Look up approximate location for an IP address (cached for 7 days) */
export const geolocateIp = async (ip: string): Promise<GeoResult> => {
  if (isPrivateIp(ip)) return {};

  // Check cache
  const cached = ipGeoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL) {
    return { name: cached.name, coordinates: cached.coordinates };
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=city,country,lat,lon`,
    );
    if (!res.ok) return {};
    const data = await res.json();
    const name = [data.city, data.country].filter(Boolean).join(", ") ||
      undefined;
    const coordinates = typeof data.lat === "number" &&
        typeof data.lon === "number"
      ? { lat: data.lat, lon: data.lon }
      : undefined;

    // Cache the result
    ipGeoCache.set(ip, { name, coordinates, timestamp: Date.now() });

    return { name, coordinates };
  } catch {
    // Geolocation is best-effort, don't fail
  }
  return {};
};

/** Get cached coordinates for an IP (returns undefined if not cached) */
export const getIpCoordinates = (ip: string): Coordinates | undefined => {
  if (isPrivateIp(ip)) return undefined;
  const cached = ipGeoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL) {
    return cached.coordinates;
  }
  return undefined;
};

/** Fetch and cache coordinates for an IP (async, best-effort) */
export const fetchIpCoordinates = async (
  ip: string,
): Promise<Coordinates | undefined> => {
  const result = await geolocateIp(ip);
  return result.coordinates;
};

/** Calculate Haversine distance metric between two coordinate pairs (for sorting) */
export const squaredDistance = (a: Coordinates, b: Coordinates): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);
  const dLat = latB - latA;
  const dLon = toRad(b.lon - a.lon);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  return sinLat * sinLat + Math.cos(latA) * Math.cos(latB) * sinLon * sinLon;
};
