# Gästens hemskärm: en ikon per grupp är inte löst

Status: avgränsad i det föreslagna 0.192.0. Ytan är byggd. Identiteten per grupp är inte det, och den ska inte lösas med ett provisorium. Inget är publicerat med den här texten.

## Vad som är byggt

Översikten har en stängd hjälp, "Lägg till på hemskärmen". Den visas inte när sidan redan körs fristående (`display-mode: standalone` eller `navigator.standalone`). Det är läst ur sidan, inte ur en telefon.

- iPhone, Safari och Chrome: texten säger att personen själv trycker på Dela och sedan Lägg till på hemskärmen. Ingenting installeras av sidan.
- "Sidan kan då öppnas utan adressfältet" sägs bara när dokumentet har `apple-mobile-web-app-capable: yes` och manifestets `display` är `standalone`, `fullscreen` eller `minimal-ui`.
- Android, Chrome: inget sägs förrän manifestet är läst. Om `start_url` inte är gästsidan säger texten att installationen öppnar startsidan, inte gruppen. Om den är gästsidan säger texten att det ändå är en installation, inte en ikon per grupp.

Appens manifest är läst ur `web/public/manifest.json`: ett dokument, `start_url` `/`, inget `id`, `display` `standalone`. Det är kod, inte ett installerat läge.

## Vad som inte är byggt

CP 2026-11-06: en installerad genväg ska heta `life-hub-[grupp]`, med ett läsbart namn som LIFE Hub · Skarv, så att flera grupper kan ligga på samma hemskärm. Olika namn räcker inte. Det som krävs är en stabil installationsidentitet per grupp. Den är inte byggd.

## Plattformarna, och vad som är hypotes

Inget i tabellen är provat på en riktig telefon. Webbläsarmätningen i den här PR:en är Chromium med låtsad viewport och låtsad användaragent. Den säger inte hur Safari eller Chrome på iPhone faktiskt lägger till en ikon.

| Påstående | Status |
|---|---|
| Safari på iPhone skiljer hemskärmsikoner på adressen personen står på, och använder inte manifestets `id` | Hypotes. Inte mätt på en enhet. Inte heller mätt om en andra ikon med samma adress ersätter den första. |
| Chrome på iPhone beter sig som Safari och har ingen `beforeinstallprompt` | Hypotes. Inte mätt på en enhet. |
| Chrome på Android använder manifestets `id`, och samma `id` uppdaterar samma app även om namnet ändras | Hypotes mot specifikationen och mot Chromes dokumentation, inte mot en enhet i den här körningen. |
| Två installationsidentiteter ger inte isolerade sessioner | Kodfakta för den här appen: sessionsnyckeln ligger i `localStorage` under `ops-gast:<inbjudan>`, per ursprung. Om en plattform isolerar lagring per ikon är det inte mätt här. |
| Appens enda manifest öppnar `/`, inte `/gast` | Kodfakta: `start_url` är `/`. |

En andra hemskärmsikon som ersätter en annan är alltså inte verifierad. Texten i hjälpen lovar därför inte ett namn per grupp och inte att två grupper får var sin ikon.

## Vad en lösning behöver, om den ska byggas

Inget av det här är byggt, och inget av det rör auktorisationen eller tokenens utgång:

1. En publik, stabil gruppnyckel som inte är en gästtoken och inte en sessionsnyckel. `hamta` skickar inte grupp-id i dag. Svaret är en öppen lista, och den listan är inte utökad med en hemlighet.
2. En startadress per grupp som inte bär token. Sidan väljer sedan den session som hör till den gruppen, om den finns och inte har gått ut.
3. Ett manifest per grupp, serverat av appen, med eget `id` och egen `start_url`, utan token. Hur Safari på iPhone tar emot det är en hypotes tills någon lägger till två ikoner på en telefon.
4. Ingen personlig token i manifest, cache eller startadress.

Tills det är ritat och granskat står gruppvis installation som en öppen designpunkt. Det läsbara gruppnamnet står i sidhuvudet och som rubrik på översikten, bredvid det befintliga ordmärket. Det är inte installationsnamnet.
