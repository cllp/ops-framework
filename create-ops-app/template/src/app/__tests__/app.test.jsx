import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { App } from "../App.jsx";

/**
 * Röktest för hela skalet.
 *
 * ⛔ Det här testet ser trivialt ut och är det inte. Det är enda stället som
 * fångar de två fel som gör en nyuppsatt app obrukbar och som båda ger
 * felmeddelanden långt från sin orsak:
 *
 *   1. Två kopior av React (appen och ramverket). Varje hook kastar då
 *      "invalid hook call" utan att peka mot orsaken.
 *   2. Ramverkets bundle som inte går att importera.
 *
 * Båda är uppsättningsfel, inte kodfel, och båda hittas billigast här.
 */
describe("appskalet", () => {
  it("renderar översikten med ramverkets primitiver", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Översikt", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nytt ärende" })).toBeInTheDocument();
  });

  // ⛔ Frågan MÅSTE avgränsas till en av navigeringarna. Skalet renderar navet
  // två gånger, i toppraden och i bottenraden, och döljer den ena med CSS. I en
  // webbläsare är därför bara en i tillgänglighetsträdet, men i ett test finns
  // ingen CSS och båda syns. En ofrågad `getByRole("link", ...)` hittar då två
  // och kastar, vilket är precis vad som hände innan raderna fick egna namn.
  it("har en navigering där aktuell sida är utpekad för skärmläsare", () => {
    render(<App />);
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(toppnav).getByRole("link", { name: "Översikt", current: "page" })).toBeInTheDocument();
  });

  // Samma sida är utpekad i bottenraden, och raderna går att skilja åt.
  it("pekar ut samma sida i bottenraden, under ett eget namn", () => {
    render(<App />);
    const bottennav = screen.getByRole("navigation", { name: "Snabbnavigering" });
    expect(within(bottennav).getByRole("link", { name: "Översikt", current: "page" })).toBeInTheDocument();
  });
});
