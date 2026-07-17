import type { MetadataRoute } from "next";

/**
 * PWA manifest — the "add to home screen" channel unlock. A home-screen icon
 * is ambient retention for a mobile-web product with no push channel, and a
 * standalone install is the prerequisite for iOS web push (Safari ≥16.4)
 * when that decision comes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "فت لايف — خطط وجبات عائلتك",
    short_name: "فت لايف",
    description:
      "خطط وجبات مخصصة لكل أفراد بيتك، ووصفات الطبخ بلغة من يطبخ — باشتراك واحد",
    id: "/dashboard",
    start_url: "/dashboard",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#EBEFF2",
    theme_color: "#4E2490",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
