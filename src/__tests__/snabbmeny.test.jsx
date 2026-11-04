import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IKON_FOR } from "../components/ikonlexikon.js";
import { HubIkon, HandelsePlusIkon, KryssIkon, PlusIkon } from "../components/icons.jsx";
import { OpsSnabbmeny } from "../components/OpsSnabbmeny.jsx";
import { APP_IKON, SKAPA_SNABB_ORDNING, apparSnabbPoster, skapaSnabbPoster } from "../lib/snabbmeny.js";
import { arkRader } from "../lib/apparark.js";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

/**
 * Snabbmenyer (0.184.0).
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `skapaSnabbPoster` fanns inte, och ett skal utan `snabbmenyer` ritade arket med Ny grupp.
 * Med ändringen är de tre raderna Ny händelse, Nytt ärende, Nytt meddelande, och Appar öppnar menyn i stället för arket.
 */

const etiketter = { handelse: "Ny händelse", arende: "Nytt ärende", meddelande: "Nytt meddelande", grupp: "Ny grupp" };

describe("skapaSnabbPoster", () => {
  it("är arkets tre rader, i den ordningen, och bara de som finns", () => {
    expect(SKAPA_SNABB_ORDNING).toEqual(["handelse", "arende", "meddelande", "grupp"]);
    expect(skapaSnabbPoster({ handelse: true, arende: true, meddelande: true, grupp: true, etiketter }).map((p) => p.etikett)).toEqual([
      "Ny händelse",
      "Nytt ärende",
      "Nytt meddelande",
      "Ny grupp",
    ]);
    expect(skapaSnabbPoster({ handelse: true, arende: true, meddelande: true, grupp: true, etiketter }).map((p) => p.ikon)).toEqual([
      "handelse",
      "arende",
      "meddelande",
      "grupp",
    ]);
    expect(skapaSnabbPoster({ handelse: true, arende: true, etiketter }).map((p) => p.id)).toEqual(["handelse", "arende"]);
    expect(skapaSnabbPoster({ etiketter })).toEqual([]);
  });

  it("tar inte med projekt eller skapa app, och Ny grupp bara när mottagaren finns", () => {
    const utan = skapaSnabbPoster({ handelse: true, arende: true, meddelande: true, etiketter });
    expect(utan.map((p) => p.id)).not.toContain("grupp");
    expect(utan.map((p) => p.id)).not.toContain("nytt-projekt");
    expect(utan.map((p) => p.id)).not.toContain("skapa-app");
  });
});

describe("apparSnabbPoster", () => {
  it("följer arkets rader och slår upp inbyggda ikoner, utan att blanda in hubben", () => {
    const moduler = [
      { id: "meddelanden", namn: { sv: "Meddelanden", en: "Messages" }, hubb: { rutt: "/meddelanden", ikon: "m" } },
      { id: "ekonomi", namn: { sv: "Ekonomi", en: "Finance" }, hubb: { rutt: "/ekonomi", ikon: "e" } },
      { id: "datumomrostning", namn: { sv: "Datumomröstning", en: "Poll" }, hubb: null },
    ];
    const rader = arkRader({ moduler: ["meddelanden", "ekonomi"] }, moduler);
    expect(rader.map((r) => r.id)).toEqual(["meddelanden", "ekonomi"]);
    const poster = apparSnabbPoster(rader.map((r) => ({ id: r.id, href: r.href, etikett: r.namn.sv })));
    expect(poster.map((p) => p.etikett)).toEqual(["Meddelanden", "Ekonomi"]);
    expect(poster.map((p) => p.ikon)).toEqual([APP_IKON.meddelanden, APP_IKON.ekonomi]);
    expect(poster.map((p) => p.ikon)).toEqual(["meddelande", "ekonomi"]);
  });
});

describe("IKON_FOR för snabbmenyerna", () => {
  it("har en egen nyckel per bild appen redan ritar", () => {
    expect(IKON_FOR.handelse.displayName).toBe("CalendarPlus");
    expect(IKON_FOR.projekt.displayName).toBe("FolderKanban");
    expect(IKON_FOR.bokning.displayName).toBe("CalendarCheck");
    expect(IKON_FOR.bibliotek.displayName).toBe("Library");
    expect(IKON_FOR.ekonomi.displayName).toBe("Wallet");
    expect(IKON_FOR.laddaUpp.displayName).toBe("Upload");
    expect(IKON_FOR.appar.displayName).toBe("LayoutGrid");
    expect(IKON_FOR.stang.displayName).toBe("X");
    expect(IKON_FOR.skapa.displayName).toBe("Plus");
    expect(IKON_FOR.omrostning.displayName).toBe("Vote");
    expect(IKON_FOR.grupp.displayName).toBe("Users");
    const { container: handelse } = render(<HandelsePlusIkon />);
    const { container: plus } = render(<PlusIkon />);
    const { container: kryss } = render(<KryssIkon />);
    const { container: appar } = render(<HubIkon />);
    expect(handelse.querySelector(".lucide-calendar-plus")).not.toBeNull();
    expect(plus.querySelector(".lucide-plus")).not.toBeNull();
    expect(kryss.querySelector(".lucide-x")).not.toBeNull();
    expect(appar.querySelector(".lucide-layout-grid")).not.toBeNull();
  });
});

function meny(extra = {}) {
  const onValj = vi.fn();
  const onOppen = vi.fn();
  render(
    <>
      <button type="button" data-ops-skapa-knapp="">Skapa</button>
      <OpsSnabbmeny
        oppen
        onOppen={onOppen}
        variant="skapa"
        etikett="Skapa"
        ankare="[data-ops-skapa-knapp]"
        poster={[
          { id: "handelse", etikett: "Ny händelse", ikon: "handelse", onValj },
          { id: "arende", etikett: "Nytt ärende", ikon: "arende", onValj },
          { id: "meddelande", etikett: "Nytt meddelande", ikon: "meddelande", onValj },
        ]}
        {...extra}
      />
    </>,
  );
  return { onValj, onOppen };
}

describe("OpsSnabbmeny", () => {
  it("ritar skapa-kolumnen med etiketterna och stängs med Escape", async () => {
    const { onOppen } = meny();
    const dialog = screen.getByRole("dialog", { name: "Skapa" });
    expect(dialog.getAttribute("data-ops-snabbmeny")).toBe("skapa");
    expect(dialog.querySelector("[data-snabbmeny='skapa']")).not.toBeNull();
    const knappar = screen.getAllByRole("button", { name: /Ny händelse|Nytt ärende|Nytt meddelande/ });
    expect(knappar.map((k) => k.textContent)).toEqual(["Ny händelse", "Nytt ärende", "Nytt meddelande"]);
    expect(knappar[0].querySelector(".lucide-calendar-plus")).not.toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onOppen).toHaveBeenCalledWith(false));
  });

  it("stängs med bakåt", async () => {
    const { onOppen } = meny();
    expect(window.history.state?.opsSnabbmeny).toBe("skapa");
    window.history.back();
    await waitFor(() => expect(onOppen).toHaveBeenCalledWith(false));
  });

  it("appar har en pil mot knappen", () => {
    render(
      <>
        <button type="button" data-ops-appar-knapp="">Appar</button>
        <OpsSnabbmeny
          oppen
          onOppen={vi.fn()}
          variant="appar"
          etikett="Appar"
          ankare="[data-ops-appar-knapp]"
          poster={[{ id: "bibliotek", etikett: "Bibliotek", ikon: "bibliotek", onValj: vi.fn() }]}
        />
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Appar" }).querySelector("[data-snabbmeny-pil]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Bibliotek" }).querySelector(".lucide-library")).not.toBeNull();
  });
});

describe("skalet med snabbmenyer", () => {
  const inspelare = () => ({
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["a"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 1 })),
    kasta: vi.fn(),
    niva: () => 0,
  });

  it("plus öppnar de fyra raderna med Ny grupp sist, och Appar öppnar menyn", () => {
    render(
      <OpsAppShell
        brand="Ops"
        fasta={{ idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub", skapa: "skapa-app" } }}
        moduler={[]}
        activeHref="/idag"
        snabbmenyer
        talk={{ onTalk: vi.fn(), inspelare: inspelare() }}
        flytandeSkapa={["/idag"]}
        skapa={{
          handelse: () => null,
          arende: () => null,
          nyttMeddelande: () => {},
          grupp: () => null,
          lage: "g",
          registreringar: [{ id: "skapa-app", namn: { sv: "Skapa app" }, katalog: null, form: () => null }],
        }}
        apparArk={{
          moduler: [
            { id: "bibliotek", namn: { sv: "Bibliotek", en: "Library" }, hubb: { rutt: "/bibliotek", ikon: null, delar: [] } },
          ],
          grupp: { moduler: ["bibliotek"], huvudmeny: [] },
          farAndra: false,
        }}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(document.querySelector("[data-ops-flytande-skapa]"));
    const dialog = screen.getByRole("dialog", { name: "Skapa" });
    expect(withinNames(dialog)).toEqual(["Ny händelse", "Nytt ärende", "Nytt meddelande", "Ny grupp"]);
    expect(dialog.querySelector(".lucide-users")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Skapa app" })).toBeNull();
    expect(document.querySelector("[data-ops-flytande-skapa]").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(document.querySelector("[data-ops-appar-knapp]"));
    expect(screen.getByRole("dialog", { name: "Appar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bibliotek" })).toBeTruthy();
    expect(document.querySelector("[data-ops-flytande-skapa]")).toBeNull();
  });
});

/** @param {HTMLElement} rot */
function withinNames(rot) {
  return [...rot.querySelectorAll("button")].map((k) => k.textContent);
}
