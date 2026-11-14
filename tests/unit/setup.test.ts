import { describe, expect, it } from "vitest";
import { doneSteps, nextStep, parseSkipped, pickChild, progress, requiredDone, STEPS, stepAfter, type ChildSetup, type SetupState } from "@/lib/setup/steps";

const kid = (over: Partial<ChildSetup> = {}): ChildSetup => ({ id: "k1", firstName: "Lou", hasFamily: false, hasHealth: false, hasContract: false, ...over });
const empty: SetupState = { profileDone: false, children: [] };

describe("mise en route : ordre et obligations", () => {
  it("garde l'ordre voulu : vous, enfant, parents, santé, contrat", () => {
    expect(STEPS.map((s) => s.id)).toEqual(["profil", "enfant", "famille", "sante", "contrat"]);
  });

  it("seuls l'enfant et le contrat sont obligatoires", () => {
    expect(STEPS.filter((s) => !s.optional).map((s) => s.id)).toEqual(["enfant", "contrat"]);
  });
});

describe("avancement déduit des données", () => {
  it("compte à zéro un compte vide et propose d'abord le profil", () => {
    const done = doneSteps(empty, null);
    expect(progress(done)).toEqual({ done: 0, total: 5 });
    expect(nextStep(done)).toBe("profil");
  });

  it("passe à l'enfant puis aux parents, à la santé, au contrat, dans l'ordre", () => {
    const k = kid();
    let state: SetupState = { profileDone: true, children: [k] };
    expect(nextStep(doneSteps(state, k))).toBe("famille");
    state = { profileDone: true, children: [{ ...k, hasFamily: true }] };
    expect(nextStep(doneSteps(state, state.children[0]))).toBe("sante");
    state = { profileDone: true, children: [{ ...k, hasFamily: true, hasHealth: true }] };
    expect(nextStep(doneSteps(state, state.children[0]))).toBe("contrat");
    state = { profileDone: true, children: [{ ...k, hasFamily: true, hasHealth: true, hasContract: true }] };
    const done = doneSteps(state, state.children[0]);
    expect(nextStep(done)).toBeNull();
    expect(progress(done)).toEqual({ done: 5, total: 5 });
    expect(requiredDone(done)).toBe(true);
  });

  it("une étape facultative passée ne bloque pas la suite, une étape obligatoire ne peut pas être passée", () => {
    const k = kid();
    const done = doneSteps({ profileDone: false, children: [k] }, k);
    expect(nextStep(done, ["profil", "famille", "sante"])).toBe("contrat");
    expect(parseSkipped("profil,enfant,contrat,inconnu, famille")).toEqual(["profil", "famille"]);
    expect(nextStep(doneSteps(empty, null), ["profil"])).toBe("enfant");
  });

  it("l'application est utilisable dès qu'un enfant et son contrat existent, même sans le reste", () => {
    const k = kid({ hasContract: true });
    expect(requiredDone(doneSteps({ profileDone: false, children: [k] }, k))).toBe(true);
    expect(requiredDone(doneSteps({ profileDone: true, children: [kid()] }, kid()))).toBe(false);
  });
});

describe("choix de l'enfant", () => {
  const a = kid({ id: "a", firstName: "Lou", hasFamily: true, hasHealth: true, hasContract: true });
  const b = kid({ id: "b", firstName: "Noa" });

  it("prend celui qu'on demande, sinon le premier à qui il manque une étape", () => {
    expect(pickChild([a, b], "a")?.id).toBe("a");
    expect(pickChild([a, b])?.id).toBe("b");
    expect(pickChild([a, b], "inconnu")?.id).toBe("b");
  });

  it("prend le dernier ajouté quand tout est fait, et rien sans enfant", () => {
    expect(pickChild([a, { ...a, id: "c" }])?.id).toBe("c");
    expect(pickChild([])).toBeNull();
  });

  it("donne l'étape suivante pour « Continuer »", () => {
    expect(stepAfter("profil")).toBe("enfant");
    expect(stepAfter("contrat")).toBeNull();
  });
});
