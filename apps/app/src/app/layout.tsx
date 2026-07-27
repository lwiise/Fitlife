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
        {children}
        {/* LAST in the document, deliberately. As `fixed bottom-0` this covered
            the bottom band of the viewport at every scroll offset — where every
            primary CTA in this app lives. Moving it into flow fixed that, but at
            the TOP of <body> it then pushed the whole page down when it mounted
            at hydration, relocating a control out from under a finger already
            descending on it: the same mis-tap, just spread over every control
            instead of the bottom band. Nothing above the last element can move.
            App-wide, not marketing-only — a deep-link signup never sees `/`, and
            under opt-in consent that would mean never measured. */}
        <ConsentSlot />
        <VersionWatcher />
        <BuildStamp />
      </body>
    </html>
  );
}
