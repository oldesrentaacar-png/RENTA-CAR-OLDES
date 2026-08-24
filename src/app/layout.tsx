import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "OLDES Rent-a-Car | Administración",
  description: "Sistema de gestión OLDES Rent-a-Car",
  icons: {
    icon: "/brand/oldes-logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
      </body>
    </html>
  );
}
