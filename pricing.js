/**
 * DeepSeek Price Clock - Shared Pricing Logic
 *
 * Defines the pricing schedule and helper functions for determining
 * pricing status based on configured timezone.
 *
 * Pricing Schedule (Timezone: Asia/Manila UTC+8):
 *   Normal:  00:00–09:00, 12:00–14:00, 18:00–00:00
 *   2× Peak: 09:00–12:00, 14:00–18:00
 */

const STATUS = {
  NORMAL: "normal",
  PEAK: "peak",
  SOON: "soon",
};

const STATUS_LABEL = {
  [STATUS.NORMAL]: "Normal price",
  [STATUS.PEAK]: "2× peak price",
  [STATUS.SOON]: "Peak starts soon",
};

const BADGE_TEXT = {
  [STATUS.NORMAL]: "",
  [STATUS.PEAK]: "2×",
  [STATUS.SOON]: "Soon",
};

/**
 * Time segments in minutes from midnight.
 * Each segment: [startHour, startMinute, endHour, endMinute]
 * Normal segments: { type: 'normal', start, end }
 * Peak segments:   { type: 'peak', start, end }
 */
const SEGMENTS = [
  { type: STATUS.NORMAL, start: 0, end: 9 * 60 }, // 00:00 – 09:00
  { type: STATUS.PEAK, start: 9 * 60, end: 12 * 60 }, // 09:00 – 12:00
  { type: STATUS.NORMAL, start: 12 * 60, end: 14 * 60 }, // 12:00 – 14:00
  { type: STATUS.PEAK, start: 14 * 60, end: 18 * 60 }, // 14:00 – 18:00
  { type: STATUS.NORMAL, start: 18 * 60, end: 24 * 60 }, // 18:00 – 24:00
];

/**
 * Get current time in the given timezone.
 * Returns { hours, minutes, totalMinutes }.
 */
function getTimeInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
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
 * Find the current segment based on total minutes.
 */
function findCurrentSegment(totalMinutes) {
  for (const seg of SEGMENTS) {
    if (totalMinutes >= seg.start && totalMinutes < seg.end) {
      return seg;
    }
  }
  // Fallback (shouldn't happen): treat as normal, midnight wrap
  return SEGMENTS[0];
}

/**
 * Get the next segment after the current one.
 */
function getNextSegment(totalMinutes) {
  const current = findCurrentSegment(totalMinutes);
  const currentIndex = SEGMENTS.indexOf(current);
  for (let i = 1; i <= SEGMENTS.length; i++) {
    const candidate = SEGMENTS[(currentIndex + i) % SEGMENTS.length];
    if (candidate.type !== current.type) {
      return candidate;
    }
  }
  return SEGMENTS[(currentIndex + 1) % SEGMENTS.length];
}

/**
 * Calculate minutes remaining until a given segment's end.
 */
function minutesUntilEnd(totalMinutes, segment) {
  return segment.end - totalMinutes;
}

/**
 * Calculate minutes until the start of the next segment.
 * Handles end-of-day wrap (next day).
 */
function minutesUntilNext(totalMinutes) {
  const next = getNextSegment(totalMinutes);
  if (next.start > totalMinutes) {
    return next.start - totalMinutes;
  }
  // Wrap to next day
  return 24 * 60 - totalMinutes + next.start;
}

/**
 * Determine the current status, considering the warning window.
 * @param {number} totalMinutes - Current time in minutes since midnight (timezone local)
 * @param {number} warningMinutes - Minutes before peak to show warning (default 15)
 * @returns {{ status: string, segment: object, nextSegment: object,
 *            minutesUntilChange: number, minutesUntilEnd: number }}
 */
function getPricingStatus(totalMinutes, warningMinutes = 15) {
  const currentSegment = findCurrentSegment(totalMinutes);
  const nextSegment = getNextSegment(totalMinutes);

  // If currently in peak, status is peak
  if (currentSegment.type === STATUS.PEAK) {
    return {
      status: STATUS.PEAK,
      segment: currentSegment,
      nextSegment,
      minutesUntilChange: minutesUntilEnd(totalMinutes, currentSegment),
      minutesUntilEnd: minutesUntilEnd(totalMinutes, currentSegment),
    };
  }

  // If currently in normal, check if we're within warning window before peak
  if (currentSegment.type === STATUS.NORMAL) {
    const minutesToNext = minutesUntilNext(totalMinutes);

    // Check if next segment is peak and we're within warning window
    if (nextSegment.type === STATUS.PEAK && minutesToNext <= warningMinutes) {
      return {
        status: STATUS.SOON,
        segment: currentSegment,
        nextSegment,
        minutesUntilChange: minutesToNext,
        minutesUntilEnd: minutesUntilEnd(totalMinutes, currentSegment),
      };
    }

    return {
      status: STATUS.NORMAL,
      segment: currentSegment,
      nextSegment,
      minutesUntilChange: minutesToNext,
      minutesUntilEnd: minutesUntilEnd(totalMinutes, currentSegment),
    };
  }

  return {
    status: STATUS.NORMAL,
    segment: currentSegment,
    nextSegment,
    minutesUntilChange: minutesUntilNext(totalMinutes),
    minutesUntilEnd: minutesUntilEnd(totalMinutes, currentSegment),
  };
}

/**
 * Format minutes as a human-readable countdown string.
 */
function formatCountdown(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

/**
 * Format a segment start time as HH:MM string.
 */
function formatTimeFromMinutes(totalMinutes, use24h = true) {
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
 * Format current time with seconds (for popup display).
 */
function formatCurrentTime(timezone, use24h = true) {
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
 * Get the next peak start time in minutes from midnight (timezone-local).
 * Returns null if already in peak.
 */
function getNextPeakStart(totalMinutes) {
  for (const seg of SEGMENTS) {
    if (seg.type === STATUS.PEAK && seg.start > totalMinutes) {
      return seg.start;
    }
  }
  // Next peak is tomorrow
  for (const seg of SEGMENTS) {
    if (seg.type === STATUS.PEAK) {
      return seg.start;
    }
  }
  return null;
}

/**
 * Get the next time the price returns to normal (minutes from midnight).
 */
function getNextNormalStart(totalMinutes) {
  const current = findCurrentSegment(totalMinutes);
  if (current.type === STATUS.PEAK) {
    return current.end;
  }
  const next = getNextSegment(totalMinutes);
  if (next && next.type === STATUS.NORMAL) {
    return next.start;
  }
  // Tomorrow
  for (const seg of SEGMENTS) {
    if (seg.type === STATUS.NORMAL && seg.start > 0) {
      return seg.start;
    }
  }
  return 0;
}

export {
  STATUS,
  STATUS_LABEL,
  BADGE_TEXT,
  SEGMENTS,
  getTimeInTimezone,
  findCurrentSegment,
  getNextSegment,
  minutesUntilEnd,
  minutesUntilNext,
  getPricingStatus,
  formatCountdown,
  formatTimeFromMinutes,
  formatCurrentTime,
  getNextPeakStart,
  getNextNormalStart,
};
