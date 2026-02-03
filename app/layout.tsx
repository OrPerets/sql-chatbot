import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import "./components/admin/design-tokens.css";
const inter = localFont({
  src: "../fonts/NotoSansHebrew-Regular.ttf",
  display: "swap",
  fallback: ["system-ui", "arial"],
});

export const metadata = {
  title: "Michael - SQL Assistant",
  description: "AI-powered SQL teaching assistant to help you master database queries",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Michael",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2a8ad8",
};

function resolveLocale({ acceptLanguage, headerLocale, cookieLocale }: { acceptLanguage: string; headerLocale?: string | null; cookieLocale?: string | null }) {
  if (cookieLocale && (cookieLocale === "he" || cookieLocale === "en")) {
    return cookieLocale;
  }

  if (headerLocale && (headerLocale === "he" || headerLocale === "en")) {
    return headerLocale;
  }

  const primaryLanguage = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  return primaryLanguage.startsWith("en") ? "en" : "he";
}

export default async function RootLayout({ children }) {
  const headerList = await headers();
  const cookieStore = await cookies();
  const acceptLanguage = headerList.get("accept-language") ?? "";
  const headerLocale = headerList.get("x-michael-locale");
  const cookieLocale = cookieStore.get("michael-locale")?.value ?? null;
  const locale = resolveLocale({ acceptLanguage, headerLocale, cookieLocale });
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Michael" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <meta name="theme-color" content="#2a8ad8" />
      </head>
      <body className={inter.className}>
        {children}
        {/* <img className="logo" src="/bot.png" alt="Mik Logo" style={{width: "120px", height: "120px"}}/> */}
        
        {/* Service Worker Registration */}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(registration) {
                    console.log('Michael PWA: ServiceWorker registration successful');
                  })
                  .catch(function(error) {
                    console.log('Michael PWA: ServiceWorker registration failed');
                  });
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
