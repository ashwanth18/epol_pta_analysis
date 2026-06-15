import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "epol PTA Analytics",
  description: "Feed mill intelligence — every DBF, every KPI, every batch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 max-w-[1400px] mx-auto w-full px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
