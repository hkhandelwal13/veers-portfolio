/**
 * Where a visitor is, to the nearest timezone.
 *
 * The HUD wants a country code and a temperature. Both usually come from an IP
 * lookup, which means handing a third party the visitor's address on every page
 * load to decorate a corner of the screen. This is the cheaper trade: the
 * browser already knows its own IANA zone — `Asia/Kolkata`, `Europe/Berlin` —
 * and a zone names a place accurately enough for a two-letter code and a
 * temperature that is only ever read as weather.
 *
 * So the only request that leaves the page goes to the weather service, and it
 * carries a city centroid rather than anything about the visitor. The
 * coordinates below are each zone's own reference city.
 *
 * A zone that is not in this table degrades cleanly: the clock still reads
 * local, and the HUD simply shows no country and no temperature. The list is
 * the common zones, not all ~400 of them — the long tail is islands and
 * historical aliases, and adding one is a line.
 */

export type ZonePlace = {
  /** ISO 3166-1 alpha-2, as the HUD prints it. */
  cc: string
  lat: number
  lon: number
}

export const ZONE_PLACES: Record<string, ZonePlace> = {
  // --- Asia ---
  'Asia/Kolkata': { cc: 'IN', lat: 22.57, lon: 88.36 },
  'Asia/Calcutta': { cc: 'IN', lat: 22.57, lon: 88.36 },
  'Asia/Karachi': { cc: 'PK', lat: 24.86, lon: 67.0 },
  'Asia/Dhaka': { cc: 'BD', lat: 23.81, lon: 90.41 },
  'Asia/Kathmandu': { cc: 'NP', lat: 27.72, lon: 85.32 },
  'Asia/Colombo': { cc: 'LK', lat: 6.93, lon: 79.86 },
  'Asia/Dubai': { cc: 'AE', lat: 25.2, lon: 55.27 },
  'Asia/Qatar': { cc: 'QA', lat: 25.29, lon: 51.53 },
  'Asia/Riyadh': { cc: 'SA', lat: 24.71, lon: 46.68 },
  'Asia/Tehran': { cc: 'IR', lat: 35.69, lon: 51.39 },
  'Asia/Jerusalem': { cc: 'IL', lat: 31.77, lon: 35.21 },
  'Asia/Istanbul': { cc: 'TR', lat: 41.01, lon: 28.98 },
  'Asia/Shanghai': { cc: 'CN', lat: 31.23, lon: 121.47 },
  'Asia/Chongqing': { cc: 'CN', lat: 29.56, lon: 106.55 },
  'Asia/Hong_Kong': { cc: 'HK', lat: 22.32, lon: 114.17 },
  'Asia/Taipei': { cc: 'TW', lat: 25.03, lon: 121.57 },
  'Asia/Tokyo': { cc: 'JP', lat: 35.68, lon: 139.69 },
  'Asia/Seoul': { cc: 'KR', lat: 37.57, lon: 126.98 },
  'Asia/Singapore': { cc: 'SG', lat: 1.35, lon: 103.82 },
  'Asia/Kuala_Lumpur': { cc: 'MY', lat: 3.14, lon: 101.69 },
  'Asia/Jakarta': { cc: 'ID', lat: -6.21, lon: 106.85 },
  'Asia/Bangkok': { cc: 'TH', lat: 13.76, lon: 100.5 },
  'Asia/Ho_Chi_Minh': { cc: 'VN', lat: 10.82, lon: 106.63 },
  'Asia/Saigon': { cc: 'VN', lat: 10.82, lon: 106.63 },
  'Asia/Manila': { cc: 'PH', lat: 14.6, lon: 120.98 },
  'Asia/Yangon': { cc: 'MM', lat: 16.87, lon: 96.2 },
  'Asia/Almaty': { cc: 'KZ', lat: 43.24, lon: 76.89 },
  'Asia/Tashkent': { cc: 'UZ', lat: 41.3, lon: 69.24 },
  'Asia/Baku': { cc: 'AZ', lat: 40.41, lon: 49.87 },
  'Asia/Tbilisi': { cc: 'GE', lat: 41.72, lon: 44.78 },
  'Asia/Yerevan': { cc: 'AM', lat: 40.18, lon: 44.51 },

  // --- Europe ---
  'Europe/London': { cc: 'GB', lat: 51.51, lon: -0.13 },
  'Europe/Dublin': { cc: 'IE', lat: 53.35, lon: -6.26 },
  'Europe/Lisbon': { cc: 'PT', lat: 38.72, lon: -9.14 },
  'Europe/Madrid': { cc: 'ES', lat: 40.42, lon: -3.7 },
  'Europe/Paris': { cc: 'FR', lat: 48.86, lon: 2.35 },
  'Europe/Brussels': { cc: 'BE', lat: 50.85, lon: 4.35 },
  'Europe/Amsterdam': { cc: 'NL', lat: 52.37, lon: 4.9 },
  'Europe/Berlin': { cc: 'DE', lat: 52.52, lon: 13.4 },
  'Europe/Zurich': { cc: 'CH', lat: 47.38, lon: 8.54 },
  'Europe/Vienna': { cc: 'AT', lat: 48.21, lon: 16.37 },
  'Europe/Rome': { cc: 'IT', lat: 41.9, lon: 12.5 },
  'Europe/Prague': { cc: 'CZ', lat: 50.08, lon: 14.44 },
  'Europe/Warsaw': { cc: 'PL', lat: 52.23, lon: 21.01 },
  'Europe/Budapest': { cc: 'HU', lat: 47.5, lon: 19.04 },
  'Europe/Bucharest': { cc: 'RO', lat: 44.43, lon: 26.1 },
  'Europe/Athens': { cc: 'GR', lat: 37.98, lon: 23.73 },
  'Europe/Stockholm': { cc: 'SE', lat: 59.33, lon: 18.07 },
  'Europe/Oslo': { cc: 'NO', lat: 59.91, lon: 10.75 },
  'Europe/Copenhagen': { cc: 'DK', lat: 55.68, lon: 12.57 },
  'Europe/Helsinki': { cc: 'FI', lat: 60.17, lon: 24.94 },
  'Europe/Kyiv': { cc: 'UA', lat: 50.45, lon: 30.52 },
  'Europe/Kiev': { cc: 'UA', lat: 50.45, lon: 30.52 },
  'Europe/Moscow': { cc: 'RU', lat: 55.76, lon: 37.62 },
  'Europe/Istanbul': { cc: 'TR', lat: 41.01, lon: 28.98 },

  // --- Africa ---
  'Africa/Cairo': { cc: 'EG', lat: 30.04, lon: 31.24 },
  'Africa/Lagos': { cc: 'NG', lat: 6.52, lon: 3.38 },
  'Africa/Accra': { cc: 'GH', lat: 5.6, lon: -0.19 },
  'Africa/Nairobi': { cc: 'KE', lat: -1.29, lon: 36.82 },
  'Africa/Johannesburg': { cc: 'ZA', lat: -26.2, lon: 28.05 },
  'Africa/Casablanca': { cc: 'MA', lat: 33.57, lon: -7.59 },
  'Africa/Algiers': { cc: 'DZ', lat: 36.75, lon: 3.06 },
  'Africa/Tunis': { cc: 'TN', lat: 36.81, lon: 10.18 },

  // --- Americas ---
  'America/New_York': { cc: 'US', lat: 40.71, lon: -74.01 },
  'America/Detroit': { cc: 'US', lat: 42.33, lon: -83.05 },
  'America/Toronto': { cc: 'CA', lat: 43.65, lon: -79.38 },
  'America/Montreal': { cc: 'CA', lat: 45.5, lon: -73.57 },
  'America/Chicago': { cc: 'US', lat: 41.88, lon: -87.63 },
  'America/Winnipeg': { cc: 'CA', lat: 49.9, lon: -97.14 },
  'America/Denver': { cc: 'US', lat: 39.74, lon: -104.99 },
  'America/Phoenix': { cc: 'US', lat: 33.45, lon: -112.07 },
  'America/Edmonton': { cc: 'CA', lat: 53.55, lon: -113.49 },
  'America/Los_Angeles': { cc: 'US', lat: 34.05, lon: -118.24 },
  'America/Vancouver': { cc: 'CA', lat: 49.28, lon: -123.12 },
  'America/Anchorage': { cc: 'US', lat: 61.22, lon: -149.9 },
  'Pacific/Honolulu': { cc: 'US', lat: 21.31, lon: -157.86 },
  'America/Mexico_City': { cc: 'MX', lat: 19.43, lon: -99.13 },
  'America/Bogota': { cc: 'CO', lat: 4.71, lon: -74.07 },
  'America/Lima': { cc: 'PE', lat: -12.05, lon: -77.04 },
  'America/Santiago': { cc: 'CL', lat: -33.45, lon: -70.67 },
  'America/Sao_Paulo': { cc: 'BR', lat: -23.55, lon: -46.63 },
  'America/Argentina/Buenos_Aires': { cc: 'AR', lat: -34.6, lon: -58.38 },
  'America/Halifax': { cc: 'CA', lat: 44.65, lon: -63.58 },
  'America/Panama': { cc: 'PA', lat: 8.98, lon: -79.52 },
  'America/Havana': { cc: 'CU', lat: 23.11, lon: -82.37 },

  // --- Oceania ---
  'Australia/Sydney': { cc: 'AU', lat: -33.87, lon: 151.21 },
  'Australia/Melbourne': { cc: 'AU', lat: -37.81, lon: 144.96 },
  'Australia/Brisbane': { cc: 'AU', lat: -27.47, lon: 153.03 },
  'Australia/Adelaide': { cc: 'AU', lat: -34.93, lon: 138.6 },
  'Australia/Perth': { cc: 'AU', lat: -31.95, lon: 115.86 },
  'Pacific/Auckland': { cc: 'NZ', lat: -36.85, lon: 174.76 },
  'Pacific/Fiji': { cc: 'FJ', lat: -18.14, lon: 178.44 },
}

/** The visitor's own IANA zone, or null where the browser will not say. */
export function getTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export function getZonePlace(zone: string | null): ZonePlace | null {
  if (!zone) return null
  return ZONE_PLACES[zone] ?? null
}
