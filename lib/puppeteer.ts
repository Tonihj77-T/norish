import puppeteer, { Browser } from "puppeteer-core";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { serverLogger as log } from "@/server/logger";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  // Check if we should connect to remote Chrome
  const chromeWsEndpoint = SERVER_CONFIG.CHROME_WS_ENDPOINT;

  if (chromeWsEndpoint) {
    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: chromeWsEndpoint,
      });
    } catch (error) {
      log.error({ err: error }, "Failed to connect to remote Chrome");
      throw new Error(
        "Chrome service not available. Please start the chrome service or check CHROME_WS_ENDPOINT."
      );
    }
  } else {
    throw new Error("No Chrome available. Set CHROME_WS_ENDPOINT to use a remote Chrome service.");
  }

  return browser;
}

export async function closeBrowser() {
  if (browser) {
    try {
      await browser.disconnect();
    } catch (error) {
      log.error({ err: error }, "Error closing browser");
    }
    browser = null;
  }
}

// Graceful shutdown
process.on("SIGINT", closeBrowser);
process.on("SIGTERM", closeBrowser);
