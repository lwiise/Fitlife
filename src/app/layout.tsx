import type { Metadata, Viewport } from "next";
import { Tajawal, Reem_Kufi } from "next/font/google";
import "./globals.css";

import { DirProvider } from "@/components/providers/direction-provider";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const reemKufi = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-reem-kufi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "فيت لايف ٢٫٠ — تغذية ذكية للعائلة الخليجية",
  description:
    "اشتراك واحد يخدم العائلة كاملة، كل فرد بلغته. خطط وجبات مخصصة بالذكاء الاصطناعي.",
};

export const viewport: Viewport = {
  themeColor: "#EBEFF2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${reemKufi.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <DirProvider>{children}</DirProvider>
      </body>
    </html>
  );
}
