import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/styles/globals.css";
import { createClient } from "@/lib/supabase/server";
import { SentryUserSync } from "./SentryUserSync";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="antialiased">
        <SentryUserSync userId={userId} />
        {children}
      </body>
    </html>
  );
}
