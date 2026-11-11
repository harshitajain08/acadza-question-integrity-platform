import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Acadza Question Integrity | Review every question with care",
  description: "A transparent question-defect review platform for JEE and NEET students and faculty. Report issues, investigate evidence, and approve safe repairs.",
  applicationName: "Acadza Question Integrity",
  openGraph: {
    title: "Acadza Question Integrity",
    description: "Better questions. Fairer outcomes.",
    type: "website",
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f9fc",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
