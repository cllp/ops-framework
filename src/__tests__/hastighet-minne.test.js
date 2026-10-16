import { afterEach, describe, expect, it } from "vitest";
import { HASTIGHET_NYCKEL, sparaHastighet, sparadHastighet } from "../lib/ljudspelare.js";

/* #375: spelaren kommer ihåg hastigheten per person och enhet, inte som en modulinställning. */
describe("spelarens hastighet sparas per enhet (#375)", () => {
  afterEach(() => localStorage.clear());
  it("utan sparat värde är det 1×", () => expect(sparadHastighet()).toBe(1));
  it("vald hastighet står kvar nästa gång", () => {
    sparaHastighet(1.5);
    expect(sparadHastighet()).toBe(1.5);
  });
  it("⛔ ett värde utanför listan blir 1× och sparas aldrig", () => {
    localStorage.setItem(HASTIGHET_NYCKEL, "7");
    expect(sparadHastighet()).toBe(1);
    sparaHastighet(3);
    expect(localStorage.getItem(HASTIGHET_NYCKEL)).toBe("7");
  });
});
