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
          className="text-center pt-4 border-t border-border"
        >
          <p className="text-text-secondary text-sm font-body">
            Questions or feedback? Reach us at{" "}
            <a
              href="mailto:ping@z-combinator.com"
              className="text-text-primary font-medium hover:underline underline-offset-4"
            >
              ping@z-combinator.com
            </a>
          </p>
        </motion.div>
      </div>
      <Disclaimer />
    </PageTransition>
  );
}
