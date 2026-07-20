import type { Metadata } from "next";
import "./globals.css";
import "@/lib/axiosConfig"; // Registers the global axios error-message interceptor — see that file's header comment.
import PublicNavbar from "@/components/Layout/PublicNavbar";

// NOTE: Previously this loaded "Inter" via `next/font/google`, which fetches
// the font from Google's servers at COMPILE time. On any machine that can't
// reach fonts.googleapis.com (offline / firewall / slow proxy), that fetch
// hangs and the page never finishes compiling — the browser just spins on
// "Loading...". To make the app run reliably everywhere, the font is now a
// pure system-font stack defined in globals.css (`--font-inter`), so no
// network request is needed to render. Swap back to next/font only if you
// want the exact Inter typeface AND have reliable network at build time.

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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PublicNavbar />
        {children}
      </body>
    </html>
  );
}
