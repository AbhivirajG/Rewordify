import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rewordify — AI Detector + Humanizer",
  description:
    "Detect AI-generated text and rewrite it into natural, human-sounding prose.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-on-background">
        <TopNav />
        <div className="flex-1 flex flex-col w-full">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
