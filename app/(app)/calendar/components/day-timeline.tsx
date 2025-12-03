"use client";

// Re-export for backwards compatibility - calendar page uses mobile/desktop versions directly
export { default as DayTimelineMobile } from "./day-timeline-mobile";
export { default as DayTimelineDesktop } from "./day-timeline-desktop";

// Default export for any existing imports - uses mobile version
export { default } from "./day-timeline-mobile";
