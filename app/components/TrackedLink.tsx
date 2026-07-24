"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackCustom } from "@/lib/pixel/events";

type TrackedLinkProps = {
  href: string;
  event: string;
  params?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children" | "onClick">;

// Fires a Meta Pixel custom event on click, then lets navigation proceed as normal.
// Used on server-component pages (like the homepage) where CTAs need click tracking
// without converting the whole page to a client component.
export function TrackedLink({ href, event, params, className, children, ...rest }: TrackedLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackCustom(event, params)}
      {...rest}
    >
      {children}
    </a>
  );
}
