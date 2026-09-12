// Thin wrapper around Open-Meteo's free, keyless APIs. Kept isolated from
// rendering code so the data source could be swapped without touching UI.

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 12_000;

class WeatherApiError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = "WeatherApiError";
    this.cause = cause;
  }
}

/**
 * fetch() with a hard timeout. On a slow or dead mobile connection a plain
 * fetch can hang indefinitely with no rejection ever firing — which is what
 * left the search spinner and station-chip spinners spinning forever. This
 * guarantees every request either resolves or rejects within `ms`.
 */
async function fetchWithTimeout(url, ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new WeatherApiError("That took too long to respond. Check your connection and try again.");
    }
    throw new WeatherApiError("Network error — check your connection and try again.", { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a free-text city query to a list of candidate places.
 * Returns [] when nothing matches (not an error — an empty result set).
 */
export async function geocodeCity(query, { count = 5 } = {}) {
  const trimmed = query.trim();
  if (!trimmed) throw new WeatherApiError("Enter a city name to search.");

  const url = `${GEO_URL}?name=${encodeURIComponent(trimmed)}&count=${count}&language=en&format=json`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new WeatherApiError("The geocoding service is unavailable right now.");

  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    id: `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`,
    name: r.name,
    admin1: r.admin1 ?? "",
    country: r.country ?? "",
    countryCode: r.country_code ?? "",
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}

/**
 * Fetch current conditions + 5-day daily forecast for a single coordinate.
 */
export async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "surface_pressure",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
    ].join(","),
    hourly: ["temperature_2m", "weather_code", "is_day"].join(","),
    forecast_days: 5,
    timezone: "auto",
  });

  let res;
  try {
    res = await fetchWithTimeout(`${FORECAST_URL}?${params.toString()}`);
  } catch (err) {
    if (err instanceof WeatherApiError) throw err;
    throw new WeatherApiError("Network error while fetching weather.", { cause: err });
  }
  if (!res.ok) throw new WeatherApiError("Weather service returned an error for this location.");

  const data = await res.json();
  return normalizeForecast(data);
}

/**
 * Fetch weather for many saved locations concurrently. Failures are isolated
 * per-location (Promise.allSettled) so one bad station never blocks the rest.
 */
export async function fetchWeatherForLocations(locations) {
  const settled = await Promise.allSettled(
    locations.map((loc) => fetchWeather(loc.latitude, loc.longitude))
  );
  return settled.map((result, i) => ({
    location: locations[i],
    status: result.status,
    data: result.status === "fulfilled" ? result.value : null,
    error: result.status === "rejected" ? result.reason : null,
  }));
}

function normalizeForecast(raw) {
  const c = raw.current ?? {};
  const d = raw.daily ?? {};
  const h = raw.hourly ?? {};
  const days = (d.time ?? []).map((date, i) => ({
    date,
    code: d.weather_code?.[i],
    max: d.temperature_2m_max?.[i],
    min: d.temperature_2m_min?.[i],
    precipProb: d.precipitation_probability_max?.[i] ?? null,
  }));

  // Slice the hourly series down to "now through next 24h" — Open-Meteo
  // returns the full forecast window from local midnight, so we anchor on
  // raw.current.time (already in the station's own timezone).
  const nowIso = c.time ?? "";
  const allHours = (h.time ?? []).map((time, i) => ({
    time,
    temp: h.temperature_2m?.[i],
    code: h.weather_code?.[i],
    isDay: h.is_day?.[i] === 1,
  }));
  const startIdx = Math.max(
    0,
    allHours.findIndex((row) => row.time >= nowIso)
  );
  const hourly = allHours.slice(startIdx, startIdx + 24);

  return {
    current: {
      temp: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      pressure: c.surface_pressure,
      isDay: c.is_day === 1,
      code: c.weather_code,
    },
    days,
    hourly,
    timezone: raw.timezone,
    fetchedAt: Date.now(),
  };
}

/**
 * Reverse-geocode browser coordinates to a place name via BigDataCloud's
 * free, keyless client endpoint (no CORS issues, no signup). Open-Meteo's
 * own geocoder is forward-only (name → coords), so this fills the gap for
 * the "use my location" flow without introducing a second API key.
 */
export async function reverseGeocode(latitude, longitude) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  try {
    const res = await fetchWithTimeout(url, 8_000);
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    return {
      id: `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
      name: data.city || data.locality || data.principalSubdivision || "Current location",
      admin1: data.principalSubdivision ?? "",
      country: data.countryName ?? "",
      countryCode: data.countryCode ?? "",
      latitude,
      longitude,
    };
  } catch {
    // Reverse geocoding is a nicety, not a requirement — fall back to a
    // generic label so the location can still be added.
    return {
      id: `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
      name: "Current location",
      admin1: "",
      country: "",
      countryCode: "",
      latitude,
      longitude,
    };
  }
}

export { WeatherApiError };
