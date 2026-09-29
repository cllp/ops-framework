# Montage 0.31.1 och ärlig jämförelse

Bilderna är tagna med Playwright (Chromium) mot den byggda `dist`, aldrig jsdom. Före-bilderna är 0.31.0 byggd i en egen arbetskopia.

- `mobilhuvud-fore-efter.png`: mobilhuvudet vid 390 px, 0.31.0 mot 0.31.1.
- `inloggning-390.png`: 0.31.0 textmärke, 0.31.1 bildlogga ljus och mörk.
- `inloggning-1280.png`: 0.31.1 bildlogga ljus och mörk.

**Ingen SS-bild bredvid.** SessionStudio går inte att köra här (Firebase), och det finns ingen sparad skärmbild av dess mobilhuvud. Ur koden:
SS mobilhuvud har en 40 px loggeikon längst till vänster (`AppHeader.jsx:173`) och ingen gruppväxlare. Gruppväxlaren i mobilhuvudet är alltså
CP:s beslut 2026-09-29 18:40 och inte SS-paritet.

Matchar nu: inget märke eller text i mobilhuvudet, gruppmärket (40 px ruta, 44 px träffyta) längst till vänster, samma märke och ruta som remsan;
inloggningen visar appens logga i rätt utförande per tema, centrerad över kortet, 224 px hög (27 procent av vyn vid 390 px).

Skiljer sig fortfarande: (1) appens mörka PNG har opak botten `#202420` mot mörkt tema `#181c18` och syns som en svag ruta (genomskinlig
fil eller `#181c18` som botten i appen löser det, ramverket kan inte). (2) Loggan på inloggningen bär ingen rad 2 ("Bolag Ops") och ingen
viskning-placering är ändrad. (3) Mobilhuvudets gruppmärke i läget "Alla mina grupper" är den neutrala `PersonIkon`, inte ett märke med initialer.
