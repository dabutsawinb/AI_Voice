import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Voice Studio | Synthesis & Transformation",
  description: "ระบบสังเคราะห์และแปลงโฉมเสียงอัจฉริยะ — Text-to-Speech & Voice Conversion",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#1a1d27",
              border: "1px solid #2a2d3e",
              color: "#f0f4ff",
            },
          }}
        />
      </body>
    </html>
  );
}
