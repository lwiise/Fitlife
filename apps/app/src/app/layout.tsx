import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/styles/globals.css";
import { SentryUserSync } from "./SentryUserSync";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { VersionWatcher } from "@/components/VersionWatcher";
import { BuildStamp } from "@/components/BuildStamp";
import { ConsentSlot } from "./ConsentSlot";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://app.fitlife.app",
  ),
  title: {
    default: "فت لايف — تطبيقك",
    template: "%s | فت لايف",
  },
  description: "خطتك الغذائية الذكية. تطبيق فت لايف.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="antialiased">
        <SentryUserSync />
        <AnalyticsProvider />
        {/* First block of the document and IN FLOW, deliberately not a bar at
            the end of the body: as `fixed bottom-0` this covered the bottom band
            of the viewport at every scroll offset, which is where every primary
            CTA in this app lives. App-wide, not marketing-only — a deep-link
            signup never sees `/`, and under opt-in consent that would mean never
            measured. */}
        <ConsentSlot />
        {children}
        <VersionWatcher />
        <BuildStamp />
      </body>
    </html>
  );
}
