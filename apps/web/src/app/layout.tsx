import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

import { CookieConsent } from "@/components/CookieConsent";
import { DirProvider } from "@/components/providers/direction-provider";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

import { Providers } from "./providers";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

// TODO: Replace https://fitlife.app with real production domain before launch.
export const metadata: Metadata = {
  metadataBase: new URL("https://fitlife.app"),
  title: {
    default: "فت لايف — خطة غذائية لكل البيت",
    template: "%s | فت لايف",
  },
  description:
    "ذكاء اصطناعي يصمم خطة غذائية لكل فرد في عائلتك، بلغته. مدعوم بخبيرة تغذية سعودية معتمدة. أول 7 أيام مجانية.",
  keywords: [
    "تغذية",
    "خطة غذائية",
    "ذكاء اصطناعي",
    "السعودية",
    "الخليج",
    "العائلة",
    "خادمة",
    "وصفات خليجية",
  ],
  authors: [{ name: "Fit Life" }],
  creator: "Fit Life",
  publisher: "Fit Life",
  openGraph: {
    type: "website",
    locale: "ar_SA",
    url: "https://fitlife.app",
    siteName: "فت لايف",
    title: "فت لايف — خطة غذائية لكل البيت",
    description:
      "ذكاء اصطناعي يصمم خطة غذائية لكل فرد في عائلتك، بلغته. مجاناً 7 أيام.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "فت لايف — خطة غذائية ذكية للعائلة الخليجية",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "فت لايف — خطة غذائية لكل البيت",
    description:
      "ذكاء اصطناعي يصمم خطة غذائية لكل فرد في عائلتك، بلغته. مجاناً 7 أيام.",
    images: ["/og-image.svg"],
  },
  alternates: {
    canonical: "https://fitlife.app",
    languages: {
      "ar-SA": "https://fitlife.app",
      "en-US": "https://fitlife.app/en",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
      className={`${tajawal.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <DirProvider>
          <Providers>
            {children}
            <CookieConsent />
            <ScrollToTop />
          </Providers>
        </DirProvider>
      </body>
    </html>
  );
}
