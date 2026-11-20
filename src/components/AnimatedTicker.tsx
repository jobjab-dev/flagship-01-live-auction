"use client";

import { AnimatePresence, motion } from "framer-motion";

interface AnimatedTickerProps {
  value: number;
  optimistic?: boolean;
  currencyPrefix?: string;
}

function DigitDrum({ char }: { char: string }) {
  const isDigit = /[0-9]/.test(char);

  if (!isDigit) {
    return (
      <span
        className={`inline-block select-none ${char === " " ? "w-[0.34em]" : "px-[1px]"}`}
        aria-hidden="true"
      >
        {char === " " ? "\u00A0" : char}
      </span>
    );
  }

  return (
    <span className="relative inline-flex h-[1.12em] w-[0.62em] overflow-hidden justify-center align-baseline">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ y: "0.75em", opacity: 0 }}
          animate={{ y: "0em", opacity: 1 }}
          exit={{ y: "-0.75em", opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.19, 1, 0.22, 1] }}
          className="inline-block tabular-nums leading-[1.12em]"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AnimatedTicker({
  value,
  optimistic = false,
  currencyPrefix = "CHF ",
}: AnimatedTickerProps) {
  const formatted = `${currencyPrefix}${value.toLocaleString("en-US")}`;
  const chars = formatted.split("");

  return (
    <div
      className={`inline-flex items-baseline font-mono font-semibold tracking-tight tabular-nums transition-colors duration-200 ${
        optimistic ? "text-[#A7E3C6]" : "text-podium-ink"
      }`}
      aria-label={formatted}
    >
      <span className="sr-only">{formatted}</span>
      <span
        className="inline-flex items-baseline text-[2.25rem] sm:text-[2.75rem] leading-none"
        aria-hidden="true"
      >
        {chars.map((char, idx) => (
          <DigitDrum key={`${chars.length - idx}-${char === "," ? "sep" : "ch"}`} char={char} />
        ))}
      </span>
    </div>
  );
}
