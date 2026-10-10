# Ljudraden, 0.92.4

Förebild: `docs/jamforelser/forebild-ss-bibliotek/ss-inspelningar.png` (SessionStudio, listan Inspelningar).
Ramverket är mätt med Playwright mot den byggda appen, 390 och 1280 px (`check-skalyta`).

## Som förebilden

- Rubrik, datum och längd (`8 okt. 2026 · 0:04`), och ⋯.
- Ett element till vänster på raden.
- Detaljens rubrik är inspelningens namn.

## Bättre, och skälet

- Spelknapp och våg i listan. CP bad om play, våg och skrubbning. Förebildens lista har en musikikon och ingen våg.
- Hopp, hastighet och Ladda ned i detaljen och i menyn. De trängdes ihop i listan och dolde rubriken.
- Längd och toppar sparas på posten. Listan visar längden utan att någon spelar. Saknas längden skrivs den inte som `0:00`.
- Saknas namnet visas "Röstinspelning" plus datum, i listan och i detaljen.

## Stryks, och vad det hade kostat

- Musikikonen på ljudraden. Den och spelknappen på samma rad var överlappet på telefonen. Ikonen finns kvar på övriga rader och bredvid rubriken i detaljen.
- Låt, spellista och rider. De hör till musikappen (analys 0004) och skulle dra in en modell ramverket inte äger.
- Läsregler som avgör vem som ser posten. Det är permissions-träsket (ADR-020), inte den här ytan.

## Kvar som skiljer

- Förebildens lista har ikon, inte spelknapp och våg. Vågen är med för att CP bad om den.
- Förebildens spelare i raden är play, namn, nedladdning och spolning. Hastighet och hopp finns här i detaljen, inte i förebildens listrad.
