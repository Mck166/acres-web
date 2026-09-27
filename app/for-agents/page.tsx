import type { Metadata } from "next";
import AgentCheckoutButton from "@/components/AgentCheckoutButton";
import AgentDemoLink from "@/components/AgentDemoLink";
import AgentFaq from "@/components/AgentFaq";
import AgentFunnelTracker from "@/components/AgentFunnelTracker";
import {
  AGENT_DEMO_URL,
  BONUSES,
  COMPARISON,
  FAQS,
  FEATURES,
  OFFER,
  PAINS,
  STEPS,
  VALUE_STACK,
  formatMoney,
  stackTotal,
  type StackItem,
} from "@/lib/agentOffer";
import styles from "./page.module.css";

const PRICE = `${formatMoney(OFFER.monthlyPrice)}/month`;
const PER_DAY = Math.ceil(OFFER.monthlyPrice / 30);
const TOTAL = stackTotal();

export const metadata: Metadata = {
  title: "Agent websites",
  description: `A done-for-you real estate agent website with live Nova Scotia listings, lead capture and analytics. Live in ${OFFER.launchDays} days for ${PRICE}.`,
  alternates: { canonical: "/for-agents" },
  openGraph: {
    title: `${OFFER.name} | Acres`,
    description: `Your own agent website with live listings and lead capture, built for you and live in ${OFFER.launchDays} days.`,
  },
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.check}>
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.16" />
      <path
        d="M6 10.4l2.6 2.6L14 7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StackRow({ item }: { item: StackItem }) {
  return (
    <li className={styles.stackRow}>
      <CheckIcon />
      <div className={styles.stackCopy}>
        <h3>{item.title}</h3>
        <p>{item.detail}</p>
      </div>
      <span className={styles.stackValue}>
        {formatMoney(item.value)}
        {item.valueNote ? <small>{item.valueNote}</small> : null}
      </span>
    </li>
  );
}

export default function ForAgentsPage() {
  return (
    <div className={styles.page}>
      <AgentFunnelTracker page="landing" pricingId="offer" />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>For Nova Scotia real estate agents</p>
          <h1>
            Get a website that turns your followers into clients.{" "}
            <span className={styles.highlight}>Built for you, live in {OFFER.launchDays} days.</span>
          </h1>
          <p className={styles.lead}>
            A done-for-you agent website with every active listing on a live map, showing requests
            sent straight to you, and a dashboard that shows exactly what it brings in. No setup
            fee. No contract. If it is not live in {OFFER.launchDays} days, your first month is free.
          </p>
          <div className={styles.heroActions}>
            <AgentCheckoutButton
              cta="hero"
              label="Claim my website"
              sublabel={`${PRICE} · cancel anytime`}
              size="large"
            />
            <AgentDemoLink from="hero" className={styles.demoButton}>
              See a live example site <span aria-hidden="true">→</span>
            </AgentDemoLink>
          </div>
          <ul className={styles.trust}>
            <li>
              <CheckIcon /> Live in {OFFER.launchDays} days or month one is free
            </li>
            <li>
              <CheckIcon /> {OFFER.refundDays}-day money-back guarantee
            </li>
            <li>
              <CheckIcon /> Only {OFFER.monthlyBuilds} new builds a month
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.section} id="demo" aria-labelledby="demo-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>See it first</p>
          <h2 id="demo-heading">Click around a real one before you pay a cent.</h2>
          <p>
            This is the exact site you get, with an example agent. Search the map, open a listing,
            request a showing. Yours looks like this with your name, photo, brokerage and colours.
          </p>
        </div>
        <div className={styles.browser}>
          <div className={styles.browserBar} aria-hidden="true">
            <span />
            <span />
            <span />
            <p>{AGENT_DEMO_URL.replace(/^https?:\/\//, "")}</p>
          </div>
          <iframe
            className={styles.browserFrame}
            src={AGENT_DEMO_URL}
            title="Example agent website"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
        <div className={styles.center}>
          <AgentDemoLink from="preview" className={styles.demoButtonDark}>
            Open the example site in a new tab <span aria-hidden="true">↗</span>
          </AgentDemoLink>
        </div>
      </section>

      <section className={styles.sectionTinted} aria-labelledby="pain-heading">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>The problem</p>
            <h2 id="pain-heading">You are paying for attention, then sending it somewhere else.</h2>
            <p>
              Every reel, open house and sign brings people looking for you. Most of them end up on a
              page you do not own.
            </p>
          </div>
          <div className={styles.painGrid}>
            {PAINS.map((pain) => (
              <article key={pain.title} className={styles.pain}>
                <h3>{pain.title}</h3>
                <p>{pain.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="features-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>What your site does</p>
          <h2 id="features-heading">Everything a top producer&apos;s site has. None of the work.</h2>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature, index) => (
            <article key={feature.title} className={styles.feature}>
              <span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{feature.title}</h3>
              <p>{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.offer} id="offer" aria-labelledby="offer-heading">
        <div className={styles.offerCard}>
          <div className={styles.offerHead}>
            <p className={styles.kickerLight}>{OFFER.name}</p>
            <h2 id="offer-heading">Here is everything you get.</h2>
          </div>

          <ul className={styles.stack}>
            {VALUE_STACK.map((item) => (
              <StackRow key={item.title} item={item} />
            ))}
          </ul>

          <p className={styles.bonusLabel}>Plus, when you join this month</p>
          <ul className={`${styles.stack} ${styles.bonusStack}`}>
            {BONUSES.map((item) => (
              <StackRow key={item.title} item={item} />
            ))}
          </ul>

          <div className={styles.priceBox}>
            <div className={styles.priceTotals}>
              <p>
                First-year value if you bought it all separately{" "}
                <strong>{formatMoney(TOTAL)}</strong>
              </p>
              <p>
                Setup fee <strong>$0</strong>
              </p>
            </div>
            <p className={styles.priceToday}>Your price today</p>
            <p className={styles.price}>
              {formatMoney(OFFER.monthlyPrice)}
              <span>/month {OFFER.currency}</span>
            </p>
            <p className={styles.priceNote}>
              Less than ${PER_DAY} a day. One extra closing pays for years of it. Your price is locked
              for as long as you stay.
            </p>
            <AgentCheckoutButton
              cta="offer"
              label="Claim my website"
              sublabel="Secure checkout with Stripe"
              size="large"
              className={styles.offerButton}
            />
            <p className={styles.scarcity}>
              We take on {OFFER.monthlyBuilds} new sites a month so every one launches on time. When
              this month&apos;s builds are full, new sites start next month.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="guarantee-heading">
        <div className={styles.guarantee}>
          <div className={styles.seal} aria-hidden="true">
            <span>{OFFER.refundDays}</span>
            <small>day</small>
          </div>
          <div>
            <p className={styles.kicker}>Zero risk</p>
            <h2 id="guarantee-heading">The double guarantee.</h2>
            <p>
              <strong>Live in {OFFER.launchDays} days or your first month is free.</strong> The clock
              starts when you send your details.
            </p>
            <p>
              <strong>Love it or get every dollar back.</strong> If you are not happy within{" "}
              {OFFER.refundDays} days of launch, email us and we refund you in full. No forms, no
              questions, no hard feelings.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.sectionTinted} aria-labelledby="steps-heading">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>How it works</p>
            <h2 id="steps-heading">Three steps. About twelve minutes of your time.</h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="compare-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>Compare</p>
          <h2 id="compare-heading">The math is not close.</h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col">Brokerage page</th>
                <th scope="col">DIY builder</th>
                <th scope="col">Agency</th>
                <th scope="col" className={styles.tableAcres}>
                  Acres
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.brokerage}</td>
                  <td>{row.diy}</td>
                  <td>{row.agency}</td>
                  <td className={styles.tableAcres}>{row.acres}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>Questions</p>
          <h2 id="faq-heading">Straight answers.</h2>
        </div>
        <AgentFaq
          faqs={FAQS}
          listClassName={styles.faqs}
          itemClassName={styles.faq}
          questionClassName={styles.faqQuestion}
          answerClassName={styles.faqAnswer}
        />
        <p className={styles.faqMore}>
          Something else? Email{" "}
          <a href={`mailto:${OFFER.supportEmail}?subject=Agent%20website%20question`}>
            {OFFER.supportEmail}
          </a>{" "}
          and you will hear back the same day.
        </p>
      </section>

      <section className={styles.final} aria-labelledby="final-heading">
        <h2 id="final-heading">
          You can keep sending buyers to someone else&apos;s website. Or you can own the one they
          land on.
        </h2>
        <p>
          {PRICE}. Live in {OFFER.launchDays} days. {OFFER.refundDays}-day money-back guarantee.
        </p>
        <div className={styles.finalActions}>
          <AgentCheckoutButton cta="final" label="Claim my website" size="large" />
          <AgentDemoLink from="final" className={styles.demoButton}>
            See the example first <span aria-hidden="true">→</span>
          </AgentDemoLink>
        </div>
      </section>

      <div className={styles.stickyBar}>
        <div className={styles.stickyCopy}>
          <strong>{PRICE}</strong>
          <span>Live in {OFFER.launchDays} days</span>
        </div>
        <AgentCheckoutButton cta="sticky" label="Claim my site" className={styles.stickyButton} />
      </div>
    </div>
  );
}
