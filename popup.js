/**
 * DeepSeek Price Clock - Popup Script
 *
 * Displays current time, pricing status, and countdown in the popup.
 * Refreshes every second while open.
 */

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  warningMinutes: 15,
  timezone: "Asia/Manila",
  use24h: true,
  apiKey: "",
};

let updateInterval = null;

/**
 * Load settings from storage.
 */
async function loadSettings() {
  const result = await browser.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result };
}

/**
 * Get time in a specific timezone.
 */
function getTimeInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  let hours = 0,
    minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") hours = parseInt(part.value, 10);
    if (part.type === "minute") minutes = parseInt(part.value, 10);
  }
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

/**
 * Pricing schedule segments (in minutes from midnight).
 */
const SEGMENTS = [
  { type: "normal", start: 0, end: 9 * 60 },
  { type: "peak", start: 9 * 60, end: 12 * 60 },
  { type: "normal", start: 12 * 60, end: 14 * 60 },
  { type: "peak", start: 14 * 60, end: 18 * 60 },
  { type: "normal", start: 18 * 60, end: 24 * 60 },
];

/**
 * Determine pricing status.
 */
function getPricingStatus(totalMinutes, warningMinutes) {
  let currentSegment = null;
  for (const seg of SEGMENTS) {
    if (totalMinutes >= seg.start && totalMinutes < seg.end) {
      currentSegment = seg;
      break;
    }
  }
  if (!currentSegment) currentSegment = SEGMENTS[0];

  // Find next segment (skipping consecutive segments of the same type)
  const currentIndex = SEGMENTS.indexOf(currentSegment);
  let nextSegment = null;
  for (let i = 1; i <= SEGMENTS.length; i++) {
    const candidate = SEGMENTS[(currentIndex + i) % SEGMENTS.length];
    if (candidate.type !== currentSegment.type) {
      nextSegment = candidate;
      break;
    }
  }
  if (!nextSegment) nextSegment = SEGMENTS[(currentIndex + 1) % SEGMENTS.length];

  const minutesUntilEnd = currentSegment.end - totalMinutes;
  let minutesUntilNext;
  if (nextSegment.start > totalMinutes) {
    minutesUntilNext = nextSegment.start - totalMinutes;
  } else {
    minutesUntilNext = 24 * 60 - totalMinutes + nextSegment.start;
  }

  if (currentSegment.type === "peak") {
    return {
      status: "peak",
      segment: currentSegment,
      nextSegment,
      minutesUntilChange: minutesUntilEnd,
      minutesUntilEnd,
    };
  }

  if (currentSegment.type === "normal" && nextSegment.type === "peak" && minutesUntilNext <= warningMinutes) {
    return {
      status: "soon",
      segment: currentSegment,
      nextSegment,
      minutesUntilChange: minutesUntilNext,
      minutesUntilEnd,
    };
  }

  return {
    status: currentSegment.type,
    segment: currentSegment,
    nextSegment,
    minutesUntilChange: minutesUntilNext,
    minutesUntilEnd,
  };
}

/**
 * Format minutes as countdown string.
 */
function formatCountdown(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Format minutes to time string.
 */
function formatTimeFromMinutes(totalMinutes, use24h) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  if (use24h) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Format current time with seconds.
 */
function formatCurrentTime(timezone, use24h) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: !use24h,
  });
  return formatter.format(now);
}

/**
 * Get timezone abbreviation.
 */
function getTimezoneAbbr(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
    hour: "numeric",
  });
  const parts = formatter.formatToParts(now);
  for (const part of parts) {
    if (part.type === "timeZoneName") return part.value;
  }
  return timezone.split("/").pop();
}

/**
 * Calculate actual seconds remaining until the target change.
 */
function getSecondsRemaining(settings, pricing) {
  const now = new Date();
  
  // Convert current time in target timezone to a Date object representing today
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  let y, mo, d, h, m, s;
  for (const part of parts) {
    if (part.type === "year") y = parseInt(part.value, 10);
    if (part.type === "month") mo = parseInt(part.value, 10) - 1;
    if (part.type === "day") d = parseInt(part.value, 10);
    if (part.type === "hour") h = parseInt(part.value, 10);
    if (part.type === "minute") m = parseInt(part.value, 10);
    if (part.type === "second") s = parseInt(part.value, 10);
  }
  
  // Date object representing current time in the target timezone
  const tzNow = new Date(y, mo, d, h, m, s);
  
  // Date object representing target change time in the target timezone
  const nextSegment = pricing.nextSegment;
  const targetHour = Math.floor(nextSegment.start / 60);
  const targetMinute = nextSegment.start % 60;
  
  let targetDate = new Date(y, mo, d, targetHour, targetMinute, 0);
  
  // If target time is earlier than current time, it wraps to tomorrow
  if (targetDate <= tzNow) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  const diffMs = targetDate - tzNow;
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Format total seconds as countdown string with seconds.
 */
function formatCountdownSeconds(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  const hStr = h > 0 ? `${h}h ` : "";
  const mStr = `${String(m).padStart(2, "0")}m `;
  const sStr = `${String(s).padStart(2, "0")}s`;
  return `${hStr}${mStr}${sStr}`;
}

let lastBalanceFetchTime = 0;
let cachedBalanceStr = "";

/**
 * Fetch DeepSeek API balance.
 */
async function fetchDeepSeekBalance(apiKey) {
  const now = Date.now();
  // Throttle fetches to once every 10 seconds to avoid spamming the API
  if (cachedBalanceStr && now - lastBalanceFetchTime < 10000) {
    return cachedBalanceStr;
  }

  try {
    const response = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.is_available && data.balance_infos) {
      // Find the main currency balance info
      const info = data.balance_infos[0];
      if (info) {
        const currencySymbol = info.currency === "CNY" ? "¥" : "$";
        const total = parseFloat(info.total_balance);
        cachedBalanceStr = `${currencySymbol}${total.toFixed(2)}`;
        lastBalanceFetchTime = now;
        return cachedBalanceStr;
      }
    }
    return "Unavailable";
  } catch (err) {
    console.error("Failed to fetch balance:", err);
    return cachedBalanceStr || "Error loading";
  }
}

/**
 * Log daily spending based on balance changes.
 */
async function trackUsage(balanceStr) {
  if (!balanceStr || balanceStr.startsWith("Error") || balanceStr === "Loading...") return;
  const numVal = parseFloat(balanceStr.replace(/[^0-9.]/g, ""));
  if (isNaN(numVal)) return;

  const storageKey = "pricing_clock_usage";
  const state = await browser.storage.local.get({
    lastBalance: null,
    dailyUsage: {} // dateKey: totalSpent
  });

  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (state.lastBalance !== null && numVal < state.lastBalance) {
    const spent = state.lastBalance - numVal;
    // Cap spent to filter out potential top-ups or weird negative state values
    if (spent > 0 && spent < 50) { 
      const currentSpent = state.dailyUsage[dateKey] || 0;
      state.dailyUsage[dateKey] = currentSpent + spent;
    }
  }

  state.lastBalance = numVal;
  await browser.storage.local.set(state);
}

/**
 * Draw a clean SVG bar chart representing the last 7 days of spending.
 */
async function renderUsageChart() {
  const state = await browser.storage.local.get({ dailyUsage: {} });
  const dailyUsage = state.dailyUsage;

  const container = document.getElementById("usageChart");
  const chartSection = document.getElementById("chartSection");
  chartSection.style.display = "block";

  // Get last 7 days keys and values
  const dataset = [];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const value = dailyUsage[key] || 0;
    dataset.push({
      label: daysOfWeek[d.getDay()],
      value: value
    });
  }

  const maxValue = Math.max(...dataset.map(d => d.value), 0.1); // Avoid division by zero

  // Generate SVG elements
  const width = 260;
  const height = 70;
  const padding = 15;
  const chartHeight = height - padding;
  const barWidth = 22;
  const spacing = 12;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  dataset.forEach((data, index) => {
    const x = padding + index * (barWidth + spacing);
    const barHeight = (data.value / maxValue) * (chartHeight - 15);
    const y = chartHeight - barHeight;
    const isToday = index === 6;
    const color = isToday ? "#89b4fa" : "#45475a";
    const textColor = isToday ? "#cdd6f4" : "#6c7086";

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", barWidth);
    rect.setAttribute("height", barHeight);
    rect.setAttribute("rx", "3");
    rect.setAttribute("fill", color);

    const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textLabel.setAttribute("x", x + barWidth / 2);
    textLabel.setAttribute("y", height - 2);
    textLabel.setAttribute("font-size", "9");
    textLabel.setAttribute("fill", textColor);
    textLabel.setAttribute("text-anchor", "middle");
    textLabel.setAttribute("font-family", "sans-serif");
    textLabel.textContent = data.label;

    group.appendChild(rect);
    group.appendChild(textLabel);

    if (data.value > 0) {
      const textVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textVal.setAttribute("x", x + barWidth / 2);
      textVal.setAttribute("y", y - 4);
      textVal.setAttribute("font-size", "8");
      textVal.setAttribute("fill", "#a6adc8");
      textVal.setAttribute("text-anchor", "middle");
      textVal.setAttribute("font-family", "sans-serif");
      textVal.textContent = `$${data.value.toFixed(2)}`;
      group.appendChild(textVal);
    }

    svg.appendChild(group);
  });

  container.replaceChildren(svg);
}

/**
 * Update the popup UI with latest status.
 */
async function updatePopup() {
  const settings = await loadSettings();
  const { hours, minutes, totalMinutes } = getTimeInTimezone(settings.timezone);
  const tzAbbr = getTimezoneAbbr(settings.timezone);

  document.getElementById("currentTimezone").textContent = tzAbbr;

  const pricing = getPricingStatus(totalMinutes, settings.warningMinutes);
  const status = pricing.status;

  // Countdown at the top with seconds
  const totalSeconds = getSecondsRemaining(settings, pricing);
  const countdownVal = formatCountdownSeconds(totalSeconds);
  const countdownEl = document.getElementById("countdown");
  countdownEl.textContent = countdownVal;

  // Color the countdown based on pricing
  countdownEl.classList.toggle("peak", status === "peak" || status === "soon");

  // Status badge
  const badge = document.getElementById("statusBadge");
  const statusLabels = {
    normal: "Normal price",
    peak: "2× peak price",
    soon: "Peak starts soon",
  };
  badge.textContent = statusLabels[status] || status;
  badge.className = `status-badge ${status}`;

  // Balance row
  const balanceRow = document.getElementById("balanceRow");
  const apiBalanceEl = document.getElementById("apiBalance");
  if (settings.apiKey) {
    balanceRow.style.display = "flex";
    apiBalanceEl.textContent = "Loading...";
    const balanceStr = await fetchDeepSeekBalance(settings.apiKey);
    apiBalanceEl.textContent = balanceStr;
    
    // Log balance check spending event
    await trackUsage(balanceStr);
    await renderUsageChart();
  } else {
    balanceRow.style.display = "none";
    document.getElementById("chartSection").style.display = "none";
  }

  // Status label
  document.getElementById("statusLabel").textContent = statusLabels[status] || status;

  // Next change time
  const nextSegment = pricing.nextSegment;
  const nextStart = nextSegment.start;
  const nextTime = formatTimeFromMinutes(nextStart, settings.use24h);
  
  const nextLabels = {
    normal: "Normal price at",
    peak: "2× peak at",
    soon: "2× peak at",
  };
  const nextLabel = nextLabels[nextSegment.type] || "Change at";
  document.getElementById("nextChangeTime").textContent = `${nextLabel} ${nextTime}`;
}

/**
 * Open the options/settings page.
 */
function openSettings(e) {
  e.preventDefault();
  browser.runtime.openOptionsPage();
}

/**
 * Initialize popup.
 */
document.addEventListener("DOMContentLoaded", async () => {
  await updatePopup();
  // Update every second
  updateInterval = setInterval(updatePopup, 1000);

  document.getElementById("openSettings").addEventListener("click", openSettings);
});

// Clean up interval when popup closes
window.addEventListener("unload", () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
});
