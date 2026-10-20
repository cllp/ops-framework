# Design: gäster i hela gruppen och det bantade gränssnittet (cllp/lifehub.app#389, ramverkets del, skiva 2)

Status: byggd i 0.132.0, granskas av Claude innan steget mergas. Ärende: cllp/lifehub.app#389 (epiken). Designförslaget: https://github.com/cllp/lifehub.app/issues/389#issuecomment-6295916087. CP:s beslut 2026-10-20: https://github.com/cllp/lifehub.app/issues/389#issuecomment-6296743377.
Bygger på beslut 0011 (en gäst är en inbjudan och aldrig ett konto, skiva 1) och ändrar inget av det: modellen, sessionen, platserna och felräknarna är desamma, med ett andra omfång.

## Händelsen

Skiva 1 gav en gäst en sak: rösta på ett datum. CP vill att en extern ska kunna vara med i hela projektet. CP:s beslut på designen, ordagrant i sak:

1. **Ägare och admin bjuder in till hela gruppen.** Inte vem som helst som får bjuda in till en omröstning.
2. **Gästen ser chattens hela historik, och dialogen säger det tydligt.** Inte bara det som skrivs efter inbjudan.
3. **Radering av en gästs uppgifter och en text om integritet är klara före första gruppgästen.** Skiva 1 lät det vara "CP:s bedömning"; nu är det ett krav.

Tre beslut kom under bygget, alla 2026-10-20, och ändrade designen:

4. **Gästen får skriva i gruppchatten.** Designen sade "utan skrivfält". Nu skriver gästen som gäst, aldrig som medlem, och meddelandet märks Gäst i medlemmarnas chatt.
5. **Gästen ser inga ärenden i skiva 2.** Åtgärden, funktionen, vyn och fliken är borta. Delegering av ett ärende till en gäst, där gästen bara ser sina egna, är skiva 3.
6. **Gästen bjuds in från gruppens medlemsvy**, som ett val i Roll under Bjud in ("Gäst (utan konto)"), och inte på en egen plats.

## Beslutet i en tabell

| Fråga | Svar | Varför |
|---|---|---|
| Vad är "hela gruppen"? | Omfånget `{ slag: "grupp" }`. Inbjudans id är fortfarande SHA-256 av (grupp, adress, omfångsnyckel); omfångsnyckeln `"grupp"` ger en andra rad per person bredvid en eventuell `sak:rosta:<händelse>`. | Befintliga id ändras inte (skiva 1:s rader har samma id som förut, och ett prov bevisar det). Samma adress till samma omfång är fortfarande samma rad. |
| Taket | Oförändrat: 5 platser per grupp, och **en person tar en plats oavsett hur många omfång hen har**. | Platsen är nyckad på gästen (`g_`-id) och inte på inbjudan. Annars hade en gäst med en grupp och tre omröstningar tagit fyra av fem platser. |
| Vem bjuder in? | Ägare eller admin, **i ramverket och inte i en callback** (`bjud` med `slag: "grupp"`). `farBjuda` gäller bara en omröstning. | Gästen läser hela chatthistoriken. En app som lade regeln själv kunde släppa in fler, och ändringen är en ny händelse här. |
| Vad ser och kan gästen? | Gruppens chatt (hela historiken, och hen kan skriva i den), kalendern och händelserna (svara och rösta) och biblioteket (läsa, spela, ladda ned). **Inga ärenden.** Gästen kan inte bifoga eller ladda upp. | CP:s beslut. Ärendelistan kan bära sådant som inte rör gästen, och uppladdning för gäster stryks i #389. |
| Hur når gästen det? | Samma väg som i skiva 1: bara servern, `POST /api/gast`, sessionsnyckeln i kroppen. Åtta nya åtgärder (`GASTGRUPPATGARDER`) bakom samma tjänst. | Inga regler, index eller callables släpper in en gäst, och ingen av dem ändras. |
| Vad lämnar servern? | Öppna listor fält för fält per åtgärd. Aldrig en medlems adress eller uid. Chattens avsändare är ett namn. | Allt som skickas ut är något som kan läcka. |
| Filer | En signerad adress, 15 minuter, högst 50 per inbjudan och dygn, bara filer i gruppens egen plats med exakt sökväg. | Trafiken ut ur lagringen är det enda en gäst kan driva upp. |
| Radering | Medlemmen raderar en gästs uppgifter i gruppen; gästen raderar allt om sig, i alla grupper, från gästsidan. Inga spår av adressen blir kvar, och platsen frigörs. | CP:s beslut 3. |

## Valen i bygget, och vad som avviker från förslaget

1. **Gästens API bor i samma tjänst** (`createGastService`), med appens delar injicerade: `grupp.handelseSida` (vilka av appens fält som är titel, beskrivning och plats), `grupp.omrostning` (`falt`, `bygg`, `rosta`), `grupp.lagring.signeradAdress`. Ramverket känner aldrig samlingsnamn eller projekt-id. En app som utelämnar `grupp` får skiva 1 oförändrat, och `bjud` med `slag: "grupp"` kastar `ogiltigt-omfang`.
2. **Kravet prövas mot omfånget på ett ställe** (`gastOmfangGer`), och det anropas av `session` vid varje anrop. En omröstningsgäst ger aldrig en gruppfunktion, och en gruppgäst ger aldrig `rosta` på en sak. Ett nekat anrop (okänd session, återkallad, fel slag) kostar ingen räknare.
3. **Vyerna är medlemmens, inte en andra uppsättning.** Kalendern är `OpsCalendar` och en händelse öppnas i `OpsHandelsePanel` utan penna eller flytt. Biblioteket är `OpsBibliotek` med `jag: null`. Chattens bubblor är medlemmens (`Meddelanderader` ur `OpsMeddelanden`, den rena ritaren, exporterad för det). Svarsraden är `OpsSvarSummor`, som `OpsSvar` delar. Chattens skrivfält är chattens (`Skrivfalt`, delat) utan bilagor, mikrofon, omnämnanden och agent. Skalet är bantat: tre flikar och ingen väg ut ur `/gast` (mätt: inga länkar och inga ord ur appens skal i sidan).
4. **Förslaget antog att biblioteket hämtade en adress bara när en post öppnas. Det gjorde det inte.** `OpsBibliotek` hämtade en adress för varje filpost när listan ritades. För en medlem är det billigt (`getDownloadURL`); för en gäst är varje adress en signering som räknas mot taket, så en lista med 60 filer hade tagit 60 av 50. Rättat med `adresserPaBegaran` (bara den öppna posten), och provet är rött utan den.
5. **Hålet i `OpsGastSida` rättades i samma steg.** Skiva 1 prövade bara den senast öppnade sessionen på enheten. En gäst med en återkallad grupp och en levande omröstning (eller tvärtom) fick då "Inbjudan är återkallad" fast hen hade en giltig inbjudan. Nu prövas alla sparade sessioner, senast öppnade först, och orsaken visas först när alla nekats. Provet är rött utan rättelsen.
6. **Listan över gäster är en rad per person.** `lista({ groupId })` ger `personer` med inbjudningarna under, eftersom en gäst nu kan ha flera omfång och platsen är en. Åtgärder per inbjudan (Skicka igen, Dra tillbaka) och per person (Dra tillbaka alla, Radera uppgifter).
7. **Att bjuda in till hela gruppen bekräftas i en dialog** som säger vad gästen ser (chattens hela historik, och att hen kan skriva i den; kalendern och händelserna, att svara och rösta; biblioteket, att läsa, spela och ladda ned), vad gästen inte ser (gruppens ärenden och medlemmarnas adresser), och att det gästen hunnit läsa eller ladda ned inte går att ta tillbaka (en redan öppnad fil går att nå i högst 15 minuter efter en återkallelse). Inget anrop går före bekräftelsen.
8. **En verklig bugg hittades av ett prov under bygget:** `nyLank` sorterade på tid ensam, så en gruppinbjudan kunde hamna utanför de fem länkarna. Grupplänken sorteras nu först. Provet är rött utan sorteringen.
9. **Två loopar blev en** (`aterkallaRader`): `aterkallaAlla` och `ersattAvMedlem` återkallade på samma sätt på två ställen. En sanning.
10. **Gästens svar och röst skrivs med `g_`-id i medlemmens form.** Medlemsregeln kräver `request.auth.uid == uid`, så ingen klient kan skriva raden, och servern får aldrig vara löslare än regeln: tabellen `rules/__tests__/svarfall.mjs` (14 fall) körs som medlem mot de riktiga reglerna och som gäst mot servern. Raden `arkiverad` är den enda där de skiljer sig (servern är strängare) och står utskriven.

## Det som inte är gjort, och varför

- **Ärenden för en gäst**, och delegering av ett ärende till en gäst (där gästen bara ser sina egna). Skiva 3 i lifehub.app#389.
- **Att en gäst bifogar något eller svarar i en tråd.** Gästen skriver bara text i huvudchatten, och vyn säger det ("Du kan inte bifoga filer. Svar i trådar visas inte än").
- **Trådsvar och bilagornas innehåll i gästens chatt.** Bilagan visas med sitt namn ("Bilagor visas inte för gäster"). Se regel 13.
- **Sms (46elks).** Skiva 4.
- **Brevets text** (appens, med en variant för omfånget `grupp`), omröstningens modell, ärendets form, samlingsnamnen och routen `/gast`: appens.
- **Att växla en gäst till medlem.** Appens växling anropar `ersattAvMedlem({ epost, groupId })`, som drar tillbaka gästens inbjudningar i just den gruppen och släpper platsen. Bara servern, aldrig en klient.
- **Mätning mot en riktig Firestore med riktig data.** Tjänsten är provad mot minneskällan (datakontraktet), reglerna mot emulatorn, vyerna i jsdom och i en riktig webbläsare. Ingen produktionsdata har lästs eller skrivits (CP:s säkerhetsregel för det här passet), så "hur många dokument har en grupp i `meddelanden`" är inte mätt: chatten läses en sida om 50 i taget just därför.

## Kvarvarande risker, utskrivna

- **En gäst är en medlem med få rättigheter för tre funktioner.** Allt som ligger i gruppens kalender och bibliotek syns för hen, också sådant en medlem lagt där men tänker sig som halvprivat, och hen kan skriva i chatten. Appens `handelseSida` avgör hur mycket av en händelse som lämnar servern, och det är appens val att granska.
- **En gäst kan skriva, och en medlem kan bli lurad av ett namn.** Gästens `avNamn` är vad gästen eller den som bjöd in angav, och märket Gäst står alltid bredvid (härlett ur `av`), men ett namn som liknar en medlems syns ändå. Takten (10 per minut) och längden (1000 tecken) begränsar skadan, och `aterkalla` stänger skrivandet vid nästa försök. Ramverket har ingen synlighet per post för gäster med flit (regel 13).
- **Chattens hela historik**, också det som skrevs innan gästen fanns. CP:s beslut, och dialogen säger det.
- **En redan utfärdad filadress lever 15 minuter efter en återkallelse.** Det går inte att dra tillbaka en signerad adress. Texten i dialogen och i `OpsGastLista` säger det.
- **`raderaSvar` kastar när gruppen har fler än 20 000 händelser**: en radering som inte kan lova att ha sett allt ska inte säga att den är klar. En grupp som når taket behöver ett eget städjobb.
- **Kvar efter radering är räknare per IP**, som är en hash av en IP och inget av personen.
- **Servern prövar medlemsregelns villkor för ett svar på egen hand** (`svara`), för det finns ingen transaktion mot reglerna. Tabellen ovan är vakten. Ändras medlemsregeln utan att tabellen ändras blir provet rött på den raden.

## Regel 13: förebilden är ett golv

Ärendet citerar ingen SessionStudio-skärmbild, så regel 12 utlöses inte. Förebilden för ytan är medlemmens egna vyer (golvet), och för modellen designen i #389. De tre listorna:

**Tas som det är.** Modellen från skiva 1 (en gäst är en inbjudan, sessionen per inbjudan, platser som fasta dokument, nyckeln i fragmentet, felräknare per inbjudan och IP). Medlemmens kalender, händelsepanel, biblioteksvy och chattbubblor: ytan ska se likadan ut för den som redan känner appen. Rollen ägare eller admin för att bjuda in. Hela chatthistoriken.

**Görs bättre, och skälet.**
- *Biblioteket signerar bara det som öppnas*, inte hela listan (punkt 4). Billigare och rätt tak.
- *En person en plats*, oavsett antal omfång. Ett omfång ska inte kosta en plats till.
- *Dra tillbaka alla* i ett anrop, med rätten prövad på varje rad före något ändras.
- *Bekräftelsen säger vad gästen ser.* Medlemmen annars inte vet att hela historiken följer med.
- *Radering och integritetstext finns före första gästen*, på båda sidor (medlemmen och gästen).
- *Alla sparade sessioner prövas* (punkt 5).
- *Flikarna är 44 px* (`OpsTabs`, grundformen, var 42) och får plats i en telefon (12 px sidoluft under 640 px).
- *Gästen ser aldrig vem som svarat*, bara summor och sitt eget svar.
- *Gästen skriver som gäst och aldrig som medlem*: egen identitet (`g_`-id), märket Gäst härlett ur `av`, tak på längd och takt, och gästens meddelanden raderas med gästen. Förebilden (chatten) ger en medlems ställning; en gäst får hälften.
- *Bifoga på kommentarer är en gem i skrivrutan* (som chattens Bifoga) och inte en stor knapp under rutan.
- *Gästen bjuds in där medlemmar bjuds in* (`OpsMedlemmar`), i samma ruta, med räknare och bekräftelse.

**Stryks, och vad det hade kostat.**
- *Ärenden i gästvyn:* **stryks**, skälet är att ärendelistan kan bära sådant som inte rör gästen (en sort som hör till Ekonomi, ett ärendes GitHub-adress, ett kvitto). Att filtrera fram det som rör gästen hade krävt en behörighetsmodell per ärende. Delegering av ett ärende till en gäst, där gästen bara ser sina egna, är skiva 3 i cllp/lifehub.app#389.
- *Bilagor och uppladdning från en gäst:* en gäst som laddar upp är en gäst som kan fylla lagringen. Gästen skriver bara text.
- *Skriva i trådar:* trådsvar visas inte i gästens chatt, och gästen skriver bara i huvudchatten.
- *Privata samtal, agentens meddelanden och Ekonomi:* en gäst har inget i dem att göra. Agentens egna meddelanden döljs i chatten; ett medlemsmeddelande som citerar agenten går inte att filtrera och ingen påstår något annat.
- *Mitt bibliotek och händelsens eller ärendets filer i gästens bibliotek:* bara gruppens egen plats. Hade krävt en behörighetsmodell per post.
- *Synlighet per post för gäster:* hade varit "permissions-träsket" (ADR-020 i SessionStudio: läsregler som avgör vem som ser vad, som föll på Firestores gräns för `exists()`). Gäster når bara servern, så ingen läsregel behövs, och priset är den kvarvarande risken ovan: allt i kalendern och biblioteket syns, och chatten.
- *Bilagornas innehåll och trådsvar i gästens chatt:* en signering per bild i en historik på hundratals meddelanden hade tagit gästens filtak på en sida.
- *Reaktioner, fästa meddelanden och sök i chatten:* ingen av dem behövs för att läsa, och varje är en egen yta att hålla i takt.

## Proven, båda riktningarna

Siffrorna och mutationerna står i CHANGELOG och i PR-texten. Kärnan: tjänsten har läckageprov med seedade medlemmar (adresser, uid, andra gäster, privata samtal, agenten, pengar och en annan grupp: inget syns i något svar), återkallelse nekas vid nästa anrop i varje åtgärd, en omröstningsgäst når inte gruppen, taket delas mellan omfången, den signerade nedladdningen har rätt fil, tak per dygn och ingen adress efter återkallelse, och radering lämnar ingen adress, identitet eller sessionsnyckel i någon samling (provet kan SE ett spår: före raderingen finns alla).

## Ompinningen i appen (lifehub.app)

Se README, avsnittet "Gäster", och slutrapporten i PR-texten. I korthet, i den ordning som är säker: ompinna till 0.132.0; lägg `grupp` (utan `arenden`) och `radering` i `createGastService`; låt `/api/gast` skicka `GASTGRUPPATGARDER` (nu med `skrivChatt`) och `raderaMig` vidare, svara 429 på `for-manga` och 400 på ett fel med `kod: "ogiltig-text"`; ge `gastBjud` slaget `grupp`, `gastLista` ett `groupId`, och två nya callables (`gastAterkallaAlla`, `gastRadera`); en brevvariant för omfånget `grupp`; `ersattAvMedlem` i växlingen; och i vyerna `OpsMedlemmar` med `gaster` (inbjudan sitter i Roll under Bjud in) och `/gast` med `renderGrupp` och `onRaderaMig`. Medlemmarnas chatt behöver ingenting: `Meddelanderader` märker en gäst ur `av`. Inga regler, index eller `firebase.json` ändras, så ordningen "regler före klient" gäller inte; deploy är bara functions.
