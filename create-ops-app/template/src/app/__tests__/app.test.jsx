import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("har en navigering där aktuell sida är utpekad för skärmläsare", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Översikt", current: "page" })).toBeInTheDocument();
  });
});
