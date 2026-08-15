"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Search, FileText } from "lucide-react";

function PageLine({ w, highlight }: { w: string; highlight?: boolean }) {
  return (
    <div
      className={`h-1.5 rounded-full ${highlight ? "bg-primary-light/80" : "bg-slate-500/50"}`}
      style={{ width: w }}
    />
  );
}

// Animated hero centerpiece: a phone films an open book, captured pages fly
// out and straighten, and they land in a finished searchable PDF. Built
// entirely in CSS/Framer Motion so it ships no video assets.
export function ProductDemo() {
  const reduce = useReducedMotion();

  const pages = [0, 1, 2];

  return (
    <div className="relative mx-auto flex h-[340px] w-full max-w-lg items-center justify-center sm:h-[460px]">
      {/* soft glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />

      {/* Phone filming the book */}
      <div className="absolute left-0 top-1/2 z-20 -translate-y-1/2">
        <div className="relative h-64 w-36 rounded-[1.75rem] border border-border bg-bg-alt p-2 shadow-2xl shadow-black/50 sm:h-72 sm:w-40">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.25rem] bg-slate-800">
            {/* camera viewfinder with open book */}
            <div className="relative flex-1 bg-gradient-to-b from-slate-700 to-slate-800">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  className="flex gap-1"
                  animate={reduce ? undefined : { rotateY: [0, 12, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformPerspective: 400 }}
                >
                  <div className="flex h-20 w-12 flex-col gap-1 rounded-l-sm bg-slate-200 p-1.5">
                    {[9, 8, 9, 7].map((n, i) => (
                      <div key={i} className="h-1 rounded-full bg-slate-400" style={{ width: `${n * 4}px` }} />
                    ))}
                  </div>
                  <div className="flex h-20 w-12 flex-col gap-1 rounded-r-sm bg-slate-100 p-1.5">
                    {[8, 9, 7, 9].map((n, i) => (
                      <div key={i} className="h-1 rounded-full bg-slate-400" style={{ width: `${n * 4}px` }} />
                    ))}
                  </div>
                </motion.div>
              </div>
              {/* scanning line */}
              {!reduce && (
                <motion.div
                  className="absolute inset-x-3 h-0.5 rounded-full bg-primary-light shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]"
                  animate={{ top: ["18%", "78%", "18%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {/* REC badge */}
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5">
                <motion.span
                  className="size-1.5 rounded-full bg-red-500"
                  animate={reduce ? undefined : { opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-[8px] font-semibold text-white">REC</span>
              </div>
            </div>
            {/* controls */}
            <div className="flex items-center justify-center bg-slate-900 py-2">
              <div className="size-6 rounded-full border-2 border-white/80" />
            </div>
          </div>
        </div>
      </div>

      {/* Flying pages */}
      {pages.map((i) => (
        <motion.div
          key={i}
          className="absolute left-20 top-1/2 z-10 h-28 w-20 rounded-md border border-border bg-slate-100 p-2 shadow-xl sm:left-28"
          style={{ transformPerspective: 600 }}
          animate={
            reduce
              ? undefined
              : {
                  x: [0, 90, 150],
                  y: [-10, -40, -30 + i * 6],
                  rotateZ: [-18, -6, 0],
                  rotateY: [40, 10, 0],
                  opacity: [0, 1, 1, 0],
                  scale: [0.8, 1, 0.96],
                }
          }
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 1.05,
            times: [0, 0.5, 1],
          }}
        >
          <div className="flex h-full flex-col gap-1.5">
            <div className="h-2 w-10 rounded-full bg-primary/70" />
            {[9, 10, 8, 10, 7, 9].map((n, k) => (
              <div key={k} className="h-1 rounded-full bg-slate-400" style={{ width: `${n * 5}px` }} />
            ))}
          </div>
        </motion.div>
      ))}

      {/* Finished PDF with search */}
      <div className="absolute right-0 top-1/2 z-20 -translate-y-1/2">
        <motion.div
          className="relative w-44 rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/50 sm:w-52"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* stacked page hint behind */}
          <div className="absolute -right-1.5 -top-1.5 -z-10 h-full w-full rounded-xl border border-border bg-card/60" />

          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary-light">
              <FileText className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-foreground">Chapter_4.pdf</span>
          </div>

          {/* search bar */}
          <div className="mb-2 flex items-center gap-1.5 rounded-md border border-border bg-bg-alt px-2 py-1.5">
            <Search className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-[10px] text-muted-foreground">photosynthesis</span>
          </div>

          {/* page content with highlight */}
          <div className="space-y-1.5 rounded-md bg-slate-100 p-2.5">
            <PageLine w="90%" />
            <div className="flex gap-1">
              <PageLine w="30%" highlight />
              <PageLine w="45%" />
            </div>
            <PageLine w="80%" />
            <PageLine w="95%" />
            <div className="flex gap-1">
              <PageLine w="40%" />
              <PageLine w="28%" highlight />
            </div>
            <PageLine w="70%" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
