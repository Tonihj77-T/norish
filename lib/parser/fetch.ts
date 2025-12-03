import { getBrowser } from "../puppeteer";

import { parserLogger as log } from "@/server/logger";

export async function fetchViaPuppeteer(targetUrl: string): Promise<string> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    try {
      await page.waitForSelector('script[type="application/ld+json"]', {
        timeout: 8000,
      });
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }

    const content = await page.content();

    await page.close();

    return content;
  } catch (error) {
    log.warn({ err: error }, "Puppeteer fetch failed, Chrome may not be available");

    return ""; // Fallback will use HTTP
  }
}

export async function fetchViaHttp(targetUrl: string): Promise<string> {
  try {
    const res = await (globalThis as any).fetch(targetUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    return !res || !res.ok ? "" : await res.text();
  } catch {
    return "";
  }
}
