import "./globals.css";
import { Metadata } from "next";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Student Leadership Dashboard",
  description: "Track time, impact, relationships, and responsibilities across campus roles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
