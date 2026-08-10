import "./globals.css";
import { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Instrument_Serif, Fredoka } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-instrument-serif" });
const fredoka = Fredoka({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-fredoka" });

export const metadata: Metadata = {
  title: "Student Leadership OS",
  description: "Manage your roles, relationships, and impact across campus leadership",
  manifest: "/manifest.json",
  verification: {
    google: "KbW5T_pUL7zFXevHbt6-1zG_s1iFmKhfvuHTEJF--6w",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Leadership",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFAF5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // expose env(safe-area-inset-*) so the install card clears the home indicator
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${inter.className} ${instrumentSerif.variable} ${fredoka.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} nonce={nonce}>
          <SessionProvider>{children}</SessionProvider>
          <InstallPrompt />
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
        <script src="/register-sw.js" nonce={nonce} defer />
      </body>
    </html>
  );
}
