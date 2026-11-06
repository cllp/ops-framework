// ⛔ EN KOMPAKT RAD I BIBLIOTEKET (0.165.0). CP 2026-10-31: "html-filernas listning i bibliotek lite ful och rörig".
// Titeln utan filändelse, en grå rad "HTML · 68 kB · 2026-10-31 10:00" (tidsstämpel sedan 0.194.0), och ingen "Lägg till tagg" på ett kort utan taggar.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { OpsBibliotek, byggPost } from "../index.js";
import { kortTidpunkt, kortRubrik, kortTyp } from "../components/OpsBibliotek.jsx";

const s = { uid: "uid-1", namn: "CP", typ: "manniska", kalla: "bibliotek" };
const tid = new Date(2026, 9, 31, 10).getTime();
const html = (id, rubrik, taggar) => ({ ...byggPost({ groupId: "g", typ: "fil", rubrik, fil: { sokvag: `grupper/g/bibliotek/${id}/${rubrik}`, namn: "sang-v1.html", mime: "text/html", byte: 69632 }, taggar, skapadAv: s, skapad: tid, andrad: tid }), id });

describe("⛔ kompakt rad i Biblioteket", () => {
  it("rubriken tappar filens ändelse bara när rubriken är filens namn", () => {
    expect(kortRubrik({ typ: "fil", rubrik: "sang-v1.html", fil: { namn: "sang-v1.html" } })).toBe("sang-v1");
    expect(kortRubrik({ typ: "fil", rubrik: "Rapport.PDF", fil: { namn: "x.pdf" } })).toBe("Rapport");
    expect(kortRubrik({ typ: "fil", rubrik: "Version 1.2", fil: { namn: "x.pdf" } })).toBe("Version 1.2");
    expect(kortRubrik({ typ: "anteckning", rubrik: "a.html" })).toBe("a.html");
    expect(kortRubrik({ typ: "fil", rubrik: ".html", fil: { namn: ".html" } })).toBe(".html");
  });
  // ⛔ 0.194.0: kortet bär tidsstämpeln och inte bara datumet (CP 2026-11-06: "Även dokument finns bara datum på. Det räcker inte.").
  // Förut "31 okt." i år och "31 okt. 2025" ett annat år.
  it("typen är ändelsen för ett dokument och tiden är en tidsstämpel i svensk tid", () => {
    expect(kortTyp({ typ: "fil", fil: { namn: "a.html", mime: "text/html" } })).toBe("HTML");
    expect(kortTidpunkt(Date.UTC(2026, 9, 31, 9, 7))).toBe("2026-10-31 10:07");
    expect(kortTidpunkt(Date.UTC(2025, 9, 31, 9, 7))).toBe("2025-10-31 10:07");
    expect(kortTidpunkt(undefined)).toBe("");
  });
  it("kortet är en rad: titel, och HTML · 68 kB · datum; ingen taggrad utan taggar", () => {
    render(<OpsBibliotek poster={[html("a", "sang-v1.html"), html("b", "ide.html", ["musik"])]} jag={{ uid: "uid-1", roll: "admin" }} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/" />);
    const kort = [...document.querySelectorAll("[data-bibliotek-kort]")];
    const a = kort.find((k) => k.textContent?.includes("sang-v1"));
    const b = kort.find((k) => k.textContent?.includes("ide"));
    expect(a?.querySelector("[data-bibliotek-metarad]")?.textContent).toMatch(/^HTML·68 kB·\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(a?.textContent).not.toContain(".html");
    expect(a?.querySelector("[data-bibliotek-taggar]")).toBeNull();
    expect(b?.querySelector("[data-bibliotek-taggar]")).not.toBeNull();
  });
});
