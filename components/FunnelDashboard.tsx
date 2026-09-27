"use client";

import { useMemo } from "react";
import { Chart, MetricCards, Ranked, type Metric } from "@/components/AnalyticsCharts";
import { formatDuration, rangeLength } from "@/lib/adminAnalytics";
import { AGENT_DEMO_URL } from "@/lib/agentOffer";
import {
  formatCents,
  funnelLabel,
  rate,
  type BreakdownRow,
  type Cohort,
  type FunnelSummary,
} from "@/lib/funnelAnalytics";
import styles from "@/components/AnalyticsDashboard.module.css";

const number = new Intl.NumberFormat("en-CA");
const decimal = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 });

function percent(value: number | null): string {
  return value === null ? "—" : `${decimal.format(value)}%`;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${decimal.format(hours)}h`;
  return `${decimal.format(hours / 24)}d`;
}

type Step = {
  key: keyof Pick<Cohort, "visitors" | "pricing" | "demo" | "checkout" | "purchased">;
  label: string;
  hint: string;
};

const STEPS: Step[] = [
  { key: "visitors", label: "Visited the page", hint: "First visit in this range" },
  { key: "pricing", label: "Saw the offer", hint: "Scrolled the price box into view" },
  { key: "demo", label: "Opened the demo", hint: "Clicked through to the example site" },
  { key: "checkout", label: "Started checkout", hint: "Reached Stripe Checkout" },
  { key: "purchased", label: "Bought", hint: "Stripe confirmed the subscription" },
];

function Funnel({ cohort, previous }: { cohort: Cohort; previous: Cohort }) {
  if (cohort.visitors === 0) {
    return <p className={styles.empty}>No one has visited the agent page in this range yet.</p>;
  }
  return (
    <ol className={styles.funnel}>
      {STEPS.map((step, index) => {
        const count = cohort[step.key];
        const share = rate(count, cohort.visitors) ?? 0;
        const before = index > 0 ? cohort[STEPS[index - 1].key] : null;
        const fromPrevious = before === null ? null : rate(count, before);
        const priorShare = rate(previous[step.key], previous.visitors);
        return (
          <li key={step.key} className={styles.funnelRow} title={step.hint}>
            <div className={styles.funnelLabel}>
              <span className={styles.funnelIndex}>{index + 1}</span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </span>
            </div>
            <div className={styles.funnelTrack}>
              <span
                className={styles.funnelFill}
                style={{ width: `${Math.max(share, count ? 1.5 : 0)}%` }}
              />
            </div>
            <div className={styles.funnelNumbers}>
              <strong>{number.format(count)}</strong>
              <span>{percent(share)} of visitors</span>
              {fromPrevious !== null ? (
                <span className={styles.funnelStep}>{percent(fromPrevious)} of prior step</span>
              ) : null}
              {index > 0 && priorShare !== null ? (
                <span className={styles.funnelPrior}>was {percent(priorShare)}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function BreakdownTable({ rows, empty }: { rows: BreakdownRow[]; empty: string }) {
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Visitors</th>
            <th scope="col">Opened demo</th>
            <th scope="col">Checkouts</th>
            <th scope="col">Sales</th>
            <th scope="col">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 15).map((row) => (
            <tr key={row.name}>
              <th scope="row">{funnelLabel(row.name)}</th>
              <td>{number.format(row.visitors)}</td>
              <td>
                {number.format(row.demo)} <small>{percent(rate(row.demo, row.visitors))}</small>
              </td>
              <td>{number.format(row.checkout)}</td>
              <td>
                <strong>{number.format(row.purchased)}</strong>
              </td>
              <td>{percent(rate(row.purchased, row.visitors))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

export default function FunnelDashboard({
  summary,
  priorLabel,
  priorShort,
}: {
  summary: FunnelSummary;
  priorLabel: string;
  priorShort: string;
}) {
  const { days, previousDays, totals, previous, cohort, previousCohort, currency } = summary;

  const metrics = useMemo<Metric[]>(() => {
    const money = (dollars: number) => formatCents(dollars * 100, currency);
    const abandoned = totals.checkoutStarts
      ? Math.max(0, totals.checkoutStarts - totals.purchases)
      : 0;
    return [
      {
        key: "visitors",
        label: "Page visitors",
        value: cohort.visitors,
        previous: previousCohort.visitors,
        note: "unique, first visit in range",
        hint: "People who landed on /for-agents for the first time in this range.",
        comparison: priorLabel,
        featured: true,
        series: days.map((day) => day.newVisitors),
      },
      {
        key: "sales",
        label: "Sales",
        value: totals.purchases,
        previous: previous.purchases,
        note: "new subscriptions",
        comparison: priorLabel,
        featured: true,
        series: days.map((day) => day.purchases),
      },
      {
        key: "conversion",
        label: "Visitor to sale",
        value: rate(cohort.purchased, cohort.visitors),
        previous: rate(previousCohort.purchased, previousCohort.visitors),
        note: `${number.format(cohort.purchased)}/${number.format(cohort.visitors)} visitors bought`,
        hint: "Share of this range's new visitors who have bought so far.",
        comparison: `${priorLabel}'s visitors`,
        changeMode: "points",
        format: (value: number) => `${decimal.format(value)}%`,
      },
      {
        key: "mrr",
        label: "Monthly recurring revenue",
        value: summary.mrrCents / 100,
        previous: null,
        note: `${number.format(summary.activeSubscribers)} active · ${number.format(
          summary.totalCustomers,
        )} all time`,
        hint: "List price of every active, trialing or past-due subscription, right now.",
        comparison: "now",
        format: money,
      },
      {
        key: "revenue",
        label: "Revenue collected",
        value: totals.revenueCents / 100,
        previous: previous.revenueCents / 100,
        note: `${number.format(totals.payments)} payments incl. renewals`,
        comparison: priorLabel,
        format: money,
        series: days.map((day) => day.revenueCents / 100),
      },
      {
        key: "checkouts",
        label: "Checkouts started",
        value: totals.checkoutStarts,
        previous: previous.checkoutStarts,
        note: totals.checkoutStarts
          ? `${number.format(abandoned)} did not finish · ${number.format(
              totals.checkoutCancels,
            )} came back`
          : "in range",
        hint: "Stripe Checkout sessions created. Came back counts people who pressed back on Stripe.",
        comparison: priorLabel,
        series: days.map((day) => day.checkoutStarts),
      },
      {
        key: "demo",
        label: "Demo opens",
        value: totals.demoClicks,
        previous: previous.demoClicks,
        note: `${percent(rate(cohort.demo, cohort.visitors))} of visitors`,
        comparison: priorLabel,
        series: days.map((day) => day.demoClicks),
      },
      {
        key: "views",
        label: "Page views",
        value: totals.views,
        previous: previous.views,
        note: "incl. return visits",
        comparison: priorLabel,
        series: days.map((day) => day.views),
      },
      {
        key: "time",
        label: "Time on page",
        value: totals.views ? totals.engagedSeconds / totals.views : 0,
        previous: previous.views ? previous.engagedSeconds / previous.views : 0,
        note: "per view, tab in focus",
        comparison: priorLabel,
        format: formatDuration,
        wide: true,
        series: days.map((day) => (day.views ? day.engagedSeconds / day.views : 0)),
      },
      {
        key: "perVisitor",
        label: "Revenue per visitor",
        value: cohort.visitors ? totals.revenueCents / 100 / cohort.visitors : 0,
        previous: previousCohort.visitors
          ? previous.revenueCents / 100 / previousCohort.visitors
          : 0,
        note: "what a visitor is worth today",
        hint: "Revenue collected in the range divided by new visitors. The most you can pay per click and break even on month one.",
        comparison: priorLabel,
        format: (dollars: number) => formatCents(dollars * 100, currency, 2),
        wide: true,
      },
      {
        key: "cancellations",
        label: "Cancellations",
        value: totals.cancellations,
        previous: previous.cancellations,
        note: "subscriptions ended",
        comparison: priorLabel,
        invert: true,
        series: days.map((day) => day.cancellations),
      },
      {
        key: "timeToBuy",
        label: "Time to buy",
        value: cohort.hoursToBuy,
        previous: previousCohort.hoursToBuy,
        note: `onboarded ${number.format(totals.onboardings)} of ${number.format(
          totals.purchases,
        )} sales`,
        hint: "Average time from first visit to purchase, for buyers who first visited in this range.",
        comparison: priorLabel,
        invert: true,
        format: formatHours,
      },
    ];
  }, [cohort, currency, days, previous, previousCohort, priorLabel, summary, totals]);

  const noDemoVisitors = cohort.visitors - cohort.demo;
  const noDemoPurchased = cohort.purchased - cohort.demoPurchased;
  const demoRate = rate(cohort.demoPurchased, cohort.demo);
  const noDemoRate = rate(noDemoPurchased, noDemoVisitors);
  const length = rangeLength(summary.range);

  return (
    <>
      <MetricCards metrics={metrics} />

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Funnel</h2>
          <p className={styles.panelNote}>
            {number.format(cohort.visitors)} people who first visited in the last{" "}
            {length === 1 ? "day" : `${length} days`}, and how far they got
            {summary.capped ? " (sampled)" : ""}
          </p>
        </div>
        <Funnel cohort={cohort} previous={previousCohort} />
        {cohort.demo > 0 && noDemoVisitors > 0 ? (
          <p className={styles.insight}>
            Visitors who opened the <a href={AGENT_DEMO_URL}>demo</a> bought at{" "}
            <strong>{percent(demoRate)}</strong>, against <strong>{percent(noDemoRate)}</strong> for
            those who did not.
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Traffic</h2>
          <p className={styles.panelNote}>
            {number.format(totals.views)} views from {number.format(totals.newVisitors)} new
            visitors
          </p>
        </div>
        <Chart
          days={days}
          series={[
            { label: "Views", values: days.map((day) => day.views) },
            { label: "New visitors", values: days.map((day) => day.newVisitors) },
          ]}
          comparison={{ label: `${priorShort} views`, values: previousDays.map((day) => day.views) }}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Checkouts and sales</h2>
          <p className={styles.panelNote}>
            {percent(rate(totals.purchases, totals.checkoutStarts))} of checkouts became a sale
          </p>
        </div>
        <Chart
          days={days}
          series={[
            { label: "Checkouts", values: days.map((day) => day.checkoutStarts) },
            { label: "Sales", values: days.map((day) => day.purchases) },
          ]}
          comparison={{
            label: `${priorShort} sales`,
            values: previousDays.map((day) => day.purchases),
          }}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Revenue</h2>
          <p className={styles.panelNote}>
            {formatCents(totals.revenueCents, currency)} collected ·{" "}
            {formatCents(summary.mrrCents, currency)} MRR
          </p>
        </div>
        <Chart
          days={days}
          series={[{ label: "Collected", values: days.map((day) => day.revenueCents / 100) }]}
          comparison={{
            label: priorShort,
            values: previousDays.map((day) => day.revenueCents / 100),
          }}
          format={(dollars) => formatCents(Math.round(dollars * 100), currency)}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Where buyers come from</h2>
          <p className={styles.panelNote}>
            First-touch source of this range&apos;s visitors. Tag links with ?utm_source=
          </p>
        </div>
        <BreakdownTable rows={summary.sources} empty="No visitors in this range yet." />
      </section>

      <div className={styles.panelGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Buttons clicked</h2>
            <p className={styles.panelNote}>Which call to action gets pressed</p>
          </div>
          <Ranked
            rows={summary.ctas.map((row) => ({ name: funnelLabel(row.name), value: row.value }))}
            total={totals.ctaClicks}
            empty="No checkout buttons pressed yet."
          />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Questions opened</h2>
            <p className={styles.panelNote}>The objections to answer higher up the page</p>
          </div>
          <Ranked
            rows={summary.faqs.map((row) => ({ name: funnelLabel(row.name), value: row.value }))}
            total={totals.faqOpens}
            empty="No questions opened yet."
          />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>How far people scroll</h2>
            <p className={styles.panelNote}>Share of page views reaching each depth</p>
          </div>
          <Ranked
            rows={summary.scroll.map((row) => ({ name: `${row.name}% down`, value: row.value }))}
            total={totals.views}
            empty="No scroll data yet."
          />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Devices</h2>
            <p className={styles.panelNote}>New visitors by device, with sales</p>
          </div>
          <Ranked
            rows={summary.devices.map((row) => ({
              name: `${funnelLabel(row.name)} · ${number.format(row.purchased)} sold`,
              value: row.visitors,
            }))}
            total={cohort.visitors}
            empty="No visitors in this range yet."
          />
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Latest customers</h2>
          <p className={styles.panelNote}>
            {number.format(summary.activeSubscribers)} active of{" "}
            {number.format(summary.totalCustomers)} all time
          </p>
        </div>
        {summary.recentCustomers.length === 0 ? (
          <p className={styles.empty}>No agent websites sold yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">Brokerage</th>
                  <th scope="col">Source</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Details</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <th scope="row">
                      {customer.name || "—"}
                      {customer.email ? (
                        <small>
                          <a href={`mailto:${customer.email}`}>{customer.email}</a>
                        </small>
                      ) : null}
                    </th>
                    <td>{customer.brokerage || "—"}</td>
                    <td>{funnelLabel(customer.source)}</td>
                    <td>{formatCents(customer.monthlyCents, customer.currency)}/mo</td>
                    <td>
                      <span
                        className={`${styles.pill} ${
                          customer.status === "active" || customer.status === "trialing"
                            ? styles.pillGood
                            : styles.pillBad
                        }`}
                      >
                        {STATUS_LABELS[customer.status] ?? customer.status}
                        {customer.cancelAtPeriodEnd ? " · ending" : ""}
                      </span>
                    </td>
                    <td>{customer.onboarded ? "Sent" : "Waiting"}</td>
                    <td>
                      {customer.createdAt
                        ? customer.createdAt.toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
