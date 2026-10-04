import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Navbar from "./components/Navbar";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Z-Combinators | AI-Powered Startup Evaluation",
  description:
    "Cross-reference your startup pitch against 150+ frameworks from YC, a16z, and NFX. Get unvarnished, cited feedback in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/evaluate"
      signUpFallbackRedirectUrl="/evaluate"
      appearance={{
        variables: {
          colorPrimary: "#0A0A0A",
          colorBackground: "#FFFFFF",
          colorForeground: "#0A0A0A",
          colorMutedForeground: "#6B6B6B",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "border border-black/10 bg-white/95 backdrop-blur-xl shadow-xl",
          formButtonPrimary: "bg-black text-white hover:bg-neutral-800 transition font-medium",
          formFieldInput: "bg-[#F7F7F6] border-black/10 text-black",
          socialButtonsBlockButton: "border border-black/10 hover:bg-black/5 transition text-black",
          footerActionLink: "text-black underline hover:text-neutral-700",
        },
      }}
    >
      <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
        <body className="font-body bg-bg text-text-primary min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
