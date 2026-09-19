import { describe, expect, it } from "vitest";

import { doesAll, initialSelection, toggleSelection } from "@/components/booking/booking-selection";

/* Regras puras da seleção do wizard público: cards alternam, um barbeiro precisa fazer todos os
   serviços escolhidos e a URL (`?servico=`, `?profissional=`) só vale quando bate com o catálogo. */
const catalog = {
  services: [{ id: "corte" }, { id: "barba" }, { id: "sobrancelha" }],
  staff: [
    { id: "completo", serviceIds: ["corte", "barba", "sobrancelha"] },
    { id: "parcial", serviceIds: ["corte"] },
  ],
};

describe("doesAll", () => {
  it("only accepts a professional enabled for every chosen service", () => {
    expect(doesAll(catalog.staff[1]!, ["corte"])).toBe(true);
    expect(doesAll(catalog.staff[1]!, ["corte", "barba"])).toBe(false);
    expect(doesAll(catalog.staff[0]!, ["corte", "barba", "sobrancelha"])).toBe(true);
  });

  it("treats an empty selection as doable by anyone", () => {
    expect(doesAll(catalog.staff[1]!, [])).toBe(true);
  });
});

describe("toggleSelection", () => {
  it("adds a service that is not selected and removes one that is", () => {
    const added = toggleSelection({ serviceIds: ["corte"], staffId: "any" }, "barba", catalog);
    expect(added.serviceIds).toEqual(["corte", "barba"]);
    const removed = toggleSelection(added, "corte", catalog);
    expect(removed.serviceIds).toEqual(["barba"]);
  });

  it("keeps the chosen professional while they do every selected service", () => {
    const next = toggleSelection({ serviceIds: ["corte"], staffId: "completo" }, "barba", catalog);
    expect(next.staffId).toBe("completo");
  });

  it("resets the professional to any when they do not do a newly added service", () => {
    const next = toggleSelection({ serviceIds: ["corte"], staffId: "parcial" }, "barba", catalog);
    expect(next).toEqual({ serviceIds: ["corte", "barba"], staffId: "any" });
  });

  it("keeps any as it is", () => {
    expect(toggleSelection({ serviceIds: [], staffId: "any" }, "corte", catalog).staffId).toBe("any");
  });
});

describe("initialSelection", () => {
  it("starts empty without a ?servico= entry", () => {
    expect(initialSelection(catalog)).toEqual({ serviceIds: [], staffId: "any" });
  });

  it("preselects the ?servico= service when it exists in the catalog", () => {
    expect(initialSelection({ ...catalog, initialServiceId: "barba" })).toEqual({ serviceIds: ["barba"], staffId: "any" });
  });

  it("ignores an unknown or inactive ?servico= id (it is not in the public catalog)", () => {
    expect(initialSelection({ ...catalog, initialServiceId: "desativado" })).toEqual({ serviceIds: [], staffId: "any" });
  });

  it("keeps the ?profissional= only when they do the ?servico= service", () => {
    expect(initialSelection({ ...catalog, initialServiceId: "barba", initialStaffId: "completo" }).staffId).toBe("completo");
    expect(initialSelection({ ...catalog, initialServiceId: "barba", initialStaffId: "parcial" }).staffId).toBe("any");
    expect(initialSelection({ ...catalog, initialServiceId: "corte", initialStaffId: "parcial" }).staffId).toBe("parcial");
    expect(initialSelection({ ...catalog, initialStaffId: "desconhecido" }).staffId).toBe("any");
  });
});
