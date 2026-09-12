// Maps Open-Meteo's WMO weather codes to a condition family, label, icon and
// theme. Kept separate from rendering logic so new codes/themes can be added
// without touching UI code.

export const CONDITION_BY_CODE = {
  0: { family: "clear", label: "Clear sky" },
  1: { family: "clear", label: "Mainly clear" },
  2: { family: "cloudy", label: "Partly cloudy" },
  3: { family: "cloudy", label: "Overcast" },
  45: { family: "fog", label: "Fog" },
  48: { family: "fog", label: "Depositing rime fog" },
  51: { family: "drizzle", label: "Light drizzle" },
  53: { family: "drizzle", label: "Drizzle" },
  55: { family: "drizzle", label: "Dense drizzle" },
  56: { family: "drizzle", label: "Freezing drizzle" },
  57: { family: "drizzle", label: "Freezing drizzle, dense" },
  61: { family: "rain", label: "Light rain" },
  63: { family: "rain", label: "Rain" },
  65: { family: "rain", label: "Heavy rain" },
  66: { family: "rain", label: "Freezing rain" },
  67: { family: "rain", label: "Freezing rain, heavy" },
  71: { family: "snow", label: "Light snow" },
  73: { family: "snow", label: "Snow" },
  75: { family: "snow", label: "Heavy snow" },
  77: { family: "snow", label: "Snow grains" },
  80: { family: "rain", label: "Rain showers" },
  81: { family: "rain", label: "Rain showers" },
  82: { family: "rain", label: "Violent rain showers" },
  85: { family: "snow", label: "Snow showers" },
  86: { family: "snow", label: "Heavy snow showers" },
  95: { family: "storm", label: "Thunderstorm" },
  96: { family: "storm", label: "Thunderstorm, hail" },
  99: { family: "storm", label: "Thunderstorm, heavy hail" },
};

export function describeCode(code) {
  return CONDITION_BY_CODE[code] ?? { family: "cloudy", label: "Unsettled" };
}

// Sky gradients per condition family, split for day / night. Values are CSS
// gradient stop colors, dark → light, read top to bottom of the canvas.
export const SKY_THEME = {
  clear: {
    day: ["#4FA9E0", "#8FD0EC", "#EDE6D6"],
    night: ["#0B1220", "#101C33", "#1B2A4A"],
  },
  cloudy: {
    day: ["#7C93A8", "#A9BBC7", "#D9D3C4"],
    night: ["#12161F", "#1C2330", "#242C3B"],
  },
  fog: {
    day: ["#9AA5A8", "#C3C9C6", "#DCD9CE"],
    night: ["#171A1E", "#20242A", "#2A2E33"],
  },
  drizzle: {
    day: ["#5E7C8C", "#89A2AC", "#C7CBBE"],
    night: ["#0E1620", "#17222E", "#1E2C39"],
  },
  rain: {
    day: ["#3E5A6E", "#5E7F8F", "#9BAAA0"],
    night: ["#0A121B", "#101A26", "#16212F"],
  },
  snow: {
    day: ["#7C8CA0", "#B9C6D3", "#F1F0EA"],
    night: ["#141A26", "#1E2635", "#2A3346"],
  },
  storm: {
    day: ["#2C3440", "#42505E", "#6B7684"],
    night: ["#080A10", "#0F131C", "#171C26"],
  },
};

// Which ambient particle layer to render for a given family.
export const PRECIP_BY_FAMILY = {
  clear: "none",
  cloudy: "none",
  fog: "none",
  drizzle: "rain-light",
  rain: "rain",
  snow: "snow",
  storm: "rain-heavy",
};

export const CLOUD_DENSITY_BY_FAMILY = {
  clear: 0,
  cloudy: 3,
  fog: 0,
  drizzle: 3,
  rain: 4,
  snow: 3,
  storm: 5,
};

// Simple line-icon glyphs (inline SVG path data) keyed by family, reused for
// station chips, hero and forecast ticks — avoids a heavy icon dependency.
export const ICON_PATHS = {
  clear: `<circle cx="12" cy="12" r="4.5"/><g stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="6.6" y2="6.6"/><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="6.6" y2="17.4"/><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"/></g>`,
  cloudy: `<path d="M6.5 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 15.9 9.1 4.5 4.5 0 0 1 15.5 18h-9Z"/>`,
  fog: `<g stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="13" x2="17" y2="13"/><line x1="6" y1="17" x2="20" y2="17"/></g>`,
  drizzle: `<path d="M6.5 13a4 4 0 0 1-.5-7.97A5 5 0 0 1 15.9 4.1 4.5 4.5 0 0 1 15.5 13h-9Z"/><g stroke-linecap="round"><line x1="8" y1="16" x2="7" y2="19"/><line x1="12" y1="16" x2="11" y2="19"/><line x1="16" y1="16" x2="15" y2="19"/></g>`,
  rain: `<path d="M6.5 12a4 4 0 0 1-.5-7.97A5 5 0 0 1 15.9 3.1 4.5 4.5 0 0 1 15.5 12h-9Z"/><g stroke-linecap="round"><line x1="7" y1="15" x2="5.5" y2="20"/><line x1="12" y1="15" x2="10.5" y2="20"/><line x1="17" y1="15" x2="15.5" y2="20"/></g>`,
  snow: `<path d="M6.5 11a4 4 0 0 1-.5-7.97A5 5 0 0 1 15.9 2.1 4.5 4.5 0 0 1 15.5 11h-9Z"/><g stroke-linecap="round"><line x1="7" y1="16" x2="7" y2="21"/><line x1="4.5" y1="18.5" x2="9.5" y2="18.5"/><line x1="17" y1="16" x2="17" y2="21"/><line x1="14.5" y1="18.5" x2="19.5" y2="18.5"/></g>`,
  storm: `<path d="M6.5 11a4 4 0 0 1-.5-7.97A5 5 0 0 1 15.9 2.1 4.5 4.5 0 0 1 15.5 11h-9Z"/><path d="M13 14.5 9.5 19h3l-1.5 4 5-5.5h-3l1-3Z"/>`,
};
