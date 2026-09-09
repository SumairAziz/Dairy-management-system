import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/app/context/theme-context";
import { QueryProvider } from "@/lib/query-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { ExportToastProvider } from "@/components/export/ExportToastProvider";
import { Sidebar } from "@/app/components/sidebar";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "TerraDairy — Smart Dairy Farm Management",
  description:
    "Manage farms, units, animals, breeding, health and milk production.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>
            <ExportToastProvider>
              <ThemeProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 min-w-0">{children}</main>
              </div>
              </ThemeProvider>
            </ExportToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
