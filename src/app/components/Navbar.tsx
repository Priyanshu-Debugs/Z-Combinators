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
    const base = `relative font-heading ${sizeClass} transition-colors duration-200 hover:text-text-primary/70`;
    if (isActive) {
      return `${base} text-text-primary font-medium`;
    }
    return `${base} text-text-secondary`;
  };

  const navLinks = [
    ...(isEvaluate ? [{ href: "/", label: "Home" }] : []),
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
          Z-Combinator
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

        {/* Spacer to balance layout on desktop */}
        <div className="hidden md:block w-[120px]" />

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
                    className="font-heading text-3xl font-medium text-text-secondary hover:text-text-primary transition-colors block"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
