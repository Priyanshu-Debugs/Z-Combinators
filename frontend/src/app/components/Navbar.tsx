"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isEvaluate = pathname === "/evaluate";
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  // Track scroll position for blur effect
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Pre-warm the backend on initial mount
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${API_URL}/health`, { method: "GET" }).catch(() => {
      // Silently catch errors during the wake-up pings
    });
  }, []);

  // Determine background style based on page and scroll
  const getBgClass = () => {
    if (isHome) {
      return hasScrolled
        ? "bg-bg/80 backdrop-blur-lg border-b border-border shadow-[0_1px_8px_rgba(0,0,0,0.03)]"
        : "bg-transparent";
    }
    return "bg-bg/85 backdrop-blur-md border-b border-border";
  };

  // Link class depends on active page
  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    const sizeClass = isEvaluate ? "text-[15px]" : "text-[23px]";
    const base = `relative font-heading ${sizeClass} transition-colors duration-200`;
    if (isActive) {
      return `${base} text-text-primary font-medium`;
    }
    return `${base} text-text-primary/85 hover:text-text-primary`;
  };

  const navLinks = [
    ...(!isHome ? [{ href: "/", label: "Home" }] : []),
    { href: "/methodology", label: "Methodology" },
    { href: "/about", label: "About" },
  ];

  // Mobile menu item animation variants
  const mobileItemVariants = {
    hidden: { opacity: 0, y: 16, x: -8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        delay: i * 0.08,
        duration: 0.35,
        ease: "easeOut" as const,
      },
    }),
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${getBgClass()}`}
    >
      <div className={`max-w-7xl mx-auto px-5 sm:px-8 md:px-10 lg:px-16 flex items-center justify-between transition-all duration-300 ${isEvaluate ? "h-14" : "h-20"}`}>
        {/* Logo */}
        <Link href="/" className={`font-heading font-medium text-text-primary tracking-tight transition-all duration-300 ${isEvaluate ? "text-[18px]" : "text-[21px]"}`}>
          Z-Combinators
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={getLinkClass(link.href)}>
              {link.label}
              {/* Active link underline indicator */}
              {pathname === link.href && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </nav>

        {/* Social Actions */}
        <div className="hidden md:flex items-center justify-end space-x-5 w-[160px]">
          <a
            href="https://github.com/Priyanshu-Debugs/Z-Combinators"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Repository"
            className="p-2 rounded-xl hover:bg-text-secondary/10 transition-all duration-200"
          >
            <svg className="w-[26px] h-[26px] text-text-primary hover:text-text-primary/70 transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/in/priyanshu-debugs"
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn Profile"
            className="p-2 rounded-xl hover:bg-text-secondary/10 transition-all duration-200"
          >
            <svg className="w-[26px] h-[26px] text-text-primary hover:text-text-primary/70 transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
            </svg>
          </a>
          <a
            href="https://priyaanshu.me"
            target="_blank"
            rel="noopener noreferrer"
            title="Portfolio Website"
            className="p-2 rounded-xl hover:bg-text-secondary/10 transition-all duration-200"
          >
            <svg className="w-[26px] h-[26px] text-text-primary hover:text-text-primary/70 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <polyline points="6 8 9 10 6 12" />
              <line x1="11" y1="12" x2="15" y2="12" />
            </svg>
          </a>
        </div>

        {/* Mobile Hamburger Menu */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 text-text-primary focus:outline-none z-50"
          aria-label="Toggle menu"
        >
          <div className="w-6 h-5 flex flex-col justify-between">
            <span
              className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 origin-left ${isOpen ? "rotate-45 translate-x-1" : ""
                }`}
            />
            <span
              className={`w-full h-0.5 bg-current rounded-full transition-opacity duration-300 ${isOpen ? "opacity-0" : ""
                }`}
            />
            <span
              className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 origin-left ${isOpen ? "-rotate-45 translate-x-1" : ""
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
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  custom={i}
                  variants={mobileItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="font-heading text-3xl font-medium text-text-primary/85 hover:text-text-primary transition-colors block"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Mobile Social Links */}
            <motion.div
              custom={navLinks.length}
              variants={mobileItemVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap items-center gap-4 sm:gap-6 mt-12 pt-6 border-t border-border"
            >
              <a
                href="https://github.com/Priyanshu-Debugs/Z-Combinators"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-2.5 text-text-primary hover:text-text-primary/70 transition-colors duration-200"
              >
                <svg className="w-[26px] h-[26px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-[15px] font-heading font-medium">GitHub</span>
              </a>
              <a
                href="https://www.linkedin.com/in/priyanshu-debugs"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-2.5 text-text-primary hover:text-text-primary/70 transition-colors duration-200"
              >
                <svg className="w-[26px] h-[26px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
                <span className="text-[15px] font-heading font-medium">LinkedIn</span>
              </a>
              <a
                href="https://priyaanshu.me"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-2.5 text-text-primary hover:text-text-primary/70 transition-colors duration-200"
              >
                <svg className="w-[26px] h-[26px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <polyline points="6 8 9 10 6 12" />
                  <line x1="11" y1="12" x2="15" y2="12" />
                </svg>
                <span className="text-[15px] font-heading font-medium">Portfolio</span>
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
