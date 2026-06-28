import "./globals.css";
import { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Student Leadership OS",
  description: "Manage your roles, relationships, and impact across campus leadership",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Leadership OS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get("x-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
          <SessionProvider>{children}</SessionProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
        <script src="/register-sw.js" nonce={nonce} defer />
      </body>
    </html>
  );
}
