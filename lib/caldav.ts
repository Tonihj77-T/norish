// AI generated.
import { v4 as uuidv4 } from "uuid";

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: Date; // start time (UTC or local). Converted to UTC in ICS.
  end: Date; // end time (UTC or local). Converted to UTC in ICS.
  uid?: string; // if omitted a UUID will be generated
  url?: string; // optional URL (ATTACH/URL property)
  location?: string; // optional LOCATION
}

export interface CreatedEvent {
  uid: string;
  href: string; // full URL (PUT target) of created .ics resource
  etag?: string; // ETag returned by server (if any)
  rawIcs: string; // ICS that was sent
}

interface CalDavClientOptions {
  baseUrl?: string; // calendar collection URL (must allow PUT of .ics)
  username?: string;
  password?: string;
}

/** Format date as UTC in basic format per RFC5545 */
function formatDateUTC(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

/** Escape text per RFC5545 (comma, semicolon, backslash, newline) */
function escapeText(value: string | undefined): string | undefined {
  if (!value) return value;

  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildIcs(
  data: Required<Pick<CreateEventInput, "summary" | "start" | "end" | "uid">> &
    Omit<CreateEventInput, "summary" | "start" | "end" | "uid">
): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Norish//CalDavClient//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.uid}`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${formatDateUTC(data.start)}`,
    `DTEND:${formatDateUTC(data.end)}`,
    `SUMMARY:${escapeText(data.summary)}`,
  ];

  if (data.description) lines.push(`DESCRIPTION:${escapeText(data.description)}`);
  if (data.location) lines.push(`LOCATION:${escapeText(data.location)}`);
  if (data.url) lines.push(`URL:${escapeText(data.url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR", "");

  return lines.join("\r\n");
}

export class CalDavClient {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(opts: CalDavClientOptions = {}) {
    this.baseUrl = (opts.baseUrl || "").trim();
    this.username = opts.username || "";
    this.password = opts.password || "";
    if (!this.baseUrl) throw new Error("CalDavClient: baseUrl missing (CALDAV_URL)");
    if (!this.baseUrl.endsWith("/")) this.baseUrl += "/";
    if (!this.username || !this.password)
      throw new Error("CalDavClient: credentials missing (CALDAV_USERNAME / CALDAV_PASSWORD)");
  }

  /** Create (insert) an event. Throws on non-2xx. */
  async createEvent(input: CreateEventInput): Promise<CreatedEvent> {
    if (input.end <= input.start) throw new Error("createEvent: end must be after start");
    const uid = input.uid || uuidv4();
    const ics = buildIcs({ ...input, uid });
    const href = this.baseUrl + uid + ".ics";

    const auth = Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64");
    const res = await fetch(href, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "text/calendar; charset=utf-8",
        "If-None-Match": "*", // avoid overwriting existing by accident
      },
      body: ics,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");

      throw new Error(`CalDAV createEvent failed ${res.status} ${res.statusText}: ${text}`);
    }

    return {
      uid,
      href,
      etag: res.headers.get("ETag") || undefined,
      rawIcs: ics,
    };
  }
}
