"use client";

import { useState } from "react";
import { reportOpenHouse, type Property } from "@/lib/api";
import type { OpenHouseRecord } from "@/lib/social";
import styles from "@/app/feed/page.module.css";

type ReportOpenHouseDialogProps = {
  reporting: { openHouse: OpenHouseRecord; property: Property | null } | null;
  onClose: () => void;
};

export default function ReportOpenHouseDialog({ reporting, onClose }: ReportOpenHouseDialogProps) {
  const [reportMessage, setReportMessage] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reporting) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="report-title">
      <form
        className={styles.modal}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!reportMessage.trim() || submittingReport) return;
          setSubmittingReport(true);
          setError(null);
          try {
            await reportOpenHouse({
              openHouseId: reporting.openHouse.id,
              propertyId: reporting.openHouse.propertyId || reporting.property?._id,
              address:
                reporting.property?.Address ||
                reporting.property?.address ||
                reporting.openHouse.address ||
                null,
              message: reportMessage.trim(),
            });
            setReportMessage("");
            onClose();
          } catch {
            setError("Could not send. Please try again.");
          } finally {
            setSubmittingReport(false);
          }
        }}
      >
        <h2 id="report-title">Report this listing</h2>
        <p>Tell us what’s wrong. We’ll look into it.</p>
        <textarea
          value={reportMessage}
          onChange={(event) => setReportMessage(event.target.value)}
          placeholder="What should we know?"
          required
        />
        {error ? <p>{error}</p> : null}
        <button type="submit" disabled={submittingReport || !reportMessage.trim()}>
          {submittingReport ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          className={styles.modalCancel}
          onClick={() => {
            setReportMessage("");
            onClose();
          }}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
