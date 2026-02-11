import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sakan Alsayd | سكن السيد",
  description: "Fully furnished student housing in Saudi Arabia | سكن طالبات مجهز بالكامل في السعودية",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
