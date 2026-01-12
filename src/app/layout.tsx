import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Editorial RAG Assistant",
  description: "AI-powered editorial workflow assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background flex`} suppressHydrationWarning>
        <Sidebar />
        <main className="flex-1 max-h-screen overflow-y-auto">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
