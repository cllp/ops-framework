#!/usr/bin/env node
/**
 * Bygger ramverkets publika bundle.
 *
 * ⛔ Varför ett byggsteg alls, när källkoden redan är ESM?
 *
 * Vite transformerar inte JSX inuti `node_modules`. Ett ramverk som skickar
 * rå `.jsx` tvingar därför varje konsument att lägga in en `optimizeDeps`-
 * inställning de inte förstår, och den dagen någon glömmer den blir felet ett
 * kryptiskt syntaxfel långt från orsaken. Vi bygger en gång här i stället.
 *
 * ⛔ React, react-dom och Radix är externa. Buntas React in får appen två
 * kopior av React, och då kastar varje hook "invalid hook call" utan att något
 * pekar mot orsaken.
 *
 * Klassnamnssträngarna överlever bygget oförändrade, vilket är det Tailwinds
 * källscanning behöver. Därför pekar konsumentens `@source` på `dist`.
 */

import { build } from "esbuild";

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  outfile: "dist/index.js",
  jsx: "automatic",
  target: ["es2022"],
  platform: "browser",
  sourcemap: true,
  // Minifiering är AV med flit. Bundlen läses av människor när något ser fel
  // ut, och en minifierad primitiv är omöjlig att felsöka i en konsumentapp.
  minify: false,
  // ⛔ Allt som konsumenten installerar sjalv ar EXTERNT. Buntas de in far
  // appen tva kopior av samma bibliotek, bundlen vaxer med hundratals kilobyte,
  // och for React blir det dessutom "invalid hook call". Matt: att glomma
  // react-day-picker har tog bundlen fran 34 till 219 kB.
  external: ["react", "react-dom", "react/jsx-runtime", "@radix-ui/*", "react-day-picker", "react-day-picker/*", "date-fns", "date-fns/*", "@date-fns/*"],
  logLevel: "info",
});
