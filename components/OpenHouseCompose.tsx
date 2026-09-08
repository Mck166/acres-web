"use client";

import { useMemo, useState } from "react";
import { createOpenHouse } from "@/lib/social";
import { resolvePostPid } from "@/lib/api";
import { defaultOpenHouseTimes } from "@/lib/openHouse";
import styles from "./OpenHouseCompose.module.css";

type Author = {
  uid: string;
  slug?: string;
  displayName?: string;
  profilePictureUrl?: string;
};

export default function OpenHouseCompose({
  author,
  onCreated,
}: {
  author: Author;
  onCreated?: () => void;
}) {
  const initial = useMemo(() => defaultOpenHouseTimes(), []);
  const [pid, setPid] = useState("");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        const cleanedPid = pid.trim();
        if (!cleanedPid) {
          setSuccess(null);
          setError("Enter the PID for the home you are showing.");
          return;
        }
        const startsAt = new Date(start);
        const endsAt = new Date(end);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
          setSuccess(null);
          setError("The open house needs to end after it starts.");
          return;
        }
        if (endsAt.getTime() <= Date.now()) {
          setSuccess(null);
          setError("Pick a future end time.");
          return;
        }
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
          const resolved = await resolvePostPid(cleanedPid);
          if (!resolved.found || !resolved.property?._id) {
            setError("We could not find that PID. Double-check it and try again.");
            return;
          }
          await createOpenHouse(author, {
            propertyId: String(resolved.property._id),
            pid: String(resolved.property.PID || cleanedPid),
            address: String(resolved.property.Address || resolved.property.address || ""),
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            notes,
          });
          setPid("");
          setNotes("");
          const nextTimes = defaultOpenHouseTimes();
          setStart(nextTimes.start);
          setEnd(nextTimes.end);
          setSuccess("Open house listed.");
          onCreated?.();
        } catch {
          setError("Could not list this open house. Please try again.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className={styles.field}>
        <span>Listing PID</span>
        <input
          value={pid}
          onChange={(event) => setPid(event.target.value)}
          placeholder="Required"
          autoCapitalize="off"
          autoCorrect="off"
          required
        />
      </label>
      <div className={styles.times}>
        <label className={styles.field}>
          <span>Starts</span>
          <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Ends</span>
          <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required />
        </label>
      </div>
      <label className={styles.field}>
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional — parking, entrance, refreshments"
        />
      </label>
      {error ? <p className={styles.error}>{error}</p> : null}
      {success ? <p className={styles.success}>{success}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? "Publishing…" : "List open house"}
      </button>
    </form>
  );
}
