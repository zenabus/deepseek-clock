/**
 * DeepSeek Price Clock - Background Service Worker
 *
 * Runs continuously, updating the toolbar icon and managing
 * browser notifications when pricing status changes.
 */

import {
  getTimeInTimezone,
  getPricingStatus,
  formatCountdown,
  formatTimeFromMinutes,
  getNextPeakStart,
} from "./pricing.js";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  warningMinutes: 15,
  timezone: "Asia/Manila",
  use24h: true,
};

let currentStatus = null;
let notifiedPeak = false;
let notifiedNormal = false;

/**
 * Load settings from storage, applying defaults for missing keys.
 */
async function loadSettings() {
  const result = await browser.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result };
}

async function updateIcon(status) {
  const badgeTextMap = {
    normal: "✅",
    peak: "🚨",
    soon: "⏳",
  };
  await browser.action.setBadgeText({ text: badgeTextMap[status] || "" });

  const badgeColors = {
    normal: [0x10, 0xb9, 0x81, 255],
    peak: [0xef, 0x44, 0x44, 255],
    soon: [0xf5, 0x9e, 0x0b, 255],
  };
  await browser.action.setBadgeBackgroundColor({ color: badgeColors[status] || badgeColors.normal });

  // Update actual icon color
  const suffix = status === "peak" ? "-peak" : (status === "soon" ? "-soon" : "-normal");
  await browser.action.setIcon({
    path: {
      "16": `icons/icon16${suffix}.svg`,
      "32": `icons/icon32${suffix}.svg`,
      "48": `icons/icon48${suffix}.svg`,
      "128": `icons/icon128${suffix}.svg`
    }
  });
}

/**
 * Send a browser notification.
 */
async function sendNotification(title, message) {
  try {
    await browser.notifications.create({
      type: "basic",
      iconUrl: "deepseek-logo.svg",
      title,
      message,
    });
  } catch (err) {
    console.warn("Notification failed:", err);
  }
}

/**
 * Main tick function: evaluate current pricing status, update icon,
 * and trigger notifications if needed.
 */
async function tick() {
  const settings = await loadSettings();

  const { totalMinutes } = getTimeInTimezone(settings.timezone);
  const { status, minutesUntilChange } = getPricingStatus(totalMinutes, settings.warningMinutes);

  // Track previous status before updating
  const prevStatus = currentStatus;
  const statusChanged = status !== prevStatus;

  // Update icon if status changed
  if (statusChanged) {
    currentStatus = status;
    await updateIcon(status);
  }

  // Notifications
  if (settings.notificationsEnabled) {
    // Peak warning: status changed to 'soon'
    if (status === "soon" && !notifiedPeak) {
      notifiedPeak = true;
      const peakTime = formatTimeFromMinutes_nextSegment(totalMinutes);
      await sendNotification(
        "DeepSeek 2× Peak Starting Soon",
        `Peak pricing starts in ${formatCountdown(minutesUntilChange)} at ${peakTime}.`,
      );
    }

    // Normal return: just transitioned from peak/soon to normal
    if (status === "normal" && (prevStatus === "peak" || prevStatus === "soon") && !notifiedNormal) {
      notifiedNormal = true;
      await sendNotification("DeepSeek Price Back to Normal", "DeepSeek API pricing has returned to normal rates.");
    }
  }

  // No need to schedule next tick; the periodic alarm handles it.
  // Firefox minimum alarm period is 1 minute.
}

/**
 * Format the next segment start time (helper for notification messages).
 */
function formatTimeFromMinutes_nextSegment(totalMinutes) {
  const nextStart = getNextPeakStart(totalMinutes);
  if (nextStart !== null) {
    return formatTimeFromMinutes(nextStart, true);
  }
  return "N/A";
}

/**
 * Initialize alarms and listeners.
 */
async function init() {
  // Load initial settings and run first tick
  const settings = await loadSettings();
  const { totalMinutes } = getTimeInTimezone(settings.timezone);
  const { status } = getPricingStatus(totalMinutes, settings.warningMinutes);
  currentStatus = status;
  await updateIcon(status);

  // Set up periodic alarm (every 1 minute — Firefox minimum)
  browser.alarms.create("tick", { periodInMinutes: 1 });

  // Listen for storage changes
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local") {
      // Re-evaluate on settings change
      await tick();
    }
  });
}

// Alarm listener
browser.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === "tick") {
    await tick();
  }
});

// Run on install/update
browser.runtime.onInstalled.addListener(() => {
  init();
});

// Also run when browser starts
init();
