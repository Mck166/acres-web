"use client";

import { useEffect, useState } from "react";

export default function AssistantReturnPage() {
  const [cancelled, setCancelled] = useState(false);
  const [appUrl, setAppUrl] = useState("acres://account");

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("result");
    const nextCancelled = result === "cancel";
    setCancelled(nextCancelled);
    setAppUrl(`acres://account?assistant=${nextCancelled ? "cancel" : "success"}`);
  }, []);

  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <section style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, lineHeight: 1.2, marginBottom: 12 }}>
          {cancelled ? "No charge was made" : "You're subscribed"}
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 24 }}>
          {cancelled
            ? "You can pick this up again in the Acres app whenever you want."
            : "Open Acres to keep looking. Your extra searches will be waiting there."}
        </p>
        <a
          href={appUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            padding: "0 22px",
            borderRadius: 14,
            background: "#5B9279",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open Acres
        </a>
      </section>
    </main>
  );
}
