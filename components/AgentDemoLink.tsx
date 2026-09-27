"use client";

import type { ReactNode } from "react";
import { AGENT_DEMO_URL } from "@/lib/agentOffer";
import { trackFunnel } from "@/lib/funnel";

type Props = {
  /** Where on the page the link sits, e.g. "hero" or "preview". */
  from: string;
  className?: string;
  children: ReactNode;
};

export default function AgentDemoLink({ from, className, children }: Props) {
  return (
    <a
      className={className}
      href={AGENT_DEMO_URL}
      target="_blank"
      rel="noopener"
      onClick={() => trackFunnel("demo_click", { label: from })}
    >
      {children}
    </a>
  );
}
