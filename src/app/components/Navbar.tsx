"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  // Link class depends on active page
  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    const base = "font-heading text-[23px] transition-colors duration-200 hover:text-text-primary/70";
    if (isActive) {
      return `${base} text-text-primary font-medium`;
    }
    return `${base} text-text-secondary`;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        isHome ? "bg-transparent" : "bg-bg/85 backdrop-blur-md border-b border-border"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-10 lg:px-16 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-heading text-[21px] font-medium text-text-primary tracking-tight">
          Z-Combinator
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link href="/methodology" className={getLinkClass("/methodology")}>
            Methodology
          </Link>
          <Link href="/about" className={getLinkClass("/about")}>
            About
          </Link>
        </nav>

        {/* CTA Button */}
        <div className="hidden md:block">
          <Link
            href="/evaluate"
            className="inline-flex items-center px-6 py-3 rounded-full bg-accent text-accent-inverse text-[15px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Validate your Idea
            <svg
              className="ml-2 w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* Mobile Hamburger Menu */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 text-text-primary focus:outline-none z-50"
          aria-label="Toggle menu"
        >
          <div className="w-6 h-5 flex flex-col justify-between">
            <span
              className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 origin-left ${
                isOpen ? "rotate-45 translate-x-1" : ""
              }`}
            />
            <span
              className={`w-full h-0.5 bg-current rounded-full transition-opacity duration-300 ${
                isOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 origin-left ${
                isOpen ? "-rotate-45 translate-x-1" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-bg z-40 flex flex-col pt-32 px-10 md:hidden"
          >
            <nav className="flex flex-col space-y-6">
              <Link
                href="/methodology"
                onClick={() => setIsOpen(false)}
                className="font-heading text-3xl font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Methodology
              </Link>
              <Link
                href="/about"
                onClick={() => setIsOpen(false)}
                className="font-heading text-3xl font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                About
              </Link>
              <Link
                href="/evaluate"
                onClick={() => setIsOpen(false)}
                className="font-heading text-3xl font-medium text-text-primary underline decoration-2 underline-offset-8"
              >
                Validate your Idea
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
