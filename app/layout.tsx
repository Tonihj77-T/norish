import "@/styles/globals.css";
import { appMetadata, appViewport } from "./metadata";

import { fontSans } from "@/config/fonts";
import RegisterServiceWorker from "@/components/register-service-worker";

export const metadata = appMetadata;
export const viewport = appViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <meta content="transparent" name="theme-color" />
      </head>
      <body
        className={`bg-background text-foreground min-h-dvh font-sans antialiased ${fontSans.variable}`}
      >
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
