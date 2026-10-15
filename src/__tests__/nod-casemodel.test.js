import { describe, expect, it } from "vitest";
import * as nod from "../node/index.js";
import { createCaseModel } from "../index.js";

// ⛔ #279: servern bygger inkorgsrader med samma buildEntry som formuläret. Rött före: nodsidan exporterade inte createCaseModel.
describe("createCaseModel på nodsidan", () => {
  it("är samma funktion som huvudingångens", () => {
    expect(nod.createCaseModel).toBe(createCaseModel);
  });
});
