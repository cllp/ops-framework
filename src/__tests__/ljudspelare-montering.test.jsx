import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { OpsLjudspelare } from "../components/OpsLjudspelare.jsx";
import { nollstallSpelare } from "../lib/ljudspelare.js";

/*
 * ⛔ ETT TRYCK FÖRE SPELARENS MONTERINGSEFFEKT FÅR INTE TAPPAS (cllp/ops-framework#579, mätt i cllp/lifehub.app#772).
 *
 * Effekten som kopplar `<audio>`-lyssnarna och nollställer "någon har tryckt spela" (`begart`) var en vanlig `useEffect`. När
 * adressen kommer efter ett löfte (`hamtaAdress`, eller en delad lista som hämtats) är ritningen en vanlig uppdatering, och
 * effekten körs i en senare uppgift än den som satte spelaren i DOM. Ett tryck i glappet startade uppspelningen, sedan körde
 * React den väntande effekten, och den satte `begart` till falskt igen. Ett fel från filen (en adress som gått ut) räknades
 * då inte som begärt: inget `onFel`, ingen ny adress, ingen text. Ett fel före effekten nådde inte ens någon lyssnare.
 *
 * Provet lägger trycket och felet exakt i det glappet: direkt när `<audio>` syns i DOM, i samma mikrouppgift som
 * MutationObserver, före nästa makrouppgift. Rött med `useEffect` (onFel anropas aldrig), grönt med `useLayoutEffect`.
 */

beforeEach(() => {
  nollstallSpelare();
  HTMLMediaElement.prototype.load = function load() {};
  HTMLMediaElement.prototype.pause = function pause() {};
  HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve();
  };
  // Vågen hämtas med `fetch`, och i jsdom finns inget ljud att läsa. Ett avvisat svar ger den platta vågen.
  globalThis.fetch = () => Promise.reject(new TypeError("inget ljud i jsdom"));
});

afterEach(() => {
  cleanup();
});

it("ett tryck och ett fel innan monteringseffekten körts når onFel (#579)", async () => {
  /** @type {string[]} */
  const fel = [];
  let los = /** @type {(url: string) => void} */ (() => {});
  const hamtaAdress = () =>
    new Promise((resolve) => {
      los = resolve;
    });
  const synlig = new Promise((klar) => {
    const mo = new MutationObserver(() => {
      if (document.querySelector("audio")) {
        mo.disconnect();
        klar(undefined);
      }
    });
    mo.observe(document.body, { subtree: true, childList: true });
  });
  render(
    <OpsLjudspelare
      sokvag="grupper/my/a.webm"
      hamtaAdress={hamtaAdress}
      namn="Idé"
      durationMs={95000}
      onFel={(f) => {
        if (f) fel.push(f);
      }}
    />,
  );
  // ⛔ Som i webbläsaren: adressen kommer utan `act`, så React schemalägger ritningen och effekterna själv. Med `act` hade
  // effekterna körts innan provet fick tillbaka kontrollen, och glappet hade inte funnits.
  const forra = /** @type {any} */ (globalThis).IS_REACT_ACT_ENVIRONMENT;
  /** @type {any} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = false;
  try {
    los("https://exempel.se/grupper/my/a.webm");
    await synlig;
  } finally {
    /** @type {any} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = forra;
  }
  fireEvent.click(screen.getByRole("button", { name: "Spela Idé" }));
  fireEvent.error(/** @type {Element} */ (document.querySelector("audio")));
  expect(fel).toEqual(["Ljudet gick inte att spela."]);
});
