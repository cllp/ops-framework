import "@testing-library/jest-dom/vitest";

/**
 * Radix mäter element och använder webbläsar-API:er som jsdom saknar. Utan de
 * här stubbarna kraschar varje test som öppnar en modal eller en väljare, och
 * det felet säger ingenting om koden vi faktiskt testar.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/*
 * ⛔ `Element.prototype.scrollTo` SAKNAS HELT I JSDOM, till skillnad från
 * `scrollIntoView` ovan som bara saknar effekt. Utan den här raden KASTAR varje
 * prov som monterar `OpsCalendar`, eftersom kalendern rullar sin egen behållare
 * till innevarande månad vid montering.
 *
 * ⛔ EN TOM FUNKTION ÄR SANNINGEN HÄR och inte en nedsläppsväg: jsdom har ingen
 * layout, alltså finns det ingen rullsträcka att flytta sig längs. Att i stället
 * lägga ett `typeof === "function"`-villkor i komponenten hade smugit in ett
 * provsammanhang i produktionskoden, och den grenen hade aldrig körts i en
 * webbläsare.
 */
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

/*
 * ══ ⛔ `:popover-open` I JSDOM KOSTADE 31 SEKUNDER PER ÖPPNAD POPOVER ════
 *
 * Mätt 2026-09-21, här och i bolag-ops. Ett prov som öppnar en popover och
 * sedan väntar på nästa varv i händelseslingan, vilket är precis vad varje
 * `findBy*` gör:
 *
 *   filterpanel.test.jsx med de tre raderna nedan      1,4 s
 *   filterpanel.test.jsx utan dem                    127,5 s
 *
 * En Radix-DIALOG, som inte positionerar sig mot något, tar 2 ms. Samma popover
 * med `avoidCollisions={false}` tar 2,1 s. Det är alltså kollisionsräkningen som
 * kostar, och den gör så här: floating-ui frågar varje förfader om den är ett
 * popover- eller modallager, med `element.matches(":popover-open")` inlindad i
 * en try/catch eftersom äldre webbläsare inte kan väljaren. Frågan ställs per
 * förfader, per placering den provar, per omräkning.
 *
 * ⛔ VAD SOM ÄR MÄTT OCH VAD SOM ÄR SLUTSATS, för skillnaden är värd att veta
 * om någon en dag vill ta bort de här raderna. MÄTT: väntan går från 31 212 ms
 * till 18 ms, och 2 000 anrop av `document.body.matches(":popover-open")` kostar
 * 37 ms utan stubben. Ett enskilt anrop är alltså BILLIGT, och det första
 * utkastet av den här kommentaren påstod tvärtom att jsdom kastar ett fel per
 * anrop. Det gör den inte: anropet svarar `false`. SLUTSATS: kostnaden uppstår
 * först när väljaren körs mot elementen i det öppnade lagret, tusentals gånger,
 * och den vägen genom jsdom är inte den som är optimerad.
 *
 * ⛔ FELET SYNS ALDRIG SOM ETT FEL. Proven blir gröna, de tar bara minuter, och
 * den kostnaden läser man som "jsdom är trögt" i stället för som en defekt. Den
 * hittades bara för att fyra prov i bolag-ops gick från sju sekunder till två och
 * en halv minut i en ändring som inte borde ha kostat något.
 *
 * ⛔ STUBBEN SVARAR `false` OCH SKICKAR ALLT ANNAT VIDARE. Det är sanningen i
 * jsdom: det finns inget öppet popover-lager och ingen modal i webbläsarens
 * mening. Svarade den på fler väljare skulle Radix egna kontroller sluta hitta
 * sina element, och det felet hade sett ut som en trasig komponent.
 *
 * ⛔ Vaktat av `jsdomstubbar.test.jsx`, som mäter tiden. Tas de här raderna bort
 * blir det provet rött som en TIMEOUT och inte som ett brutet påstående, för
 * väntan blir längre än vitests eget tak. Det är fortfarande rätt prov som
 * pekar på rätt rad.
 */
const OSTODDA_VALJARE = new Set([":popover-open", ":modal"]);
const riktigMatches = Element.prototype.matches;
Element.prototype.matches = function matches(valjare) {
  if (OSTODDA_VALJARE.has(valjare)) return false;
  return riktigMatches.call(this, valjare);
};
