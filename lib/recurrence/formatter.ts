import type { RecurrencePattern } from "@/types/recurrence";

import { format, parseISO, differenceInDays } from "date-fns";

/**
 * Format a recurrence pattern into a human-readable summary.
 * Examples: "Every day", "Every 2 weeks on Monday", "Every month on Thursday"
 */
export function formatRecurrenceSummary(pattern: RecurrencePattern): string {
  const { rule, interval, weekday } = pattern;

  // Build interval text
  let intervalText = "";

  if (interval === 1) {
    intervalText = "Every";
  } else if (interval === 2) {
    intervalText = "Every other";
  } else {
    intervalText = `Every ${interval}`;
  }

  // Build unit text
  let unitText = "";

  switch (rule) {
    case "day":
      unitText = interval === 1 ? "day" : "days";
      break;
    case "week":
      unitText = interval === 1 ? "week" : "weeks";
      break;
    case "month":
      unitText = interval === 1 ? "month" : "months";
      break;
  }

  // Build weekday text if applicable
  let weekdayText = "";

  if (weekday !== undefined) {
    const weekdayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    weekdayText = ` on ${weekdayNames[weekday]}`;
  }

  return `${intervalText} ${unitText}${weekdayText}`;
}

/**
 * Format the next occurrence date into a readable text.
 * Examples: "today", "tomorrow", "Monday", "Nov 25"
 */
export function formatNextOccurrence(nextDate: string): string {
  const next = parseISO(nextDate);
  const today = new Date();

  // Use startOfDay to ensure accurate day calculations
  const nextDay = new Date(next);

  nextDay.setHours(0, 0, 0, 0);
  const todayDay = new Date(today);

  todayDay.setHours(0, 0, 0, 0);

  const daysDiff = differenceInDays(nextDay, todayDay);

  // console.log('[formatNextOccurrence] Formatting:', {
  //   nextDate,
  //   today: format(todayDay, 'yyyy-MM-dd'),
  //   daysDiff,
  // });

  if (daysDiff === 0) {
    return "today";
  } else if (daysDiff === 1) {
    return "tomorrow";
  } else if (daysDiff > 0 && daysDiff <= 6) {
    return format(next, "EEEE"); // Day name (e.g., "Monday")
  } else if (daysDiff < 365) {
    return format(next, "MMM d"); // e.g., "Nov 25"
  } else {
    return format(next, "MMM d, yyyy"); // e.g., "Nov 25, 2026"
  }
}

/**
 * Format a full recurrence description with next occurrence.
 * Example: "Every week on Monday • Next: Nov 25"
 */
export function formatRecurrenceWithNext(pattern: RecurrencePattern, nextDate: string): string {
  const summary = formatRecurrenceSummary(pattern);
  const nextText = formatNextOccurrence(nextDate);

  return `${summary} • Next: ${nextText}`;
}

/**
 * Format a recurrence pattern as input text (e.g., for edit mode).
 * Examples: "every day", "every 2 weeks", "every week on monday"
 */
export function formatRecurrenceAsText(pattern: RecurrencePattern): string {
  const { rule, interval, weekday } = pattern;

  let text = "every";

  // Add interval
  if (interval === 2) {
    text += " other";
  } else if (interval > 2) {
    text += ` ${interval}`;
  }

  // Add unit
  switch (rule) {
    case "day":
      text += interval === 1 ? " day" : " days";
      break;
    case "week":
      text += interval === 1 ? " week" : " weeks";
      break;
    case "month":
      text += interval === 1 ? " month" : " months";
      break;
  }

  // Add weekday if specified
  if (weekday !== undefined) {
    const weekdayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    text += ` on ${weekdayNames[weekday]}`;
  }

  return text;
}
