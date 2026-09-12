import { geocodeCity, fetchWeather, fetchWeatherForLocations, reverseGeocode, WeatherApiError } from "./api.js";
import { loadStations, saveStations, loadActiveId, saveActiveId, loadUnits, saveUnits } from "./storage.js";
import { paintSky } from "./sky.js";
import * as ui from "./ui.js";

/**
 * App state:
 *   stations: [{ location, status: 'loading'|'ready'|'error', data, error }]
 *   activeId: string | null
 *   units: { temp: 'c'|'f', wind: 'kmh'|'mph' }
 */
const state = {
  stations: [],
  activeId: null,
  units: loadUnits(),
};

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("searchInput"),
  clock: document.getElementById("clock"),
  unitToggle: document.getElementById("unitToggle"),
  geoBtn: document.getElementById("geoBtn"),
};

init();

async function init() {
  const saved = loadStations();
  state.stations = saved.map((location) => ({ location, status: "loading", data: null, error: null }));
  state.activeId = loadActiveId() ?? saved[0]?.id ?? null;

  renderAll();
  tickClock();
  setInterval(tickClock, 30_000);

  if (saved.length > 0) {
    await hydrateAll(saved);
  } else {
    ui.renderHeroEmpty();
    const hour = new Date().getHours();
    paintSky({ code: 1, isDay: hour >= 6 && hour < 19 });
  }

  wireSearch();
  wireGlobalClicks();
  wireUnitToggle();
  wireGeolocation();
}

/* ------------------------------ Data loading ----------------------------- */

async function hydrateAll(locations) {
  const results = await fetchWeatherForLocations(locations);
  for (const r of results) {
    const entry = state.stations.find((s) => s.location.id === r.location.id);
    if (!entry) continue;
    if (r.status === "fulfilled") {
      entry.status = "ready";
      entry.data = r.data;
    } else {
      entry.status = "error";
      entry.error = describeError(r.error);
    }
  }
  renderAll();
}

async function hydrateOne(location) {
  const entry = state.stations.find((s) => s.location.id === location.id);
  if (entry) {
    entry.status = "loading";
    renderStationsOnly();
    if (state.activeId === location.id) ui.renderHeroLoading(location.name);
  }
  try {
    const data = await fetchWeather(location.latitude, location.longitude);
    if (entry) {
      entry.status = "ready";
      entry.data = data;
      entry.error = null;
    }
  } catch (err) {
    if (entry) {
      entry.status = "error";
      entry.error = describeError(err);
    }
  }
  renderAll();
}

function describeError(err) {
  if (err instanceof WeatherApiError) return err.message;
  return "Something went wrong reading this station.";
}

/* -------------------------------- Actions -------------------------------- */

async function addStation(location) {
  const exists = state.stations.some((s) => s.location.id === location.id);
  if (exists) {
    setActive(location.id);
    ui.toast(`${location.name} is already on your board.`);
    return;
  }
  state.stations.push({ location, status: "loading", data: null, error: null });
  state.activeId = location.id;
  saveActiveId(location.id);
  persist();
  renderAll();
  ui.renderHeroLoading(location.name);
  await hydrateOne(location);
  ui.toast(`${location.name} added to your board.`);
}

function removeStation(id) {
  const removed = state.stations.find((s) => s.location.id === id);
  state.stations = state.stations.filter((s) => s.location.id !== id);
  if (state.activeId === id) {
    state.activeId = state.stations[0]?.location.id ?? null;
    saveActiveId(state.activeId ?? "");
  }
  persist();
  renderAll();
  if (removed) ui.toast(`${removed.location.name} removed.`);
}

function setActive(id) {
  state.activeId = id;
  saveActiveId(id);
  renderAll();
}

function persist() {
  saveStations(state.stations.map((s) => s.location));
}

/* -------------------------------- Rendering ------------------------------- */

function renderAll() {
  renderStationsOnly();
  const active = state.stations.find((s) => s.location.id === state.activeId);

  if (!active) {
    ui.renderHeroEmpty();
    ui.renderReadouts(null);
    ui.renderForecast(null);
    ui.renderHourly(null);
    ui.renderPressureGauge(null);
    return;
  }

  if (active.status === "loading") {
    ui.renderHeroLoading(active.location.name);
    ui.renderReadouts(null);
    ui.renderForecast(null);
    ui.renderHourly(null);
    return;
  }

  if (active.status === "error") {
    ui.renderHeroError(active.location.name, active.error, {
      onRetry: () => hydrateOne(active.location),
    });
    ui.renderReadouts(null);
    ui.renderForecast(null);
    ui.renderHourly(null);
    return;
  }

  ui.renderHero(active.location, active.data, state.units);
  ui.renderReadouts(active.data, state.units);
  ui.renderForecast(active.data, state.units);
  ui.renderHourly(active.data, state.units);
  ui.renderPressureGauge(active.data.current.pressure);
  paintSky({ code: active.data.current.code, isDay: active.data.current.isDay });
}

function renderStationsOnly() {
  ui.renderStations(state.stations, state.activeId, {
    onSelect: setActive,
    onRemove: removeStation,
    units: state.units,
  });
}

/* --------------------------------- Search --------------------------------- */

const search = { results: [], activeIndex: -1, query: "" };

function wireSearch() {
  let debounceTimer = null;
  let requestId = 0;

  els.input.addEventListener("input", () => {
    const q = els.input.value.trim();
    search.query = q;
    search.activeIndex = -1;
    clearTimeout(debounceTimer);
    ui.setSearchLoading(false);

    if (q.length < 2) {
      search.results = [];
      ui.clearSearchResults();
      return;
    }

    const myRequest = ++requestId;
    ui.setSearchLoading(true);
    debounceTimer = setTimeout(async () => {
      try {
        const results = await geocodeCity(q);
        if (myRequest !== requestId) return; // superseded by a newer keystroke
        search.results = results;
        ui.renderSearchResults(results, { onPick: pickResult, query: q, activeIndex: -1 });
      } catch (err) {
        if (myRequest !== requestId) return;
        search.results = [];
        ui.renderSearchResults([], { onPick: pickResult, query: q });
        if (err instanceof WeatherApiError && /timed out|Network error/.test(err.message)) {
          ui.toast(err.message);
        }
      } finally {
        // Only the most recent request is allowed to control the spinner —
        // stale ones stay silent so they can't re-show it after the real
        // answer already landed. The timeout above guarantees this always
        // fires, so the spinner can never spin forever.
        if (myRequest === requestId) ui.setSearchLoading(false);
      }
    }, 400);
  });

  els.input.addEventListener("keydown", (e) => {
    if (search.results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      search.activeIndex = (search.activeIndex + 1) % search.results.length;
      refreshResultsHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      search.activeIndex = (search.activeIndex - 1 + search.results.length) % search.results.length;
      refreshResultsHighlight();
    } else if (e.key === "Enter" && search.activeIndex >= 0) {
      e.preventDefault();
      pickResult(search.results[search.activeIndex]);
    } else if (e.key === "Escape") {
      closeSearch();
      els.input.blur();
    }
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = els.input.value.trim();
    if (!q) {
      ui.toast("Enter a city name before searching.");
      return;
    }
    if (search.activeIndex >= 0 && search.results[search.activeIndex]) {
      pickResult(search.results[search.activeIndex]);
      return;
    }
    try {
      ui.setSearchLoading(true);
      const results = await geocodeCity(q);
      if (results.length === 0) {
        ui.renderSearchResults([], { onPick: pickResult, query: q });
        return;
      }
      pickResult(results[0]);
    } catch (err) {
      ui.toast(describeError(err));
    } finally {
      ui.setSearchLoading(false);
    }
  });

  document.getElementById("searchScrim").addEventListener("click", () => {
    closeSearch();
    els.input.blur();
  });
}

function refreshResultsHighlight() {
  ui.renderSearchResults(search.results, { onPick: pickResult, query: search.query, activeIndex: search.activeIndex });
}

function closeSearch() {
  search.results = [];
  search.activeIndex = -1;
  ui.clearSearchResults();
}

function pickResult(result) {
  closeSearch();
  els.input.value = "";
  addStation(result);
}

function wireGlobalClicks() {
  document.addEventListener("click", (e) => {
    if (!els.form.contains(e.target)) closeSearch();
  });

  let lastScrolled = false;
  const topbar = document.getElementById("topbar");
  document.addEventListener(
    "scroll",
    () => {
      const scrolled = window.scrollY > 8;
      if (scrolled !== lastScrolled) {
        topbar.classList.toggle("is-scrolled", scrolled);
        lastScrolled = scrolled;
      }
    },
    { passive: true }
  );
}

/* ------------------------------- Unit toggle ------------------------------- */

function wireUnitToggle() {
  if (!els.unitToggle) return;
  updateUnitToggleLabel();
  els.unitToggle.addEventListener("click", () => {
    state.units = {
      temp: state.units.temp === "c" ? "f" : "c",
      wind: state.units.wind === "kmh" ? "mph" : "kmh",
    };
    saveUnits(state.units);
    updateUnitToggleLabel();
    renderAll();
  });
}

function updateUnitToggleLabel() {
  if (!els.unitToggle) return;
  els.unitToggle.textContent = state.units.temp === "f" ? "°F" : "°C";
  els.unitToggle.setAttribute(
    "aria-label",
    `Switch to ${state.units.temp === "f" ? "Celsius" : "Fahrenheit"}`
  );
}

/* ------------------------------- Geolocation ------------------------------- */

function wireGeolocation() {
  if (!els.geoBtn) return;
  if (!("geolocation" in navigator)) {
    els.geoBtn.hidden = true;
    return;
  }
  els.geoBtn.addEventListener("click", () => {
    els.geoBtn.classList.add("is-locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const location = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          await addStation(location);
        } finally {
          els.geoBtn.classList.remove("is-locating");
        }
      },
      (err) => {
        els.geoBtn.classList.remove("is-locating");
        const messages = {
          1: "Location access was denied. Enable it in your browser's site settings to use this.",
          2: "Couldn't determine your location right now — try again, or search for your city instead.",
          3: "Location request timed out — try again, or search for your city instead.",
        };
        ui.toast(messages[err.code] || "Couldn't get your location.");
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 }
    );
  });
}

/* --------------------------------- Clock ---------------------------------- */

function tickClock() {
  els.clock.textContent = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}
