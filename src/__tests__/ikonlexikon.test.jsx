import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IKON_FOR } from "../index.js";
import { ArendePlusIkon, GruppvalIkon, KugghjulIkon, ReglageIkon, SkarmIkon } from "../components/icons.jsx";
import { PlatsValjare } from "../components/OpsBibliotek.jsx";

/**
 * ⛔ Designgenomgången 2026-11-04 (cllp/lifehub.app#634): skjutreglaget betydde filter, Inställningar och platsväljaren i
 * Biblioteket, och `Inbox` betydde både Inkorgen och Ärenden. Proven mäter vad som RITAS (lucides klassnamn på svg:n),
 * inte vilket namn som står i källan.
 */
/** @param {Element | null} el */
const lucideKlass = (el) => [...(el?.querySelector("svg")?.classList ?? [])].find((k) => k.startsWith("lucide-")) ?? null;

describe("IKON_FOR (cllp/lifehub.app#634)", () => {
  it("är exporterad ur paketets index, fryst, och har minst tio betydelser", () => {
    expect(Object.isFrozen(IKON_FOR)).toBe(true);
    expect(Object.keys(IKON_FOR).length).toBeGreaterThanOrEqual(10);
  });

  it("omslagen i icons.jsx ritar kartans ikon för sin betydelse", () => {
    const { container: kugg } = render(<KugghjulIkon />);
    const { container: reglage } = render(<ReglageIkon />);
    const { container: skarm } = render(<SkarmIkon />);
    expect(lucideKlass(kugg)).toBe("lucide-settings");
    expect(lucideKlass(reglage)).toBe("lucide-sliders-horizontal");
    expect(lucideKlass(skarm)).toBe("lucide-monitor");
  });

  it("ett ärende ritas med ListChecks, inte med Inkorgens låda", () => {
    const { container: arende } = render(<ArendePlusIkon />);
    const { container: inkorg } = render(<IKON_FOR.inkorg />);
    expect(lucideKlass(arende)).toBe("lucide-list-checks");
    expect(lucideKlass(inkorg)).toBe("lucide-inbox");
  });

  it("platsväljaren i Biblioteket ritar väljarens ikon, inte filtrets skjutreglage", () => {
    render(<PlatsValjare platser={[{ id: "a", namn: "Ett" }, { id: "b", namn: "Två" }]} plats="a" onPlats={() => {}} />);
    const knapp = screen.getByRole("button", { name: "Vilket bibliotek: Ett" });
    expect(knapp.querySelector(".lucide-sliders-horizontal")).toBeNull();
    expect(knapp.querySelector(".lucide-chevrons-up-down")).not.toBeNull();
    const { container } = render(<GruppvalIkon />);
    expect(lucideKlass(container)).toBe("lucide-chevrons-up-down");
  });
});
