"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary: renders when an error escapes even the root layout, so
// it can't rely on globals.css/Tajawal being loaded — all styles are inline with
// brand hex values to guarantee it renders.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html dir="rtl" lang="ar">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "#EBEFF2",
            fontFamily: "Tajawal, system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#1A1023",
                marginBottom: "0.75rem",
              }}
            >
              حدث خطأ غير متوقع
            </h1>
            <p
              style={{
                color: "#5b5566",
                lineHeight: 1.7,
                marginBottom: "1.5rem",
              }}
            >
              حاولي تحديث الصفحة. لو استمر الخطأ، تواصلي معنا.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: "#4E2490",
                color: "#ffffff",
                fontWeight: 700,
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "1rem",
              }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
