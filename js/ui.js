import { describeCode, ICON_PATHS } from "./config.js";

const $ = (id) => document.getElementById(id);

export function icon(family, { size = 24, cls = "" } = {}) {
  const path = ICON_PATHS[family] ?? ICON_PATHS.cloudy;
  return `<svg class="wicon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${path}</svg>`;
}

function cToF(c) {
  return (c * 9) / 5 + 32;
}
function kmhToMph(k) {
  return k * 0.621371;
}

/** Converts a raw °C value into the active unit and rounds it — the single
 *  place temperature-unit math happens, so hero/readouts/forecast/hourly
 *  can never drift out of sync with each other. */
function convertTemp(celsius, units) {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return null;
  return units?.temp === "f" ? cToF(celsius) : celsius;
}

function fmtTemp(v, units) {
  const converted = convertTemp(v, units);
  return converted === null ? "—" : `${Math.round(converted)}°`;
}

function fmtWind(kmh, units) {
  if (kmh === null || kmh === undefined || Number.isNaN(kmh)) return "—";
  const val = units?.wind === "mph" ? kmhToMph(kmh) : kmh;
  return Math.round(val);
}

function windCompass(deg) {
  if (deg === null || deg === undefined) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function hourLabelFor(iso, timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: timezone }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Animates a hero temperature digit-by-digit from its previous value to
 *  the new one — a small tell that this is a live instrument, not a static
 *  label, without relying on any animation library. */
function animateNumber(el, from, to, { duration = 700, suffix = "°" } = {}) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || from === null || Number.isNaN(from)) {
    el.textContent = `${Math.round(to)}${suffix}`;
    return;
  }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const val = from + (to - from) * ease(p);
    el.textContent = `${Math.round(val)}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function localTimeFor(timezone) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return "";
  }
}

function dayLabel(dateStr, index) {
  if (index === 0) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
}

/* ---------------------------- Station chips ---------------------------- */

export function renderStations(stationStates, activeId, { onSelect, onRemove, units = { temp: "c", wind: "kmh" } }) {
  const row = $("stationRow");
  row.innerHTML = "";

  if (stationStates.length === 0) {
    row.innerHTML = `<p class="station-empty">No stations saved yet — search a city above to start tracking it.</p>`;
    return;
  }

  for (const s of stationStates) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "station-chip" + (s.location.id === activeId ? " is-active" : "");
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-selected", String(s.location.id === activeId));

    const family = s.data ? describeCode(s.data.current.code).family : "cloudy";
    const temp = s.status === "loading" ? "" : s.data ? fmtTemp(s.data.current.temp, units) : "!";

    chip.innerHTML = `
      <span class="chip-stub">
        <span class="chip-icon">${s.status === "loading" ? spinnerSvg() : icon(family, { size: 18 })}</span>
        <span class="chip-body">
          <span class="chip-name">${escapeHtml(s.location.name)}</span>
          <span class="chip-sub">${escapeHtml(s.location.country || "")}</span>
        </span>
        <span class="chip-temp">${s.status === "error" ? "—" : temp}</span>
      </span>
      <span class="chip-remove" data-remove aria-label="Remove ${escapeHtml(s.location.name)}">&times;</span>
    `;

    chip.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove]")) {
        e.stopPropagation();
        onRemove(s.location.id);
        return;
      }
      onSelect(s.location.id);
    });

    row.appendChild(chip);
  }
}

/* -------------------------------- Hero --------------------------------- */

export function renderHeroLoading(name) {
  $("heroContent").innerHTML = `
    <div class="hero-skel" aria-label="Loading weather for ${escapeHtml(name || "location")}">
      <div class="skel skel-eyebrow"></div>
      <div class="skel skel-temp"></div>
      <div class="skel skel-line"></div>
    </div>
  `;
}

export function renderHeroError(name, message, { onRetry } = {}) {
  $("heroContent").innerHTML = `
    <div class="hero-error">
      <span class="hero-error-tag">Reading failed</span>
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="retry-btn" id="retryBtn">Try again</button>
    </div>
  `;
  if (onRetry) $("retryBtn")?.addEventListener("click", onRetry);
}

export function renderHeroEmpty() {
  $("heroContent").innerHTML = `
    <div class="hero-empty">
      <h2>No station selected</h2>
      <p>Search for a city above, or add one of your saved stations, to bring its instrument reading online.</p>
    </div>
  `;
}

let lastHeroTemp = null;

export function renderHero(location, data, units = { temp: "c", wind: "kmh" }) {
  const cur = data.current;
  const { family, label } = describeCode(cur.code);
  const today = data.days?.[0];
  const time = localTimeFor(data.timezone);
  const displayTemp = convertTemp(cur.temp, units);

  $("heroContent").innerHTML = `
    <div class="hero-eyebrow">
      <span class="hero-place">${escapeHtml(location.name)}${location.admin1 ? `, ${escapeHtml(location.admin1)}` : ""}</span>
      <span class="hero-country">${escapeHtml(location.country || "")}</span>
      ${time ? `<span class="hero-time">${time} local</span>` : ""}
    </div>
    <div class="hero-main">
      <div class="hero-icon">${icon(family, { size: 76 })}</div>
      <div class="hero-temp"><span id="heroTempVal">${lastHeroTemp === null ? Math.round(displayTemp) + "°" : ""}</span><span class="hero-unit">${units.temp === "f" ? "F" : "C"}</span></div>
    </div>
    <div class="hero-condition">
      <span>${escapeHtml(label)}</span>
      ${today ? `<span class="hero-hilo">H ${fmtTemp(today.max, units)} · L ${fmtTemp(today.min, units)}</span>` : ""}
    </div>
  `;

  const tempEl = $("heroTempVal");
  if (displayTemp !== null) {
    animateNumber(tempEl, lastHeroTemp, displayTemp, { suffix: "°" });
    lastHeroTemp = displayTemp;
  }
}

/** Call when switching stations/units so the next hero render animates
 *  from a clean slate instead of counting from an unrelated station's temp. */
export function resetHeroAnimationBaseline() {
  lastHeroTemp = null;
}

function spinnerSvg() {
  return `<svg class="chip-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>`;
}

/* ------------------------------ Readouts -------------------------------- */

export function renderReadouts(data, units = { temp: "c", wind: "kmh" }) {
  const grid = $("readoutGrid");
  if (!data) {
    grid.innerHTML = "";
    return;
  }
  const cur = data.current;
  const humidityPct = Math.max(0, Math.min(100, Number(cur.humidity) || 0));
  const windDeg = cur.windDir ?? 0;
  // Feels-like gets a temperature-driven accent so the card itself signals
  // "hot" or "cold" at a glance, not just the number inside it.
  const feelsC = units.temp === "f" ? ((cur.feelsLike - 32) * 5) / 9 : cur.feelsLike;
  const feelsTone = feelsC >= 34 ? "hot" : feelsC <= 16 ? "cold" : "mild";

  const cards = [
    {
      cls: `readout-feels tone-${feelsTone}`,
      icon: thermoIcon(feelsTone),
      label: "Feels like",
      value: fmtTemp(cur.feelsLike, units),
      unit: "",
      visual: "",
    },
    {
      cls: "readout-humidity",
      icon: dropletIcon(),
      label: "Humidity",
      value: cur.humidity ?? "—",
      unit: "%",
      visual: `<div class="readout-bar"><span style="width:${humidityPct}%"></span></div>`,
    },
    {
      cls: "readout-wind",
      icon: compassIcon(windDeg),
      label: "Wind",
      value: fmtWind(cur.windSpeed, units),
      unit: `${units.wind === "mph" ? "mph" : "km/h"} ${windCompass(cur.windDir)}`,
      visual: "",
    },
  ];

  grid.innerHTML = cards
    .map(
      (r, i) => `
      <div class="readout ${r.cls}" style="--i:${i}">
        <div class="readout-top">
          <span class="readout-icon">${r.icon}</span>
          <span class="readout-label">${r.label}</span>
        </div>
        <span class="readout-value">${r.value}<span class="readout-unit">${r.unit}</span></span>
        ${r.visual}
      </div>`
    )
    .join("");
}

function thermoIcon(tone) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tone-${tone}"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z"/><line x1="11.5" y1="7" x2="11.5" y2="14"/></svg>`;
}
function dropletIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5s6.5 7.1 6.5 12A6.5 6.5 0 0 1 5.5 14.5C5.5 9.6 12 2.5 12 2.5Z"/></svg>`;
}
function compassIcon(deg) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><g style="transform-origin:12px 12px; transform:rotate(${deg}deg); transition: transform 700ms var(--ease-spring, ease);"><path d="M12 5.5 14.4 13 12 11.4 9.6 13 12 5.5Z" fill="currentColor" stroke="none"/></g></svg>`;
}

/* --------------------------- Pressure gauge ------------------------------ */
// Signature instrument: a real analog barometer dial. 950–1050 hPa is the
// range a station will realistically ever report; the needle sweeps to its
// reading with a spring easing so it reads as a physical instrument, not a
// re-skinned number.

const GAUGE_MIN = 950;
const GAUGE_MAX = 1050;
const GAUGE_SWEEP_DEG = 260; // total arc the needle travels
const GAUGE_START_DEG = -130; // angle of GAUGE_MIN, 0° = pointing right

function pressureToAngle(hpa) {
  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, hpa));
  const frac = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
  return GAUGE_START_DEG + frac * GAUGE_SWEEP_DEG;
}

function pressureTrend(hpa) {
  if (hpa === null || hpa === undefined) return null;
  if (hpa >= 1022) return { label: "High — settled", cls: "trend-high" };
  if (hpa <= 1000) return { label: "Low — unsettled", cls: "trend-low" };
  return { label: "Steady", cls: "trend-mid" };
}

let gaugeInitialized = false;

export function renderPressureGauge(pressureHpa) {
  const el = $("pressureGauge");
  if (!el) return;

  const hasReading = pressureHpa !== null && pressureHpa !== undefined && !Number.isNaN(pressureHpa);
  const angle = hasReading ? pressureToAngle(pressureHpa) : GAUGE_START_DEG;
  const trend = hasReading ? pressureTrend(pressureHpa) : null;

  const ticks = [];
  const majorStep = 10;
  for (let v = GAUGE_MIN; v <= GAUGE_MAX; v += majorStep) {
    const a = pressureToAngle(v);
    const major = v % 50 === 0;
    ticks.push(`<line
      class="gauge-tick${major ? " gauge-tick-major" : ""}"
      transform="rotate(${a} 60 60)"
      x1="60" y1="${major ? 12 : 15}" x2="60" y2="20" />`);
    if (major) {
      const rad = (a * Math.PI) / 180;
      const r = 32;
      const x = 60 + r * Math.sin(rad);
      const y = 60 - r * Math.cos(rad);
      ticks.push(`<text class="gauge-num" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${v}</text>`);
    }
  }

  // Only rebuild the static dial face once; subsequent calls just rotate
  // the needle and update the readout text, which is what makes the sweep
  // animate smoothly via CSS transition instead of popping.
  if (!gaugeInitialized) {
    el.innerHTML = `
      <svg viewBox="0 0 120 108" class="gauge-svg" role="img" aria-label="Barometric pressure gauge">
        <circle cx="60" cy="60" r="52" class="gauge-face" />
        <circle cx="60" cy="60" r="52" class="gauge-rim" />
        <g class="gauge-ticks">${ticks.join("")}</g>
        <g id="gaugeNeedleGroup" style="transform: rotate(${angle}deg); transform-origin: 60px 60px;">
          <line x1="60" y1="60" x2="60" y2="24" class="gauge-needle" />
          <circle cx="60" cy="60" r="4.5" class="gauge-pivot" />
        </g>
      </svg>
      <div class="gauge-readout">
        <span id="gaugeValue" class="gauge-value">${hasReading ? Math.round(pressureHpa) : "—"}</span>
        <span class="gauge-unit">hPa</span>
        <span id="gaugeTrend" class="gauge-trend ${trend?.cls ?? ""}">${trend?.label ?? "No reading"}</span>
      </div>
    `;
    gaugeInitialized = true;
    return;
  }

  const needle = document.getElementById("gaugeNeedleGroup");
  if (needle) needle.style.transform = `rotate(${angle}deg)`;
  const valueEl = document.getElementById("gaugeValue");
  if (valueEl) valueEl.textContent = hasReading ? Math.round(pressureHpa) : "—";
  const trendEl = document.getElementById("gaugeTrend");
  if (trendEl) {
    trendEl.textContent = trend?.label ?? "No reading";
    trendEl.className = `gauge-trend ${trend?.cls ?? ""}`;
  }
}

/* ---------------------------- Hourly strip -------------------------------- */

export function renderHourly(data, units = { temp: "c", wind: "kmh" }) {
  const el = $("hourlyStrip");
  if (!el) return;
  const hours = data?.hourly;
  if (!hours || hours.length === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = hours
    .slice(0, 18)
    .map((h, i) => {
      const { family } = describeCode(h.code);
      const label = i === 0 ? "Now" : hourLabelFor(h.time, data.timezone);
      return `
        <div class="hour-card" style="--i:${i}">
          <span class="hour-label">${escapeHtml(label)}</span>
          <span class="hour-icon">${icon(family, { size: 22 })}</span>
          <span class="hour-temp">${fmtTemp(h.temp, units)}</span>
        </div>`;
    })
    .join("");
}

/* ------------------------------ Forecast --------------------------------- */

export function renderForecast(data, units = { temp: "c", wind: "kmh" }) {
  const el = $("forecastChart");
  if (!data || !data.days?.length) {
    el.innerHTML = `<p class="forecast-empty">No forecast to trace yet.</p>`;
    return;
  }

  const days = data.days;
  const highsC = days.map((d) => d.max);
  const lowsC = days.map((d) => d.min);
  const highs = highsC.map((v) => convertTemp(v, units));
  const lows = lowsC.map((v) => convertTemp(v, units));
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = Math.max(max - min, 1);

  const W = 600;
  const H = 160;
  const padX = 40;
  const padY = 28;
  const stepX = (W - padX * 2) / (days.length - 1 || 1);

  const yFor = (v) => H - padY - ((v - min) / range) * (H - padY * 2);
  const highPts = highs.map((v, i) => [padX + i * stepX, yFor(v)]);
  const lowPts = lows.map((v, i) => [padX + i * stepX, yFor(v)]);

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  const highPath = toPath(highPts);
  const lowPath = toPath(lowPts);
  const bandPath = `${toPath(highPts)} L${lowPts[lowPts.length - 1][0].toFixed(1)},${lowPts[lowPts.length - 1][1].toFixed(1)} ${lowPts
    .slice()
    .reverse()
    .map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ")} Z`;

  const ticks = days
    .map((d, i) => {
      const { family } = describeCode(d.code);
      const x = padX + i * stepX;
      return `
      <g class="fx-tick" style="--i:${i}">
        <foreignObject x="${x - 14}" y="${yFor(highs[i]) - 40}" width="28" height="28">
          <div xmlns="http://www.w3.org/1999/xhtml" class="fx-icon">${icon(family, { size: 22 })}</div>
        </foreignObject>
        <circle cx="${x}" cy="${yFor(highs[i])}" r="3.2" class="fx-dot fx-dot-high" />
        <circle cx="${x}" cy="${yFor(lows[i])}" r="3.2" class="fx-dot fx-dot-low" />
        <text x="${x}" y="${H - 6}" class="fx-label" text-anchor="middle">${dayLabel(d.date, i)}</text>
        <text x="${x}" y="${yFor(highs[i]) - 46}" class="fx-value fx-value-high" text-anchor="middle">${Math.round(highs[i])}°</text>
        <text x="${x}" y="${yFor(lows[i]) + 16}" class="fx-value fx-value-low" text-anchor="middle">${Math.round(lows[i])}°</text>
      </g>`;
    })
    .join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="fx-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="5 day temperature trace">
      <path d="${bandPath}" class="fx-band" />
      <path d="${lowPath}" class="fx-line fx-line-low" pathLength="1" />
      <path d="${highPath}" class="fx-line fx-line-high" pathLength="1" />
      ${ticks}
    </svg>
  `;
}

/* -------------------------------- Toast --------------------------------- */

let toastTimer = null;
export function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  el.classList.remove("toast-in");
  void el.offsetWidth;
  el.classList.add("toast-in");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

/* ----------------------------- Search results ---------------------------- */

/**
 * @param {Array|null} results  null = box closed entirely; [] = closed query,
 *   no matches (shows an explicit empty state); non-empty = option list.
 * @param {object} opts
 * @param {(result:object)=>void} opts.onPick
 * @param {string} [opts.query]  original query, used for the empty-state copy
 * @param {number} [opts.activeIndex]  keyboard-highlighted row, -1/undefined = none
 */
export function renderSearchResults(results, { onPick, query = "", activeIndex = -1 } = {}) {
  const box = $("searchResults");
  const input = $("searchInput");

  if (!results) {
    box.hidden = true;
    box.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    setScrimVisible(false);
    return;
  }

  input.setAttribute("aria-expanded", "true");
  setScrimVisible(true);

  if (results.length === 0) {
    box.hidden = false;
    box.innerHTML = `<div class="result-empty">No station found for <strong>“${escapeHtml(query)}”</strong>. Check the spelling, or try a nearby larger city.</div>`;
    input.removeAttribute("aria-activedescendant");
    return;
  }

  box.hidden = false;
  box.innerHTML = results
    .map(
      (r, i) => `
      <button type="button" id="result-${i}" class="result-item${i === activeIndex ? " is-active" : ""}" data-idx="${i}" role="option" aria-selected="${i === activeIndex}">
        <span class="result-name">${escapeHtml(r.name)}${r.admin1 ? `, ${escapeHtml(r.admin1)}` : ""}</span>
        <span class="result-country">${escapeHtml(r.country || "")}</span>
      </button>`
    )
    .join("");
  box.querySelectorAll(".result-item").forEach((btn) => {
    btn.addEventListener("click", () => onPick(results[Number(btn.dataset.idx)]));
  });
  if (activeIndex >= 0) {
    input.setAttribute("aria-activedescendant", `result-${activeIndex}`);
    box.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

export function clearSearchResults() {
  renderSearchResults(null);
}

export function setScrimVisible(visible) {
  const scrim = $("searchScrim");
  scrim.hidden = false;
  scrim.classList.toggle("is-visible", visible);
  if (!visible) setTimeout(() => { if (!scrim.classList.contains("is-visible")) scrim.hidden = true; }, 200);
}

export function setSearchLoading(loading) {
  const wrap = $("searchInputWrap");
  let spinner = document.getElementById("searchSpinner");
  if (loading) {
    if (!spinner) {
      spinner = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      spinner.setAttribute("id", "searchSpinner");
      spinner.setAttribute("class", "search-spinner");
      spinner.setAttribute("width", "16");
      spinner.setAttribute("height", "16");
      spinner.setAttribute("viewBox", "0 0 24 24");
      spinner.setAttribute("fill", "none");
      spinner.setAttribute("stroke", "currentColor");
      spinner.setAttribute("stroke-width", "2.4");
      spinner.setAttribute("aria-hidden", "true");
      spinner.innerHTML = `<circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/>`;
      wrap.appendChild(spinner);
    }
  } else if (spinner) {
    spinner.remove();
  }
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
