import type { Metadata } from "next";
import AgentFunnelTracker from "@/components/AgentFunnelTracker";
import AgentWelcome from "@/components/AgentWelcome";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Welcome aboard",
  description: "Send us your details and we will launch your agent website.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AgentWelcomePage(props: PageProps<"/for-agents/welcome">) {
  const query = await props.searchParams;
  const raw = query.session_id;
  const sessionId = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <div className={styles.page}>
      <AgentFunnelTracker page="welcome" />
      <AgentWelcome sessionId={sessionId} />
    </div>
  );
}
