"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { JournalEvent } from "@/lib/journal/day";
import { applyOpsWithArchive, enqueueOp, flushQueue, forScope, type Op, type SendResult } from "@/lib/offline/ops";
import { getOnline, getOnlineServer, queueStore, subscribeOnline } from "@/lib/offline/store";

export type SendFn = (input: { userId: string; orgId: string; op: Op }) => Promise<SendResult>;

type Params = {
  userId: string;
  orgId: string;
  serverEvents: JournalEvent[];
  /** Gestes annulés aujourd'hui (suppression logique côté serveur). */
  serverArchived?: JournalEvent[];
  send: SendFn;
  /** Appelé quand des opérations ont été envoyées : recharger les données du serveur. */
  onSynced: () => void;
  /** Démonstration : simule l'absence de réseau. */
  forceOffline?: boolean;
};

const NO_ARCHIVE: JournalEvent[] = [];

type Awaiting = { base: JournalEvent[] | null; ops: Op[] };

/**
 * Journal « hors ligne d'abord » : chaque geste est appliqué à l'écran tout de
 * suite, gardé sur l'appareil, puis envoyé dès que le réseau le permet.
 */
export function useJournalSync({ userId, orgId, serverEvents, serverArchived = NO_ARCHIVE, send, onSynced, forceOffline = false }: Params) {
  const queue = useSyncExternalStore(queueStore.subscribe, queueStore.get, queueStore.getServer);
  const browserOnline = useSyncExternalStore(subscribeOnline, getOnline, getOnlineServer);
  const online = browserOnline && !forceOffline;

  const [awaiting, setAwaiting] = useState<Awaiting>({ base: null, ops: [] });
  const [syncing, setSyncing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const onlineRef = useRef(online);
  const serverRef = useRef(serverEvents);
  useEffect(() => {
    onlineRef.current = online;
    serverRef.current = serverEvents;
  });

  const flush = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    if (!onlineRef.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      do {
        again.current = false;
        const mine = forScope(queueStore.get(), userId, orgId);
        if (mine.length === 0) break;
        const base = serverRef.current;
        const out = await flushQueue(mine, (item) => send({ userId: item.userId, orgId: item.orgId, op: item.op }));
        const done = new Set([...out.synced, ...out.rejected.map((r) => r.item)].map((i) => i.op.id));
        if (done.size) queueStore.set(queueStore.get().filter((q) => !(done.has(q.op.id) && q.userId === userId && q.orgId === orgId)));
        if (out.synced.length) {
          const ops = out.synced.map((i) => i.op);
          setAwaiting((a) => (a.base === base ? { base, ops: [...a.ops, ...ops] } : { base, ops }));
          onSynced();
        }
        if (out.rejected.length) setProblem(`Une saisie n’a pas pu être enregistrée : ${out.rejected[0].error}`);
        else if (out.stoppedBecause === "auth") setProblem("Session expirée : reconnectez-vous. Vos saisies sont conservées sur ce téléphone.");
        else if (out.stoppedBecause === "space") setProblem("Ces saisies concernent un autre espace : revenez sur l’espace concerné pour les envoyer.");
        else if (out.remaining.length === 0) setProblem(null);
      } while (again.current);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [onSynced, orgId, send, userId]);

  // Envoi au chargement, au retour du réseau, au retour sur l'appli, puis régulièrement.
  useEffect(() => {
    if (online) void flush();
    const visible = () => document.visibilityState === "visible" && void flush();
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(() => void flush(), 15_000);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [flush, online]);

  const submit = useCallback(
    (op: Op) => {
      queueStore.set(enqueueOp(queueStore.get(), { op, userId, orgId, queuedAt: new Date().toISOString() }));
      void flush();
    },
    [flush, orgId, userId],
  );

  const mine = useMemo(() => forScope(queue, userId, orgId), [queue, userId, orgId]);
  // Les opérations déjà envoyées restent appliquées jusqu'à ce que le serveur renvoie ses données.
  const { events, archived } = useMemo(
    () => applyOpsWithArchive(serverEvents, serverArchived, [...(awaiting.base === serverEvents ? awaiting.ops : []), ...mine.map((q) => q.op)]),
    [serverEvents, serverArchived, awaiting, mine],
  );

  return { events, archived, pending: mine.length, online, syncing, problem, clearProblem: () => setProblem(null), submit, flush };
}
