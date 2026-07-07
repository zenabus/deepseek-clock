# DeepSeek Price Clock

A Firefox browser extension that shows whether DeepSeek API pricing is at normal price or 2× peak price, based on Philippines time (UTC+8 / Asia/Manila).

## Pricing Schedule

| Time (24-hour) | Time (12-hour AM/PM) | Price       | Duration |
| -------------- | -------------------- | ----------- | -------- |
| 18:00 – 09:00  | 06:00 PM – 09:00 AM  | Normal      | 15 hours |
| 09:00 – 12:00  | 09:00 AM – 12:00 PM  | **2× Peak** | 3 hours  |
| 12:00 – 14:00  | 12:00 PM – 02:00 PM  | Normal      | 2 hours  |
| 14:00 – 18:00  | 02:00 PM – 06:00 PM  | **2× Peak** | 4 hours  |

## Features

- **Toolbar icon** changes color based on active pricing status (Blue for normal, Red for peak, Yellow for warning window)
- **Badge text**: None (normal), "2×" (peak), "Soon" (warning)
- **Popup** shows live time-to-change countdown with seconds, next change time, and timezone
- **API Balance Checker**: Display your DeepSeek account balance (granted/topped-up credits) by adding your API key securely
- **7-Day Spending Chart**: Built-in privacy-first expense logger showing daily consumption changes in an SVG bar chart
- **Browser notifications** before peak pricing starts and when pricing returns to normal
- **Settings page** to customize notifications, warning time, timezone, time format, and your API Key

## Project Structure

```
deepseek-clock/
├── manifest.json        # Extension manifest (MV3)
├── background.js        # Background service worker
├── pricing.js           # Shared pricing logic module
├── popup.html           # Popup interface
├── popup.js             # Popup logic
├── popup.css            # Popup styles
├── options.html         # Settings page
├── options.js           # Settings logic
├── options.css          # Settings styles
├── icons/               # Extension icons
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md            # This file
```

---

## 1. Loading the Extension Temporarily in Firefox

1. Open Firefox and type `about:debugging` in the address bar.
2. Click **"This Firefox"** in the left sidebar.
3. Click **"Load Temporary Add-on…"**.
4. Navigate to the `deepseek-clock` folder and select **`manifest.json`**.
5. The extension is now loaded. You'll see the DeepSeek icon in the toolbar.

The extension will remain loaded until you restart Firefox. To reload after making code changes, click the **"Reload"** button next to the extension in `about:debugging`.

## 2. Testing the Schedule Logic

### Quick test — Change your computer's timezone

1. Go to **Settings > Time & Language > Date & time** on Windows (or equivalent on other OS).
2. Temporarily change your timezone to a zone that matches a different part of the schedule.
3. Or, go to the extension's **Settings** page and change the timezone to observe different pricing periods.

### Test by checking the schedule

The schedule runs daily on a fixed cycle:

- **Normal**: 00:00–09:00, 12:00–14:00, 18:00–00:00
- **Peak**: 09:00–12:00, 14:00–18:00

To verify the extension is working correctly:

1. Click the toolbar icon to open the popup.
2. The popup shows current time, status, next change time, and countdown.
3. The countdown should update every second while the popup is open.
4. The toolbar icon badge shows "OK", "2×", or "Soon".

### Test notifications

1. Open the extension's **Settings** page.
2. Ensure **Notifications** is enabled.
3. Set **Warning time** to a low value (e.g., 5 minutes).
4. Adjust your timezone to one near a peak transition (e.g., 08:55 if you're patient).

## 3. Packaging as a `.zip` for Distribution

When you're ready to distribute the extension:

### Option A: Using Firefox's built-in packaging

1. Open Firefox and go to `about:addons`.
2. Find the DeepSeek Price Clock extension.
3. Click the gear icon ⚙ and select **"Debug Add-ons"**.
4. Click **"Load Temporary Add-on…"** if not already loaded.
5. Click **"Package Extension"** — this creates a `.xpi` file.

### Option B: Manual `.zip` packaging

1. Open a terminal in the `deepseek-clock` folder.
2. Run:

```bash
# On Windows (PowerShell)
Compress-Archive -Path * -DestinationPath ../deepseek-price-clock.zip

# On macOS / Linux
zip -r ../deepseek-price-clock.zip . -x "*.git*"
```

3. The resulting `.zip` can be submitted to **Firefox Add-ons (AMO)** at [addons.mozilla.org](https://addons.mozilla.org).

> **Note**: For AMO submission, you'll need to create a signed version. The temporary loading method is sufficient for personal use.

## Settings

| Setting       | Default     | Description                                                 |
| ------------- | ----------- | ----------------------------------------------------------- |
| Notifications | Enabled     | Alerts before peak pricing and when price returns to normal |
| Warning time  | 15 min      | Minutes before peak pricing to show warning                 |
| Timezone      | Asia/Manila | Timezone for pricing schedule                               |
| Time format   | 24-hour     | Display time in 12h or 24h format                           |
| API Key       | (Empty)     | Securely stores your key to enable balance & spending tracking|

## Extending for Other AI API Providers

The extension is designed to be modular. To add support for another provider:

1. Add a new pricing schedule in `pricing.js`.
2. Extend the status detection logic.
3. Update the popup UI to show provider-specific information.
