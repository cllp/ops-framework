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
