import { Inter } from "next/font/google";
import "./globals.css";
import Warnings from "./components/warnings";
import { assistantId } from "./assistant-config";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Michael - SQL Assistant",
  description: "AI-powered SQL teaching assistant to help you master database queries",
  manifest: "/manifest.json",
  icons: {
    icon: "/bot.png",
    apple: "/bot.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: "#2a8ad8",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Michael",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Michael" />
        <link rel="apple-touch-icon" href="/bot.png" />
        <meta name="theme-color" content="#2a8ad8" />
      </head>
      <body className={inter.className}>
        {assistantId ? children : <Warnings />}
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
