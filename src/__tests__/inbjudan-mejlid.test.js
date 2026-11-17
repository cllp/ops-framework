import { describe, expect, it } from "vitest";
import { INBJUDNINGSFALT, byggInbjudan } from "../lib/grupp.js";

/**
 * ⛔ HÄNDELSEN (0.234.0). CP 2026-11-16: "Inbjudan status, om den inte har svarat." och "vi måste kunna läsa mailkön". Appen sparar `mejlId` på en inbjudan, en
 * referens till köns rad i `mejl` (null innan brevet köats). Ramverkets fältlista kände inte fältet, så `byggInbjudan` avvisade varje sådan rad.
 */

const RAD = { id: "i1", epost: "Collan@Exempel.se", groupId: "g", roll: "medlem", skapadAv: { uid: "u1", namn: "Kim", typ: "manniska", kalla: "bjud-in" } };

describe("⛔ mejlId på en inbjudan", () => {
  it("en rad med mejlId som sträng eller null godkänns, och fältet följer med", () => {
    expect(INBJUDNINGSFALT).toContain("mejlId");
    expect(byggInbjudan({ ...RAD, mejlId: "mejl-abc" }).mejlId).toBe("mejl-abc");
    expect(byggInbjudan({ ...RAD, mejlId: null }).mejlId).toBeNull();
  });

  it("en rad utan fältet byggs som förut, och ett felaktigt värde kastar", () => {
    expect("mejlId" in byggInbjudan(RAD)).toBe(false);
    expect(() => byggInbjudan({ ...RAD, mejlId: 5 })).toThrow(/mejlId/);
    expect(() => byggInbjudan({ ...RAD, mejlId: "" })).toThrow(/mejlId/);
  });

  it("ett okänt fält avvisas fortfarande", () => {
    expect(() => byggInbjudan({ ...RAD, mejlStatus: "skickad" })).toThrow(/mejlStatus/);
  });
});
