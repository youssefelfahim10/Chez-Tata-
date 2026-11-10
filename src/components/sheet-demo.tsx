"use client";

import { SheetEditor } from "@/components/sheet-editor";
import type { SheetData } from "@/lib/sheet/compute";

const CHILDREN = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Janna (démo)" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Lou (démo)" },
];

/** Démonstration : données fictives, aucune écriture (l'enregistrement est simulé). */
export function SheetDemo({ month, childId }: { month: string; childId: string }) {
  const initial: SheetData = {
    month,
    childName: CHILDREN.find((c) => c.id === childId)?.name.replace(" (démo)", "") ?? "Janna",
    caregiverName: "TaTa Démo",
    contract: {
      startDate: "2026-09-01",
      schedule: "8h30-17h30",
      weeklyMinutes: 2400,
      monthlyMinutes: 10400,
      hourlyNetCents: 450,
      maintenanceCents: 350,
      mealCents: 400,
    },
    days:
      month === "2026-11"
        ? {
            2: { in: "08:30", out: "17:30", maintenance: true, meal: true },
            3: { in: "08:35", out: "17:20", maintenance: true, meal: true },
            4: { in: "09:00", out: "17:30", maintenance: true, meal: true, extraMinutes: 30 },
            5: { leave: "CP" },
            6: { in: "08:30", out: "12:30", absenceMinutes: 240, note: "Rendez-vous médecin" },
          }
        : {},
  };
  return (
    <SheetEditor
      key={`${childId}-${month}`}
      initial={initial}
      childId={childId}
      childrenList={CHILDREN}
      hasContract
      basePath="/apercu/planning"
      save={async () => ({ ok: true })}
    />
  );
}
