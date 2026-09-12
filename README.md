# Isobar — a weather dashboard built like a physical instrument

**Stack:** Vanilla JS (ES modules), CSS, SVG. No framework, no build step, no API key.

Isobar is a weather dashboard that rejects the "card full of icons" template.
It's styled as a real instrument panel — barometer brass on deep atmospheric
navy, an analog pressure gauge with a needle that physically sweeps to its
reading, temperature set in monospace like an instrument readout, and a
5-day forecast drawn as a continuous barograph trace instead of a row of
boxes. The page background is a living sky — gradient, stars, clouds, and
precipitation, generated purely from each station's own weather code and
local time of day — so every saved city gets a distinct, ambient portrait
instead of a static icon.

---

## Why this project is on my resume

Most portfolio weather apps prove you can call a fetch and render some JSON.
This one is here to prove three other things:

1. **I make deliberate design decisions, not default ones.** The instrument
   panel concept, the analog gauge, the barograph forecast — none of it is
   the first idea a template would reach for. Every visual choice ties back
   to "this is a physical instrument," including the SVG grain overlay and
   the spring-eased needle sweep.
2. **I handle the failure modes real apps hit in production**, not just the
   happy path — see [Reliability engineering](#reliability-engineering)
   below. These weren't hypothetical; they were bugs I hit and fixed.
3. **I ship depth, not just a demo.** Multi-station tracking with concurrent,
   independently-failing fetches; persisted units; geolocation; an hourly
   strip; full keyboard and screen-reader support. It's a small app that
   behaves like a real one.

---

## Feature tour

| Area | What it does |
|---|---|
| **Live ambient sky** | Gradient, star field, clouds, rain/snow, and lightning flashes generated from the active station's WMO weather code + day/night state (`js/sky.js`) — no image assets. |
| **Analog pressure gauge** | The signature instrument: an SVG barometer dial with a needle that sweeps to the live hPa reading on a spring easing curve, plus a plain-language trend ("Steady" / "High — settled" / "Low — unsettled"). |
| **Barograph forecast** | The 5-day high/low isn't a card grid — it's a continuous SVG trace with a filled high/low band, drawn in with an animated stroke on first paint. |
| **Hourly strip** | Next 24 hours, scrollable, temperature + condition icon per hour. |
| **Multi-station board** | Saved cities persist to `localStorage` and are fetched **concurrently** via `Promise.allSettled` — one slow or dead station never blocks the others. |
| **Unit toggle** | °C/°F and km/h/mph, persisted, applied consistently across the hero, readouts, station chips, hourly strip, and forecast chart from one conversion function. |
| **Geolocation** | "Use my location" reverse-geocodes browser coordinates to a city name (BigDataCloud's free keyless endpoint) and adds it as a station. |
| **Debounced search** | Live search-as-you-type with a results dropdown, arrow-key navigation, submit-to-search fallback, and an explicit empty state. |
| **Accessible by default** | `role="combobox"`/`listbox`, `aria-live` regions, visible focus rings, full keyboard support, and `prefers-reduced-motion` respected everywhere animation appears. |

---

## Reliability engineering

These weren't designed in from the start — they're fixes for real bugs the
app hit during development, which is exactly the kind of thing worth
walking through in an interview:

- **The stuck-spinner bug.** A plain `fetch()` on a slow or dropped mobile
  connection can hang with no rejection ever firing. That left search and
  station-chip spinners spinning forever. Fix: every network call in
  `js/api.js` runs through a hard 12-second `AbortController` timeout, so a
  request always either resolves or fails with a clear message.
- **The stale-response race.** Typing quickly into search fires overlapping
  geocode requests. If an old, slow request resolved *after* a newer one,
  it could re-open the dropdown with stale results or re-trigger the
  spinner after the real answer had already landed. Fix: each keystroke
  gets a request ID (`js/app.js` → `wireSearch`), and only the
  most recent one is allowed to touch the UI.
- **One bad station shouldn't break the board.** Fetching weather for five
  saved cities with `Promise.all` means one failed request kills the whole
  batch. Switched to `Promise.allSettled` so failures are isolated per
  station — a dead API response shows a retry button on *that* station
  only, everything else loads normally.
- **No API key in frontend JS.** This is a pure static site with nowhere to
  hide a secret — anyone can read a bundled key out of the network tab.
  Open-Meteo is free, keyless, and CORS-enabled for direct browser calls,
  which is the actual reason it was chosen over OpenWeatherMap, not just a
  convenience.

## Design decisions worth defending in a review

- **The needle physically sweeps, not fades in.** `#gaugeNeedleGroup`
  transitions `transform: rotate()` on a spring easing curve
  (`--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`), so pressure changes
  read as a real mechanical reading, not a data update.
- **The load sequence is one orchestrated moment, not scattered effects.**
  Each deck section (stations → hero → readouts/gauge → hourly → forecast)
  rises in on a staggered delay off a single `deck-in` keyframe, so first
  paint reads as one composed entrance rather than a dump of content.
- **Numbers count up, they don't pop.** The hero temperature animates
  digit-by-digit from its previous value using `requestAnimationFrame`
  with a cubic ease-out — a small, deliberate signal that this is a live
  instrument, not a static label. Skipped entirely under
  `prefers-reduced-motion`.
- **One module, one job.** `api.js` doesn't know about the DOM. `ui.js`
  doesn't know about `fetch`. `sky.js` doesn't know either exists — it
  just takes a weather code and time of day. Swapping the API provider,
  the storage strategy, or the entire visual theme is a change to exactly
  one file.

---

## Project structure

```
weather/
├── index.html        Page shell, semantic regions, inline critical SVG icon
├── styles.css          Design tokens, sky animation, all component styles
├── js/
│   ├── config.js         WMO weather-code → condition/theme/icon mapping
│   ├── api.js              Open-Meteo + reverse-geocode fetch, error types
│   ├── storage.js           localStorage for saved stations + units
│   ├── sky.js                 Paints the ambient sky canvas from live data
│   ├── ui.js                   All DOM rendering (gauge, hero, hourly, chart)
│   └── app.js                   Controller: state, wiring, orchestration
```

## Run locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

ES modules must be served over `http://`, not opened as a `file://` URL.

## Deploy

Drag-and-drop the folder onto **Netlify** (no build command, publish
directory is the project root), or serve it as a **Render** static site
with build command `none` / publish path `.`.

A `_headers` file tells Netlify never to serve `index.html` stale from a
mobile browser cache after a redeploy. When you make a change, bump the
`?v=` query string on `styles.css` and `js/app.js` in `index.html`.

## Ideas for extending

- Hourly precipitation-probability shading under the barograph trace.
- A second signature instrument: a wind compass rose next to the gauge.
- Offline support via a service worker, caching the last successful read
  per station so the board still shows *something* with no connection.
