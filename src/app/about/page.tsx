"use client";

import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import Disclaimer from "../components/Disclaimer";

const listItemVariants = {
  hidden: { opacity: 0, y: 14, x: -6 },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const IS_ITEMS = [
  "A framework-application tool, not an oracle",
  "Grounded in retrieved framework excerpts, not unguided LLM opinion",
  "A starting point for structured thinking, not a substitute for mentors or advisors",
  "Free to use, no sign-up or account required",
];

const IS_NOT_ITEMS = [
  "Not investment, financial, legal, or business advice",
  "Not a prediction of whether your idea will succeed in the market",
  "Not a replacement for talking to real potential customers",
  "Not a storage service -- your ideas are processed in real time and immediately discarded",
];

export default function AboutPage() {
  return (
    <PageTransition>
      <div className="flex-grow pt-28 md:pt-32 pb-16 px-5 sm:px-8 md:px-10 lg:px-16 max-w-3xl mx-auto w-full space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-4"
        >
          <h1 className="font-heading text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            About Z-Combinator
          </h1>
          <p className="text-text-secondary text-base md:text-lg leading-relaxed">
            Z-Combinator is a structured evaluation tool for startup ideas. It applies frameworks from Y Combinator, Andreessen Horowitz, and NFX to give you cited, dimension-level feedback on your idea -- not a verdict on whether it will succeed.
          </p>
        </motion.div>

        {/* What Z-Combinator Is / Is Not Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="space-y-4"
          >
            <h2 className="font-heading text-xl font-semibold text-text-primary border-b border-border pb-2">
              What Z-Combinator Is
            </h2>
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="space-y-3 text-text-secondary text-sm sm:text-base leading-relaxed"
            >
              {IS_ITEMS.map((item, i) => (
                <motion.li key={i} variants={listItemVariants} className="flex items-start">
                  <span className="mr-2 select-none text-text-primary font-bold">—</span>
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-xl font-semibold text-text-primary border-b border-border pb-2">
              What Z-Combinator Is Not
            </h2>
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="space-y-3 text-text-secondary text-sm sm:text-base leading-relaxed"
            >
              {IS_NOT_ITEMS.map((item, i) => (
                <motion.li key={i} variants={listItemVariants} className="flex items-start">
                  <span className="mr-2 select-none text-text-primary">—</span>
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>

        {/* Detailed Legal Disclaimer Card */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-2xl border-2 p-6 md:p-8 bg-surface space-y-3 shadow-sm"
          style={{ borderColor: "var(--color-border-strong)" }}
        >
          <h3 className="font-heading text-lg font-semibold text-text-primary uppercase tracking-wider text-score-low">
            Legal Disclaimer
          </h3>
          <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
            Z-Combinator is provided on an as-is basis. The scores, valuations, suggestions, and justifications generated by this tool reflect the mechanical application of publicly available startup accelerator frameworks to your text inputs. They do not constitute professional advice, endorsement, or consulting of any kind.
          </p>
          <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
            No warranties or guarantees, express or implied, are made regarding the accuracy, completeness, viability, or applicability of any report to your specific situation or jurisdiction. Do not make material business, financial, or legal decisions based solely on Z-Combinator output. Always consult qualified professionals before taking action on any evaluation.
          </p>
        </motion.div>

        {/* Contact info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center pt-4 border-t border-border flex flex-col items-center space-y-4"
        >
          <p className="text-text-secondary text-sm font-body">
            Questions or feedback? Reach us at{" "}
            <a
              href="mailto:priyanshubpatel@gmail.com"
              className="text-text-primary font-medium hover:underline underline-offset-4"
            >
              priyanshubpatel@gmail.com
            </a>
          </p>

          <div className="flex items-center space-x-4 pt-1">
            <a
              href="https://github.com/Priyanshu-Debugs/Z-Combinator"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub Repository"
              className="px-4.5 py-2.5 rounded-xl border border-border bg-surface text-text-primary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center space-x-2"
            >
              <svg className="w-[22px] h-[22px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-bold">GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/priyanshu-debugs"
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn Profile"
              className="px-4.5 py-2.5 rounded-xl border border-border bg-surface text-text-primary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center space-x-2"
            >
              <svg className="w-[22px] h-[22px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-bold">LinkedIn</span>
            </a>
            <a
              href="https://priyaanshu.me"
              target="_blank"
              rel="noopener noreferrer"
              title="Portfolio Website"
              className="px-4.5 py-2.5 rounded-xl border border-border bg-surface text-text-primary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center space-x-2"
            >
              <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
                <polyline points="6 8 9 10 6 12" />
                <line x1="11" y1="12" x2="15" y2="12" />
              </svg>
              <span className="text-sm font-bold">Portfolio</span>
            </a>
          </div>
        </motion.div>
      </div>
      <Disclaimer />
    </PageTransition>
  );
}
