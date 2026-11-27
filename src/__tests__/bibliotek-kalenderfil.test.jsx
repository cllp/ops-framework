import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Kalender- och kontaktfiler i Biblioteket visas tolkade (0.269.0, cllp/lifehub.app#884 punkt 5), och annan JSON formaterad (punkt 6).
 * Röda före 0.269.0: en .ics och en .vcf hade ingen förhandsvisning, och JSON stod på en rad. ⛔ SYNTETISKA FILER.
 */
vi.mock("../components/OpsKarta.jsx", () => ({ OpsKarta: () => <div data-karta-stub="" /> }));

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const post = (/** @type {string} */ namn, /** @type {string} */ mime) => ({ ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Filen", fil: { sokvag: `g/a/${namn}`, namn, mime, byte: 100, klar: true }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "f1" });
const visa = (/** @type {any} */ p, /** @type {string} */ innehall) =>
  render(<OpsBibliotek poster={[p]} vald={p} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/x"} hamtaFil={vi.fn(async () => new Blob([innehall]))} />);

describe("kalender, kontakter och JSON i Biblioteket (#884)", () => {
  it("⛔ en .ics visar händelserna i en tabell, med Ladda ned under", async () => {
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Årsmöte\r\nDTSTART;TZID=Europe/Stockholm:20260315T180000\r\nLOCATION:Lokalen\r\nRRULE:FREQ=YEARLY\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const { container } = visa(post("inbjudan.ics", "text/calendar"), ics);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-kalenderfil=ics]")).not.toBeNull());
    const region = screen.getByRole("region", { name: "Innehållet i Filen" });
    expect(within(region).getByText("Årsmöte (återkommer)")).toBeInTheDocument();
    expect(within(region).getByText("2026-03-15")).toBeInTheDocument();
    expect(within(region).getByText("18:00")).toBeInTheDocument();
    expect(within(region).getByText("Lokalen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ladda ned" })).toBeInTheDocument();
  });

  it("⛔ en .vcf visar kontakterna, och numret och adressen är text, inte länkar", async () => {
    const vcf = "BEGIN:VCARD\r\nFN:Anna Andersson\r\nORG:Provbolaget AB\r\nTEL:+46 70 000 00 00\r\nEMAIL:anna@example.com\r\nEND:VCARD";
    const { container } = visa(post("anna.vcf", "text/vcard"), vcf);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-kalenderfil=vcf]")).not.toBeNull());
    const region = screen.getByRole("region", { name: "Innehållet i Filen" });
    expect(within(region).getByText("Anna Andersson")).toBeInTheDocument();
    expect(within(region).getByText("+46 70 000 00 00")).toBeInTheDocument();
    expect(within(region).getByText("anna@example.com")).toBeInTheDocument();
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
  });

  it("en .ics som inte är en kalender visas som text, med en rad som säger det", async () => {
    const { container } = visa(post("fel.ics", "text/calendar"), "Bara text.");
    await waitFor(() => expect(container.querySelector("[data-bibliotek-kalenderfil=text]")).not.toBeNull());
    expect(screen.getByText("Filen går inte att läsa som kalender, så den visas som text.")).toBeInTheDocument();
  });

  it("⛔ en .json som inte är en karta visas med indrag", async () => {
    const { container } = visa(post("data.json", "application/json"), '{"namn":"Ö","lista":[1,2]}');
    await waitFor(() => expect(container.querySelector("[data-bibliotek-text=klar]")).not.toBeNull());
    expect(container.querySelector("[data-bibliotek-text=klar]")?.textContent).toBe('{\n  "namn": "Ö",\n  "lista": [\n    1,\n    2\n  ]\n}');
  });
});
