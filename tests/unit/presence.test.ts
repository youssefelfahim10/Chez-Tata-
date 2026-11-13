import { describe, expect, it } from "vitest";
import { presenceFromEvents } from "@/lib/tax/presence";

const ev = (child: string, type: string, iso: string) => ({ child_id: child, event_type: type, started_at: iso });

describe("présence d'après le journal", () => {
  it("additionne les passages arrivée → départ d'un même jour", () => {
    const r = presenceFromEvents([
      ev("c1", "arrival", "2025-03-03T07:00:00Z"),
      ev("c1", "departure", "2025-03-03T11:00:00Z"),
      ev("c1", "arrival", "2025-03-03T12:00:00Z"),
      ev("c1", "departure", "2025-03-03T16:30:00Z"),
    ]);
    expect(r.days).toEqual([{ childId: "c1", date: "2025-03-03", minutes: 510 }]);
    expect(r.incomplete).toBe(0);
  });

  it("sépare enfants et jours, dans l'ordre qu'on veut", () => {
    const r = presenceFromEvents([
      ev("c2", "departure", "2025-03-03T16:00:00Z"),
      ev("c2", "arrival", "2025-03-03T08:00:00Z"),
      ev("c1", "arrival", "2025-03-04T08:00:00Z"),
      ev("c1", "departure", "2025-03-04T09:30:00Z"),
    ]);
    expect(r.days).toHaveLength(2);
    expect(r.days.find((d) => d.childId === "c2")?.minutes).toBe(480);
    expect(r.days.find((d) => d.childId === "c1")?.minutes).toBe(90);
  });

  it("ne devine pas : arrivée sans départ n'est pas comptée mais signalée", () => {
    const r = presenceFromEvents([ev("c1", "arrival", "2025-03-03T08:00:00Z"), ev("c1", "meal", "2025-03-03T12:00:00Z")]);
    expect(r.days).toEqual([]);
    expect(r.incomplete).toBe(1);
  });

  it("utilise le jour de Paris (22 h UTC l'été = lendemain à Paris)", () => {
    const r = presenceFromEvents([ev("c1", "arrival", "2025-07-01T22:30:00Z"), ev("c1", "departure", "2025-07-01T23:30:00Z")]);
    expect(r.days[0].date).toBe("2025-07-02");
  });

  it("ignore les autres types de gestes", () => {
    expect(presenceFromEvents([ev("c1", "meal", "2025-03-03T08:00:00Z"), ev("c1", "nap", "2025-03-03T09:00:00Z")])).toEqual({ days: [], incomplete: 0 });
  });
});
