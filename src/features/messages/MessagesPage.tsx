import { useEffect, useState } from "react";
import { Card, PageTitle } from "../../components/ui";
import { formatLongDay } from "../../domain/dates";
import type { Audience } from "../../domain/releases";
import { markMessagesRead, releasesFor } from "../../lib/releases";
import { useAuth } from "../auth/AuthProvider";

// Athlete notes first, unlabelled; coach and admin notes under a named separator.
const GROUPS: { audience: Audience; label?: string }[] = [
  { audience: "athlete" },
  { audience: "coach", label: "Coach" },
  { audience: "admin", label: "Admin" },
];

export function MessagesPage() {
  const { profile, refreshProfile } = useAuth();
  const [releases] = useState(() => releasesFor(profile));
  useEffect(() => {
    void markMessagesRead(profile).then((changed) => {
      if (changed) void refreshProfile();
    });
  }, []);

  return (
    <>
      <PageTitle>Messages</PageTitle>
      <div className="flex flex-col gap-3">
        {releases.length === 0 && (
          <Card className="text-zinc-400">Aucun message.</Card>
        )}
        {releases.map((r) => (
          <Card key={r.version}>
            <details open={r.unread} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span>
                  <span className="block font-semibold">
                    Mise à jour {r.version}
                    {r.unread && (
                      <span className="ml-2 inline-block size-2 rounded-full bg-red-500 align-middle" />
                    )}
                  </span>
                  <span className="block text-xs text-zinc-500 first-letter:uppercase">
                    {formatLongDay(r.date)}
                  </span>
                </span>
                <span className="text-zinc-500 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              {GROUPS.map(({ audience, label }) => {
                const notes = r.notes.filter((n) => n.audience === audience);
                if (!notes.length) return null;
                return (
                  <div key={audience}>
                    {label && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                        {label}
                        <span className="h-px flex-1 bg-zinc-800" />
                      </div>
                    )}
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-300">
                      {notes.map((n) => (
                        <li key={n.text}>{n.text}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </details>
          </Card>
        ))}
      </div>
    </>
  );
}
