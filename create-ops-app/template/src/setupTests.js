import "@testing-library/jest-dom/vitest";

/**
 * Radix mäter element och använder webbläsar-API:er som jsdom saknar. Utan de
 * här stubbarna kraschar varje test som renderar en modal eller en väljare, och
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
 * prov som renderar `OpsCalendar`, eftersom kalendern rullar sin egen behållare
 * till innevarande månad vid montering.
 *
 * ⛔ DEN HÄR RADEN SAKNADES I MALLEN NÄR KALENDERN LANDADE, och luckan hittades
 * av bolag-ops ompinning: ramverkets egen `src/__tests__/setup.js` fick raden i
 * PR 62, men den filen kan inte köra kod i en konsumentapps vitest-process.
 * `check:scaffold` var grön ändå, eftersom den scaffoldade appen inte renderar
 * en kalender. En mall som saknar raden ger alltså ett fel som dyker upp först
 * när någon använder komponenten, i en app där ingen vet varför.
 *
 * ⛔ EN TOM FUNKTION ÄR SANNINGEN HÄR och inte en nedsläppsväg: jsdom har ingen
 * layout, alltså finns det ingen rullsträcka att flytta sig längs.
 */
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
