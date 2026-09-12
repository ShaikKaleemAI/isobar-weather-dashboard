import { describeCode, SKY_THEME, PRECIP_BY_FAMILY, CLOUD_DENSITY_BY_FAMILY } from "./config.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const els = {
  gradient: document.getElementById("skyGradient"),
  stars: document.getElementById("skyStars"),
  clouds: document.getElementById("skyClouds"),
  precip: document.getElementById("skyPrecip"),
  flash: document.getElementById("skyFlash"),
};

let starsBuilt = false;
let flashTimer = null;

/**
 * Repaint the ambient sky canvas for the given weather. This is the
 * signature visual element of the dashboard — every station gets a living
 * portrait built purely from its own data (time of day + condition), rather
 * than a static icon.
 */
export function paintSky({ code, isDay }) {
  const { family } = describeCode(code);
  const theme = SKY_THEME[family] ?? SKY_THEME.cloudy;
  const stops = isDay ? theme.day : theme.night;

  els.gradient.style.background = `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;
  document.documentElement.dataset.timeOfDay = isDay ? "day" : "night";
  document.documentElement.dataset.condition = family;

  buildStars(isDay);
  buildClouds(CLOUD_DENSITY_BY_FAMILY[family] ?? 0);
  buildPrecip(PRECIP_BY_FAMILY[family] ?? "none");
  toggleFlash(family === "storm");
}

function buildStars(isDay) {
  if (starsBuilt) return;
  const count = 60;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.className = "star";
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 55}%`;
    s.style.setProperty("--delay", `${(Math.random() * 6).toFixed(2)}s`);
    s.style.setProperty("--size", `${(Math.random() * 1.6 + 0.6).toFixed(2)}px`);
    frag.appendChild(s);
  }
  els.stars.appendChild(frag);
  starsBuilt = true;
  els.stars.style.opacity = isDay ? "0" : "1";
  return void 0;
}

function buildClouds(density) {
  els.clouds.innerHTML = "";
  if (prefersReducedMotion) density = Math.min(density, 1);
  for (let i = 0; i < density; i++) {
    const c = document.createElement("span");
    c.className = "cloud";
    const scale = 0.7 + Math.random() * 0.9;
    c.style.top = `${8 + Math.random() * 38}%`;
    c.style.setProperty("--scale", scale.toFixed(2));
    c.style.setProperty("--duration", `${(38 + Math.random() * 30).toFixed(0)}s`);
    c.style.setProperty("--delay", `${(-Math.random() * 40).toFixed(0)}s`);
    c.style.opacity = (0.35 + Math.random() * 0.35).toFixed(2);
    els.clouds.appendChild(c);
  }
}

function buildPrecip(kind) {
  els.precip.innerHTML = "";
  els.precip.dataset.kind = kind;
  if (kind === "none" || prefersReducedMotion) return;

  const isSnow = kind === "snow";
  const count = isSnow ? 34 : kind === "rain-heavy" ? 60 : kind === "rain" ? 42 : 22;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = isSnow ? "flake" : "drop";
    p.style.left = `${Math.random() * 100}%`;
    p.style.setProperty("--delay", `${(Math.random() * 3).toFixed(2)}s`);
    p.style.setProperty("--duration", `${(isSnow ? 6 + Math.random() * 5 : 0.6 + Math.random() * 0.5).toFixed(2)}s`);
    if (isSnow) p.style.setProperty("--drift", `${(Math.random() * 40 - 20).toFixed(0)}px`);
    frag.appendChild(p);
  }
  els.precip.appendChild(frag);
}

function toggleFlash(active) {
  clearInterval(flashTimer);
  els.flash.classList.remove("flash-once");
  if (!active || prefersReducedMotion) return;
  const strike = () => {
    els.flash.classList.remove("flash-once");
    void els.flash.offsetWidth; // restart animation
    els.flash.classList.add("flash-once");
  };
  flashTimer = setInterval(strike, 4500 + Math.random() * 3500);
}
