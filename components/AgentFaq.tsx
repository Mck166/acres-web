"use client";

import type { Faq } from "@/lib/agentOffer";
import { trackFunnel } from "@/lib/funnel";

type Props = {
  faqs: Faq[];
  listClassName?: string;
  itemClassName?: string;
  questionClassName?: string;
  answerClassName?: string;
};

// Which questions get opened is the objection list, so each open is tracked.
export default function AgentFaq({
  faqs,
  listClassName,
  itemClassName,
  questionClassName,
  answerClassName,
}: Props) {
  return (
    <div className={listClassName}>
      {faqs.map((faq) => (
        <details
          key={faq.id}
          className={itemClassName}
          onToggle={(event) => {
            if (event.currentTarget.open) trackFunnel("faq_open", { label: faq.id });
          }}
        >
          <summary className={questionClassName}>{faq.question}</summary>
          <p className={answerClassName}>{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
