/**
 * DeepSeek Price Clock - Options/Settings Script
 *
 * Manages the settings page: load, save, and reset settings.
 */

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  warningMinutes: 15,
  timezone: "Asia/Manila",
  use24h: true,
  apiKey: "",
};

/**
 * Load settings from storage and populate the form.
 */
async function loadSettings() {
  const result = await browser.storage.local.get(DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...result };

  document.getElementById("notificationsEnabled").checked = settings.notificationsEnabled;
  document.getElementById("warningMinutes").value = settings.warningMinutes;
  document.getElementById("timezone").value = settings.timezone;
  document.getElementById("apiKey").value = settings.apiKey;

  const radio = document.querySelector(`input[name="use24h"][value="${settings.use24h}"]`);
  if (radio) radio.checked = true;
}

/**
 * Save settings from the form to storage.
 */
async function saveSettings(e) {
  e.preventDefault();

  const settings = {
    notificationsEnabled: document.getElementById("notificationsEnabled").checked,
    warningMinutes: parseInt(document.getElementById("warningMinutes").value, 10) || 15,
    timezone: document.getElementById("timezone").value,
    use24h: document.querySelector('input[name="use24h"]:checked')?.value === "true",
    apiKey: document.getElementById("apiKey").value.trim(),
  };

  // Validate warning minutes
  if (settings.warningMinutes < 1) settings.warningMinutes = 1;
  if (settings.warningMinutes > 60) settings.warningMinutes = 60;

  try {
    await browser.storage.local.set(settings);
    showSaveStatus("Settings saved successfully!", "success");
  } catch (err) {
    showSaveStatus("Failed to save settings: " + err.message, "error");
  }
}

/**
 * Reset settings to defaults.
 */
async function resetDefaults() {
  try {
    await browser.storage.local.set(DEFAULT_SETTINGS);
    await loadSettings();
    showSaveStatus("Settings reset to defaults.", "success");
  } catch (err) {
    showSaveStatus("Failed to reset settings: " + err.message, "error");
  }
}

/**
 * Show a status message after save/reset.
 */
function showSaveStatus(message, type) {
  const el = document.getElementById("saveStatus");
  el.textContent = message;
  el.className = "save-status " + type;
  setTimeout(() => {
    el.textContent = "";
    el.className = "save-status";
  }, 3000);
}

/**
 * Initialize the options page.
 */
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("resetDefaults").addEventListener("click", resetDefaults);
});
