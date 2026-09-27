/**
 * Everything the /for-agents sales page says lives here, so the offer can be
 * tuned without touching the page. Every promise below (the 7-day launch, the
 * guarantee, the build cap, each bonus) is shown to buyers as a commitment:
 * change the copy before changing what you are willing to deliver.
 */

export const AGENT_DEMO_URL =
  process.env.NEXT_PUBLIC_AGENT_DEMO_URL || "https://agent-template-coral.vercel.app";

export const OFFER = {
  name: "The 7-Day Agent Website",
  monthlyPrice: 199,
  currency: "CAD",
  launchDays: 7,
  refundDays: 30,
  /** Builds taken on per month. Shown as the reason spots are limited. */
  monthlyBuilds: 10,
  supportEmail: "hello@myacresapp.com",
} as const;

export type StackItem = {
  title: string;
  detail: string;
  /** What it would cost to get this elsewhere, as shown in the value stack. */
  value: number;
  /** Shown after the value, e.g. "/yr" for items valued per year. */
  valueNote?: string;
};

export const VALUE_STACK: StackItem[] = [
  {
    title: "A custom website, designed and built for you",
    detail:
      "Your name, photo, brokerage, colours, bio, service areas and reviews on a fast, modern site that looks like you paid an agency.",
    value: 2500,
  },
  {
    title: "Live listings on an interactive map",
    detail:
      "Every active Nova Scotia listing on your site, refreshed daily from Acres. Visitors search on your domain instead of leaving for someone else's.",
    value: 1200,
    valueNote: "/yr",
  },
  {
    title: "Lead capture on every page",
    detail:
      "Contact forms and showing requests go straight to your inbox, with the listing they were looking at attached.",
    value: 600,
  },
  {
    title: "Your own analytics dashboard",
    detail:
      "See how many people visited, which homes they looked at and how many became leads, so you know what your marketing is doing.",
    value: 588,
    valueNote: "/yr",
  },
  {
    title: "Hosting, SSL, security and updates",
    detail: "Fast worldwide hosting and a padlock in the browser bar. Nothing to install, patch or renew.",
    value: 360,
    valueNote: "/yr",
  },
  {
    title: "Unlimited edits by text or email",
    detail:
      "New headshot, new brokerage, new testimonial? Send it over and it is live within two business days.",
    value: 1800,
    valueNote: "/yr",
  },
];

export const BONUSES: StackItem[] = [
  {
    title: "Bonus: we write your copy",
    detail:
      "Send a few notes and we turn them into a bio and homepage that sound like you on your best day.",
    value: 500,
  },
  {
    title: "Bonus: link-in-bio setup for Instagram, TikTok and Facebook",
    detail:
      "Your site becomes the one link in every profile, with your socials featured on the homepage.",
    value: 300,
  },
  {
    title: "Bonus: featured agent profile in the Acres app",
    detail:
      "A verified profile in front of Acres home buyers, linked back to your site and your listings.",
    value: 500,
  },
  {
    title: "Bonus: custom domain connected for you",
    detail: "Already own janesellshalifax.ca? We connect it. Need one? We help you pick and set it up.",
    value: 150,
  },
];

export function stackTotal(items: StackItem[] = [...VALUE_STACK, ...BONUSES]): number {
  return items.reduce((total, item) => total + item.value, 0);
}

export const PAINS = [
  {
    title: "Your brokerage page is not a website",
    detail:
      "It is one of hundreds of identical profiles, and it sends your leads to the brokerage, not to you.",
  },
  {
    title: "Your socials rent attention, they do not own it",
    detail:
      "Followers watch your reels, then search listings somewhere else and call whoever answers first.",
  },
  {
    title: "DIY builders eat your weekends",
    detail:
      "Wix and Squarespace get you a template, but not listings, lead capture, or anyone to fix it when it breaks.",
  },
  {
    title: "Agencies want thousands up front",
    detail:
      "A custom site with live listings usually means $3,000 to $10,000 and a six-week project you have to manage.",
  },
];

export const FEATURES = [
  {
    title: "About you, front and centre",
    detail:
      "A homepage built around your story, your numbers and your reviews, with your socials one tap away.",
  },
  {
    title: "Search every listing without leaving",
    detail:
      "A full-screen map of active listings with price pins, filters and property pages with photos and details.",
  },
  {
    title: "Showing requests that come to you",
    detail:
      "Every property page has a request-a-showing button that lands in your inbox, not a call centre.",
  },
  {
    title: "Numbers you can act on",
    detail:
      "A private dashboard with visitors, property views, leads and where they came from, week over week.",
  },
  {
    title: "Built for phones first",
    detail:
      "Most buyers will find you on their phone from Instagram or TikTok. The whole site is designed for that.",
  },
  {
    title: "Yours in a week",
    detail:
      "Two minutes to check out, ten minutes to send your details, and your site is live within seven days.",
  },
];

export const STEPS = [
  {
    title: "Claim your spot",
    detail: "Check out securely with Stripe. Takes about two minutes.",
  },
  {
    title: "Send your details",
    detail:
      "A short form on the next page: headshot, brokerage, service areas and socials. About ten minutes.",
  },
  {
    title: "Go live in 7 days",
    detail:
      "We build, write and launch your site, then send you the link and walk you through your dashboard.",
  },
];

export type ComparisonRow = {
  label: string;
  brokerage: string;
  diy: string;
  agency: string;
  acres: string;
};

export const COMPARISON: ComparisonRow[] = [
  {
    label: "Up-front cost",
    brokerage: "$0",
    diy: "$0",
    agency: "$3,000+",
    acres: "$0",
  },
  {
    label: "Monthly cost",
    brokerage: "$0",
    diy: "$30 + your time",
    agency: "$100+ upkeep",
    acres: "$199",
  },
  {
    label: "Live listings map",
    brokerage: "Sometimes",
    diy: "No",
    agency: "Extra",
    acres: "Included",
  },
  {
    label: "Leads go to you",
    brokerage: "Often not",
    diy: "Yes",
    agency: "Yes",
    acres: "Yes",
  },
  {
    label: "Analytics you can read",
    brokerage: "No",
    diy: "Basic",
    agency: "Extra",
    acres: "Included",
  },
  {
    label: "Time to launch",
    brokerage: "Now",
    diy: "Weekends",
    agency: "4 to 8 weeks",
    acres: "7 days",
  },
  {
    label: "Someone to make changes",
    brokerage: "No",
    diy: "You",
    agency: "Billed hourly",
    acres: "Unlimited",
  },
];

export type Faq = {
  id: string;
  question: string;
  answer: string;
};

export const FAQS: Faq[] = [
  {
    id: "contract",
    question: "Is there a contract?",
    answer:
      "No. It is month to month and you can cancel anytime from the link in your receipt. Your price stays the same for as long as you stay.",
  },
  {
    id: "guarantee",
    question: "What if I do not like it?",
    answer: `Tell us within ${OFFER.refundDays} days of launch and we refund every dollar. If your site is not live within ${OFFER.launchDays} days of getting your details, your first month is free.`,
  },
  {
    id: "listings",
    question: "Where do the listings come from?",
    answer:
      "The same database that powers the Acres app and website, refreshed daily. It covers active listings across Nova Scotia.",
  },
  {
    id: "domain",
    question: "Can I use my own domain?",
    answer:
      "Yes. We connect a domain you already own, or help you choose and register a new one. Domain registration itself is billed by the registrar, usually about $20 a year.",
  },
  {
    id: "brokerage",
    question: "Will my brokerage allow it?",
    answer:
      "Your brokerage name, logo and licence details are on every page, which is what most brokerages ask for. If yours has specific rules, send them over and we will follow them.",
  },
  {
    id: "effort",
    question: "How much work is it for me?",
    answer:
      "About ten minutes to fill in the details form after checkout. We write the copy, build the site, and handle every change after that.",
  },
  {
    id: "leads",
    question: "Will it actually bring me leads?",
    answer:
      "The site turns the attention you already get from your socials, signs and referrals into contact requests you own. Your dashboard shows exactly how many visitors and leads it brings in, so you never have to guess.",
  },
  {
    id: "changes",
    question: "What counts as an edit?",
    answer:
      "Anything on your site: text, photos, testimonials, service areas, colours, brokerage details. Send it by text or email and it is live within two business days.",
  },
];

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-CA")}`;
}
