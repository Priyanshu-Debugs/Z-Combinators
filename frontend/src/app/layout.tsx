import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
        theme: dark,
        variables: {
          colorPrimary: "#ffffff",
          colorBackground: "#0c0d0e",
          colorForeground: "#ffffff",
          colorMutedForeground: "#a1a1aa",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "border border-zinc-800 bg-[#0c0d0e]/95 backdrop-blur-xl shadow-2xl",
          formButtonPrimary: "bg-white text-black hover:bg-zinc-200 transition font-medium",
          formFieldInput: "bg-[#16181a] border-zinc-800 text-white",
          socialButtonsBlockButton: "border border-zinc-800 hover:bg-zinc-900 transition text-white",
          footerActionLink: "text-white underline hover:text-zinc-300",
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
