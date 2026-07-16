import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/lib/axiosConfig"; // Registers the global axios error-message interceptor — see that file's header comment.
import PublicNavbar from "@/components/Layout/PublicNavbar";

// Switched from Geist to Inter to match the Paya-style typography pass —
// Inter is the primary font in the redesign spec (Plus Jakarta Sans was the
// listed alternative). `--font-inter` backs the `font-family` in
// globals.css; Geist_Mono was dropped since nothing in the app referenced
// its CSS variable directly (code blocks use Tailwind's built-in font-mono
// utility instead, which is unaffected by this swap).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EdLearn — AI-Structured Study Paths",
  description:
    "Active, citation-backed learning. Generate personalized roadmaps, premium study notes, and listen along with synced highlighting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PublicNavbar />
        {children}
      </body>
    </html>
  );
}
