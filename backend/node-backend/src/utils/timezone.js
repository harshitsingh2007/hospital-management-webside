/**
 * timezone.js
 * -----------
 * Unified Timezone & Queue-Date normalization utilities for Hospital Queue System.
 * Timezone target: Asia/Kolkata (+05:30)
 */

const env = require("../config/env");

const TIMEZONE = env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

/**
 * Returns today's queue date as "YYYY-MM-DD" string in the configured hospital timezone.
 */
function getCurrentQueueDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Normalizes input date/string/null to "YYYY-MM-DD" in hospital timezone.
 */
function parseQueueDate(d) {
  if (!d) {
    return getCurrentQueueDate();
  }
  if (typeof d === "string") {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(parsed);
    }
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d);
  }
  return getCurrentQueueDate();
}

/**
 * Converts "YYYY-MM-DD" string to a Date object at UTC midnight for Prisma Date fields.
 */
function queueDateToPrismaDate(dateStr) {
  const normalized = parseQueueDate(dateStr);
  return new Date(`${normalized}T00:00:00.000Z`);
}

/**
 * Converts Date / timestamp / string to UNIX epoch float in seconds.
 */
function dtToEpoch(val) {
  if (val === null || val === undefined) {
    return Date.now() / 1000.0;
  }
  if (typeof val === "number") {
    return val > 1e11 ? val / 1000.0 : val;
  }
  if (val instanceof Date) {
    return val.getTime() / 1000.0;
  }
  if (typeof val === "string") {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime() / 1000.0;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      return num > 1e11 ? num / 1000.0 : num;
    }
  }
  return Date.now() / 1000.0;
}

/**
 * Parses timeSlot strings (e.g. "03:30 PM", "3:30 PM", "11:15 AM", "14:30") into 24h hour and minute.
 */
function parseTimeSlot(timeSlot) {
  if (!timeSlot || typeof timeSlot !== "string") {
    return { hour: 9, minute: 0, formatted: "09:00 AM" };
  }
  const match = timeSlot.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);
  if (!match) {
    return { hour: 9, minute: 0, formatted: timeSlot.trim() };
  }
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;
  if (meridian === "PM" && hour < 12) hour += 12;
  if (meridian === "AM" && hour === 12) hour = 0;

  const displayH = hour % 12 === 0 ? 12 : hour % 12;
  const displayM = String(minute).padStart(2, "0");
  const displayMeridian = hour >= 12 ? "PM" : "AM";
  const formatted = `${String(displayH).padStart(2, "0")}:${displayM} ${displayMeridian}`;

  return { hour, minute, formatted };
}

/**
 * Computes timezone offset in minutes for a given date in target timezone.
 */
function getTimeZoneOffsetMinutes(date, timeZone = TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const p = {};
  for (const part of parts) {
    if (part.type !== "literal") p[part.type] = parseInt(part.value, 10);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
  return (asUtc - date.getTime()) / 60000;
}

/**
 * Resolves the exact UTC Date object for an appointment date string and time slot in the hospital timezone.
 */
function getZonedAppointmentTime(dateStr, timeSlot, timeZone = TIMEZONE) {
  const cleanDate = parseQueueDate(dateStr);
  const { hour, minute } = parseTimeSlot(timeSlot);
  const [year, month, day] = cleanDate.split("-").map(Number);
  const approximateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(approximateUtc, timeZone);
  return new Date(approximateUtc.getTime() - offsetMinutes * 60000);
}

/**
 * Formats a Date object in the hospital timezone to 12h time string (e.g. "03:30 PM").
 */
function formatInTimezone(date, timeZone = TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return formatter.format(date);
}

/**
 * Evaluates the check-in window and ticket expiration logic for an appointment:
 * - Check-in Window: Opens exactly 30 minutes before the scheduled appointment time.
 * - Ticket Expiration: Expires exactly 1 hour (60 minutes) after the scheduled appointment time.
 * - States:
 *   - BOOKED: Scheduled slot, current time is before check-in opens.
 *   - CHECK_IN_AVAILABLE: Within [appointment - 30m, appointment + 60m].
 *   - EXPIRED: Past appointment + 60m without checking in.
 */
function getAppointmentTimingDetails(appointmentDate, timeSlot, now = new Date(), timeZone = TIMEZONE) {
  const aptTime = getZonedAppointmentTime(appointmentDate, timeSlot, timeZone);
  const aptTimestamp = aptTime.getTime();

  // Check-in opens 30 minutes before appointment
  const checkInOpensTimestamp = aptTimestamp - 30 * 60 * 1000;
  const checkInOpensAt = new Date(checkInOpensTimestamp);

  // Ticket expires 1 hour after scheduled appointment
  const expiresTimestamp = aptTimestamp + 60 * 60 * 1000;
  const expiresAt = new Date(expiresTimestamp);

  const currentMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  let status = "BOOKED";
  let canCheckIn = false;
  let isExpired = false;

  if (currentMs > expiresTimestamp) {
    status = "EXPIRED";
    isExpired = true;
    canCheckIn = false;
  } else if (currentMs >= checkInOpensTimestamp) {
    status = "CHECK_IN_AVAILABLE";
    canCheckIn = true;
  } else {
    status = "BOOKED";
    canCheckIn = false;
  }

  const minutesUntilCheckIn = Math.max(0, Math.ceil((checkInOpensTimestamp - currentMs) / 60000));
  const minutesUntilExpiration = Math.max(0, Math.ceil((expiresTimestamp - currentMs) / 60000));

  return {
    appointmentTime: aptTime,
    checkInOpensAt,
    expiresAt,
    formattedAppointmentTime: formatInTimezone(aptTime, timeZone),
    formattedCheckInOpensAt: formatInTimezone(checkInOpensAt, timeZone),
    formattedExpiresAt: formatInTimezone(expiresAt, timeZone),
    status,
    canCheckIn,
    isExpired,
    minutesUntilCheckIn,
    minutesUntilExpiration,
  };
}

/**
 * Extracts hour of day, day of week, and peak hour flag in hospital timezone.
 * Defaults to Asia/Kolkata.
 */
function getZonedTimeFeatures(date = new Date(), timeZone = TIMEZONE) {
  const d = date instanceof Date ? date : new Date(typeof date === "number" && date < 1e11 ? date * 1000 : date);

  // Day of week in hospital timezone (0=Sun, 1=Mon, ..., 6=Sat)
  const dayStr = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[dayStr] !== undefined ? dayMap[dayStr] : d.getDay();

  // Hour of day (0-23) in hospital timezone
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(d);
  let hourOfDay = parseInt(hourStr, 10);
  if (hourOfDay === 24) hourOfDay = 0;

  // Peak hour: 9-11 AM and 2-4 PM on weekdays (Mon-Fri)
  const isPeakHour = [9, 10, 11, 14, 15, 16].includes(hourOfDay) && dayOfWeek >= 1 && dayOfWeek <= 5 ? 1 : 0;

  return {
    hourOfDay,
    dayOfWeek,
    isPeakHour,
    hour_of_day: hourOfDay,
    day_of_week: dayOfWeek,
    is_peak_hour: isPeakHour,
  };
}

module.exports = {
  TIMEZONE,
  getCurrentQueueDate,
  parseQueueDate,
  queueDateToPrismaDate,
  dtToEpoch,
  parseTimeSlot,
  getTimeZoneOffsetMinutes,
  getZonedAppointmentTime,
  formatInTimezone,
  getAppointmentTimingDetails,
  getZonedTimeFeatures,
};
