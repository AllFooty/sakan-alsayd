import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sakan Alsayd | سكن السيد",
  description: "أكبر سكن طالبات و موظفات في المملكة",
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
