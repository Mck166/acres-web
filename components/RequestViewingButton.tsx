"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createScheduledViewing, type Property } from "@/lib/api";
import { getUserData } from "@/lib/firestore";
import styles from "./RequestViewingButton.module.css";

export default function RequestViewingButton({ property }: { property: Property }) {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState(["", "", ""]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserData(user.uid).then((profile) => setConfirmed(Boolean(profile?.confirmedAgentId)));
  }, [user]);

  if (!user || !confirmed) return null;

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={() => setOpen((value) => !value)}>
        Request a viewing
      </button>
      {open ? (
        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            const iso = slots.map((value) => new Date(value.replace(" ", "T")).toISOString());
            if (iso.some((value) => Number.isNaN(new Date(value).getTime()))) {
              setStatus("Enter three valid times.");
              return;
            }
            await createScheduledViewing({
              propertyId: property._id,
              slots: iso,
              address: String(property.Address || property.address || ""),
            });
            setStatus("Sent to your agent.");
            setOpen(false);
          }}
        >
          {slots.map((value, index) => (
            <input
              key={index}
              value={value}
              onChange={(event) => {
                const next = [...slots];
                next[index] = event.target.value;
                setSlots(next);
              }}
              placeholder={`Option ${index + 1} (YYYY-MM-DD HH:MM)`}
            />
          ))}
          <button type="submit">Send to my agent</button>
        </form>
      ) : null}
      {status ? <p>{status}</p> : null}
    </div>
  );
}
