import "./globals.css";
import { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Student Leadership OS",
  description: "Manage your roles, relationships, and impact across campus leadership",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
