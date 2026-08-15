"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackedLink } from "@/app/components/TrackedLink";

// Bottom bar on phones that appears after the visitor scrolls past the hero,
// keeping the trial CTA one thumb-tap away for the rest of the page.
export function StickyMobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">Start your free trial</p>
              <p className="text-xs text-muted-foreground">3 days free, then $29.99/yr locked in</p>
            </div>
            <TrackedLink
              href="/go"
              event="cta_start_trial_clicked"
              params={{ location: "sticky_bar" }}
              className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25"
            >
              Start Free Trial
            </TrackedLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
