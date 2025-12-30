/**
 * IP geolocation utilities with caching
 */

export type Coordinates = { lat: number; lon: number };

// Major cities database for local nearest-city lookup (265 cities worldwide)
// Linear search is fine here: only ~265 distance calculations per lookup,
// and results are cached for 7 days. Spatial indexing (S2/H3) would add
// complexity without meaningful benefit at this scale.
const MAJOR_CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: "London", lat: 51.5, lon: -0.117 },
  { name: "New York", lat: 40.75, lon: -73.98 },
  { name: "Hong Kong", lat: 22.305, lon: 114.185 },
  { name: "Beijing", lat: 39.929, lon: 116.388 },
  { name: "Singapore", lat: 1.293, lon: 103.856 },
  { name: "Shanghai", lat: 31.216, lon: 121.437 },
  { name: "Paris", lat: 48.867, lon: 2.333 },
  { name: "Dubai", lat: 25.23, lon: 55.28 },
  { name: "Tokyo", lat: 35.685, lon: 139.751 },
  { name: "Sydney", lat: -33.92, lon: 151.185 },
  { name: "Seoul", lat: 37.566, lon: 127.0 },
  { name: "Milan", lat: 45.47, lon: 9.205 },
  { name: "Toronto", lat: 43.7, lon: -79.42 },
  { name: "Frankfurt", lat: 50.1, lon: 8.675 },
  { name: "Chicago", lat: 41.83, lon: -87.75 },
  { name: "Jakarta", lat: -6.174, lon: 106.829 },
  { name: "Sao Paulo", lat: -23.559, lon: -46.625 },
  { name: "Mexico City", lat: 19.442, lon: -99.131 },
  { name: "Mumbai", lat: 19.017, lon: 72.857 },
  { name: "Madrid", lat: 40.4, lon: -3.683 },
  { name: "Warsaw", lat: 52.25, lon: 21.0 },
  { name: "Istanbul", lat: 41.105, lon: 29.01 },
  { name: "Amsterdam", lat: 52.35, lon: 4.917 },
  { name: "Bangkok", lat: 13.75, lon: 100.517 },
  { name: "Los Angeles", lat: 33.99, lon: -118.18 },
  { name: "Kuala Lumpur", lat: 3.167, lon: 101.7 },
  { name: "Luxembourg", lat: 49.612, lon: 6.13 },
  { name: "Taipei", lat: 25.036, lon: 121.568 },
  { name: "Brussels", lat: 50.833, lon: 4.333 },
  { name: "Zurich", lat: 47.38, lon: 8.55 },
  { name: "Buenos Aires", lat: -34.603, lon: -58.398 },
  { name: "Melbourne", lat: -37.82, lon: 144.975 },
  { name: "San Francisco", lat: 37.74, lon: -122.46 },
  { name: "Riyadh", lat: 24.641, lon: 46.773 },
  { name: "Santiago", lat: -33.45, lon: -70.667 },
  { name: "Düsseldorf", lat: 51.22, lon: 6.78 },
  { name: "Stockholm", lat: 59.351, lon: 18.097 },
  { name: "Washington DC", lat: 38.9, lon: -77.009 },
  { name: "Vienna", lat: 48.2, lon: 16.367 },
  { name: "Lisbon", lat: 38.723, lon: -9.145 },
  { name: "Munich", lat: 48.13, lon: 11.575 },
  { name: "Dublin", lat: 53.333, lon: -6.249 },
  { name: "Houston", lat: 29.82, lon: -95.34 },
  { name: "Berlin", lat: 52.522, lon: 13.402 },
  { name: "Johannesburg", lat: -26.17, lon: 28.03 },
  { name: "Boston", lat: 42.33, lon: -71.07 },
  { name: "New Delhi", lat: 28.6, lon: 77.2 },
  { name: "Bogota", lat: 4.596, lon: -74.083 },
  { name: "Ho Chi Minh City", lat: 10.78, lon: 106.695 },
  { name: "Rome", lat: 41.896, lon: 12.483 },
  { name: "Bengaluru", lat: 12.97, lon: 77.56 },
  { name: "Budapest", lat: 47.5, lon: 19.083 },
  { name: "Athens", lat: 37.983, lon: 23.733 },
  { name: "Hamburg", lat: 53.55, lon: 10.0 },
  { name: "Doha", lat: 25.287, lon: 51.533 },
  { name: "Chengdu", lat: 30.67, lon: 104.07 },
  { name: "Miami", lat: 25.788, lon: -80.224 },
  { name: "Dallas", lat: 32.82, lon: -96.84 },
  { name: "Atlanta", lat: 33.83, lon: -84.4 },
  { name: "Auckland", lat: -36.85, lon: 174.765 },
  { name: "Barcelona", lat: 41.383, lon: 2.183 },
  { name: "Hangzhou", lat: 30.25, lon: 120.17 },
  { name: "Bucharest", lat: 44.433, lon: 26.1 },
  { name: "Lima", lat: -12.048, lon: -77.05 },
  { name: "Montreal", lat: 45.5, lon: -73.583 },
  { name: "Prague", lat: 50.083, lon: 14.466 },
  { name: "Chongqing", lat: 29.565, lon: 106.595 },
  { name: "Tel Aviv", lat: 32.08, lon: 34.77 },
  { name: "Brisbane", lat: -27.455, lon: 153.035 },
  { name: "Cairo", lat: 30.05, lon: 31.25 },
  { name: "Hanoi", lat: 21.033, lon: 105.85 },
  { name: "Nanjing", lat: 32.05, lon: 118.78 },
  { name: "Oslo", lat: 59.917, lon: 10.75 },
  { name: "Perth", lat: -31.955, lon: 115.84 },
  { name: "Copenhagen", lat: 55.676, lon: 12.568 },
  { name: "Wuhan", lat: 30.58, lon: 114.27 },
  { name: "Manila", lat: 14.604, lon: 120.982 },
  { name: "Xiamen", lat: 24.45, lon: 118.08 },
  { name: "Nairobi", lat: -1.283, lon: 36.817 },
  { name: "Kyiv", lat: 50.433, lon: 30.517 },
  { name: "Geneva", lat: 46.21, lon: 6.14 },
  { name: "Jinan", lat: 36.675, lon: 116.995 },
  { name: "Calgary", lat: 51.083, lon: -114.08 },
  { name: "Zhengzhou", lat: 34.755, lon: 113.665 },
  { name: "Shenyang", lat: 41.805, lon: 123.45 },
  { name: "Dalian", lat: 38.923, lon: 121.63 },
  { name: "Suzhou", lat: 33.636, lon: 116.979 },
  { name: "Qingdao", lat: 36.09, lon: 120.33 },
  { name: "Casablanca", lat: 33.6, lon: -7.616 },
  { name: "Changsha", lat: 28.2, lon: 112.97 },
  { name: "Beirut", lat: 33.872, lon: 35.51 },
  { name: "Port Louis", lat: -20.167, lon: 57.5 },
  { name: "Denver", lat: 39.739, lon: -104.984 },
  { name: "Lagos", lat: 6.443, lon: 3.392 },
  { name: "Belgrade", lat: 44.819, lon: 20.468 },
  { name: "Montevideo", lat: -34.858, lon: -56.171 },
  { name: "Vancouver", lat: 49.273, lon: -123.122 },
  { name: "Seattle", lat: 47.57, lon: -122.34 },
  { name: "Manchester", lat: 53.5, lon: -2.248 },
  { name: "Sofia", lat: 42.683, lon: 23.317 },
  { name: "Rio de Janeiro", lat: -22.925, lon: -43.225 },
  { name: "Xi'an", lat: 34.275, lon: 108.895 },
  { name: "Helsinki", lat: 60.176, lon: 24.934 },
  { name: "Kunming", lat: 25.07, lon: 102.68 },
  { name: "Zagreb", lat: 45.8, lon: 16.0 },
  { name: "Nicosia", lat: 35.167, lon: 33.367 },
  { name: "Karachi", lat: 24.87, lon: 66.99 },
  { name: "Caracas", lat: 10.501, lon: -66.917 },
  { name: "Panama City", lat: 8.968, lon: -79.533 },
  { name: "Chennai", lat: 13.09, lon: 80.28 },
  { name: "Tunis", lat: 36.803, lon: 10.18 },
  { name: "Fuzhou", lat: 26.08, lon: 119.3 },
  { name: "Guatemala City", lat: 14.621, lon: -90.527 },
  { name: "Hyderabad", lat: 17.4, lon: 78.48 },
  { name: "Cape Town", lat: -33.92, lon: 18.435 },
  { name: "Dhaka", lat: 23.723, lon: 90.409 },
  { name: "Porto", lat: 41.15, lon: -8.62 },
  { name: "Austin", lat: 30.267, lon: -97.743 },
  { name: "Minneapolis", lat: 44.98, lon: -93.252 },
  { name: "Almaty", lat: 43.325, lon: 76.915 },
  { name: "Santo Domingo", lat: 18.47, lon: -69.9 },
  { name: "Adelaide", lat: -34.935, lon: 138.6 },
  { name: "Lahore", lat: 31.56, lon: 74.35 },
  { name: "Colombo", lat: 6.932, lon: 79.858 },
  { name: "Taiyuan", lat: 37.875, lon: 112.545 },
  { name: "Kuwait City", lat: 29.37, lon: 47.978 },
  { name: "Monterrey", lat: 25.67, lon: -100.33 },
  { name: "Osaka", lat: 34.75, lon: 135.46 },
  { name: "Haikou", lat: 20.05, lon: 110.32 },
  { name: "Tbilisi", lat: 41.725, lon: 44.791 },
  { name: "Tampa", lat: 27.947, lon: -82.459 },
  { name: "Tirana", lat: 41.328, lon: 19.819 },
  { name: "Quito", lat: -0.215, lon: -78.5 },
  { name: "Nashville", lat: 36.17, lon: -86.78 },
  { name: "Islamabad", lat: 33.7, lon: 73.167 },
  { name: "Kampala", lat: 0.317, lon: 32.583 },
  { name: "San Salvador", lat: 13.71, lon: -89.203 },
  { name: "Muscat", lat: 23.613, lon: 58.593 },
  { name: "Phnom Penh", lat: 11.55, lon: 104.917 },
  { name: "Harbin", lat: 45.75, lon: 126.65 },
  { name: "Bologna", lat: 44.5, lon: 11.34 },
  { name: "San José", lat: 9.935, lon: -84.084 },
  { name: "Ahmedabad", lat: 23.03, lon: 72.58 },
  { name: "Bristol", lat: 51.45, lon: -2.583 },
  { name: "Tegucigalpa", lat: 14.102, lon: -87.218 },
  { name: "Riga", lat: 56.95, lon: 24.1 },
  { name: "Detroit", lat: 42.33, lon: -83.08 },
  { name: "Poznan", lat: 52.406, lon: 16.9 },
  { name: "Charlotte", lat: 35.205, lon: -80.83 },
  { name: "Pittsburgh", lat: 40.43, lon: -80.0 },
  { name: "Valencia", lat: 39.485, lon: -0.4 },
  { name: "Edinburgh", lat: 55.948, lon: -3.219 },
  { name: "Jeddah", lat: 21.517, lon: 39.219 },
  { name: "Katowice", lat: 50.26, lon: 19.02 },
  { name: "Baku", lat: 40.395, lon: 49.862 },
  { name: "George Town", lat: 5.414, lon: 100.329 },
  { name: "Dar es Salaam", lat: -6.8, lon: 39.268 },
  { name: "Wellington", lat: -41.3, lon: 174.783 },
  { name: "Managua", lat: 12.153, lon: -86.268 },
  { name: "Nanchang", lat: 28.68, lon: 115.88 },
  { name: "Changchun", lat: 43.865, lon: 125.34 },
  { name: "Cali", lat: 3.4, lon: -76.5 },
  { name: "St Louis", lat: 38.635, lon: -90.24 },
  { name: "Bilbao", lat: 43.25, lon: -2.93 },
  { name: "Marseille", lat: 43.29, lon: 5.375 },
  { name: "Surabaya", lat: -7.249, lon: 112.751 },
  { name: "Accra", lat: 5.55, lon: -0.217 },
  { name: "Izmir", lat: 38.436, lon: 27.152 },
  { name: "Harare", lat: -17.818, lon: 31.045 },
  { name: "Maputo", lat: -25.955, lon: 32.589 },
  { name: "Vilnius", lat: 54.683, lon: 25.317 },
  { name: "Göteborg", lat: 57.75, lon: 12.0 },
  { name: "Raleigh", lat: 35.819, lon: -78.645 },
  { name: "Queretaro", lat: 20.63, lon: -100.38 },
  { name: "Phoenix", lat: 33.54, lon: -112.07 },
  { name: "Dakar", lat: 14.716, lon: -17.473 },
  { name: "Cincinnati", lat: 39.162, lon: -84.457 },
  { name: "Kansas City", lat: 39.107, lon: -94.604 },
  { name: "La Paz", lat: -16.498, lon: -68.15 },
  { name: "Guayaquil", lat: -2.22, lon: -79.92 },
  { name: "Indianapolis", lat: 39.75, lon: -86.17 },
  { name: "Algiers", lat: 36.763, lon: 3.051 },
  { name: "Shijiazhuang", lat: 38.05, lon: 114.48 },
  { name: "Lusaka", lat: -15.417, lon: 28.283 },
  { name: "Guadalajara", lat: 20.67, lon: -103.33 },
  { name: "Ankara", lat: 39.927, lon: 32.864 },
  { name: "Ottawa", lat: 45.417, lon: -75.7 },
  { name: "Urumqi", lat: 43.805, lon: 87.575 },
  { name: "Christchurch", lat: -43.535, lon: 172.63 },
  { name: "Douala", lat: 4.06, lon: 9.71 },
  { name: "Tashkent", lat: 41.312, lon: 69.295 },
  { name: "Salt Lake City", lat: 40.775, lon: -111.93 },
  { name: "Nantes", lat: 47.21, lon: -1.59 },
  { name: "Medellin", lat: 6.275, lon: -75.575 },
  { name: "Edmonton", lat: 53.55, lon: -113.5 },
  { name: "Abuja", lat: 9.083, lon: 7.533 },
  { name: "Yangon", lat: 16.783, lon: 96.167 },
  { name: "Jacksonville", lat: 30.33, lon: -81.67 },
  { name: "Belo Horizonte", lat: -19.915, lon: -43.915 },
  { name: "Naples", lat: 40.84, lon: 14.245 },
  { name: "Curitiba", lat: -25.42, lon: -49.32 },
  { name: "Luanda", lat: -8.838, lon: 13.234 },
  { name: "Abidjan", lat: 5.32, lon: -4.04 },
  { name: "Nassau", lat: 25.083, lon: -77.35 },
  { name: "Gaborone", lat: -24.646, lon: 25.912 },
  { name: "Toulouse", lat: 43.62, lon: 1.45 },
  { name: "Brasilia", lat: -15.783, lon: -47.916 },
  { name: "Kaohsiung", lat: 22.633, lon: 120.267 },
  { name: "Porto Alegre", lat: -30.05, lon: -51.2 },
  { name: "Des Moines", lat: 41.58, lon: -93.62 },
  { name: "Guiyang", lat: 26.58, lon: 106.72 },
  { name: "Tijuana", lat: 32.5, lon: -117.08 },
  { name: "Nanning", lat: 22.82, lon: 108.32 },
  { name: "Canberra", lat: -35.283, lon: 149.129 },
  { name: "Port of Spain", lat: 10.652, lon: -61.517 },
  { name: "Cordoba", lat: -31.4, lon: -64.182 },
  { name: "Sarajevo", lat: 43.85, lon: 18.383 },
  { name: "Bordeaux", lat: 44.85, lon: -0.595 },
  { name: "Oklahoma City", lat: 35.47, lon: -97.519 },
  { name: "Astana", lat: 51.181, lon: 71.428 },
  { name: "Lanzhou", lat: 36.056, lon: 103.792 },
  { name: "Durban", lat: -29.865, lon: 30.98 },
  { name: "Portland", lat: 45.52, lon: -122.68 },
  { name: "San Juan", lat: 18.44, lon: -66.13 },
  { name: "Bergen", lat: 60.391, lon: 5.325 },
  { name: "Yerevan", lat: 40.181, lon: 44.514 },
  { name: "Santa Cruz", lat: -17.754, lon: -63.226 },
  { name: "Asuncion", lat: -25.296, lon: -57.642 },
  { name: "Cebu", lat: 10.32, lon: 123.9 },
  { name: "Hohhot", lat: 40.82, lon: 111.66 },
  { name: "Birmingham", lat: 33.53, lon: -86.825 },
  { name: "Las Vegas", lat: 36.21, lon: -115.22 },
  { name: "Ciudad Juarez", lat: 31.69, lon: -106.49 },
  { name: "Winnipeg", lat: 49.883, lon: -97.166 },
  { name: "Windhoek", lat: -22.57, lon: 17.084 },
  { name: "San Pedro Sula", lat: 15.5, lon: -88.03 },
  { name: "Seville", lat: 37.405, lon: -5.98 },
  { name: "Recife", lat: -8.076, lon: -34.916 },
  { name: "Alexandria", lat: 31.2, lon: 29.95 },
  { name: "Moscow", lat: 55.752, lon: 37.616 },
  { name: "Vientiane", lat: 17.967, lon: 102.6 },
  { name: "Ulaanbaatar", lat: 47.917, lon: 106.917 },
  { name: "Salvador", lat: -12.97, lon: -38.48 },
  { name: "Memphis", lat: 35.12, lon: -90.0 },
  { name: "Yinchuan", lat: 38.468, lon: 106.273 },
  { name: "Kolkata", lat: 22.495, lon: 88.325 },
  { name: "Halifax", lat: 44.65, lon: -63.6 },
  { name: "San Luis Potosí", lat: 22.17, lon: -101.0 },
  { name: "Barranquilla", lat: 10.96, lon: -74.8 },
  { name: "Libreville", lat: 0.385, lon: 9.458 },
  { name: "Wenzhou", lat: 28.02, lon: 120.65 },
  { name: "Blantyre", lat: -15.79, lon: 34.99 },
];

/** Find the nearest major city to given coordinates */
const getNearestMajorCity = (coords: Coordinates): string => {
  let nearestCity = MAJOR_CITIES[0];
  let nearestDist = Infinity;

  for (const city of MAJOR_CITIES) {
    const dist = haversineDistance(coords, { lat: city.lat, lon: city.lon });
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestCity = city;
    }
  }

  return nearestCity.name;
};

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
      `http://ip-api.com/json/${ip}?fields=lat,lon`,
    );
    if (!res.ok) return {};
    const data = await res.json();
    const coordinates = typeof data.lat === "number" &&
        typeof data.lon === "number"
      ? { lat: data.lat, lon: data.lon }
      : undefined;

    // Use local major cities database for name instead of API's city
    const name = coordinates ? getNearestMajorCity(coordinates) : undefined;

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

/** Calculate Haversine distance between two coordinate pairs in kilometers */
export const haversineDistance = (a: Coordinates, b: Coordinates): number => {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => deg * Math.PI / 180;
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);
  const dLat = latB - latA;
  const dLon = toRad(b.lon - a.lon);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(latA) * Math.cos(latB) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
};
