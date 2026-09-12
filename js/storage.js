// Persists the user's saved stations (locations) and active selection to
// localStorage. Isolated so the storage strategy could change later without
// touching app logic.

const KEY = "isobar:stations:v1";
const ACTIVE_KEY = "isobar:active:v1";

export function loadStations() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStations(stations) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stations));
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently,
    // the app still works for the current session.
  }
}

export function loadActiveId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

const UNITS_KEY = "isobar:units:v1";

/** @returns {{temp: 'c'|'f', wind: 'kmh'|'mph'}} */
export function loadUnits() {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    if (!raw) return { temp: "c", wind: "kmh" };
    const parsed = JSON.parse(raw);
    return {
      temp: parsed.temp === "f" ? "f" : "c",
      wind: parsed.wind === "mph" ? "mph" : "kmh",
    };
  } catch {
    return { temp: "c", wind: "kmh" };
  }
}

export function saveUnits(units) {
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(units));
  } catch {
    /* ignore */
  }
}
