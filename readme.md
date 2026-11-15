# shopware-6-media-zip-downloader

Markierte Bilder aus einem Shopware-6-Medienordner gemeinsam als ZIP herunterladen – direkt in der Administration, ohne Serverinstallation und ohne externe JavaScript-Bibliothek.

**Fiktives Beispiel:** Ordner „Produktbilder“, 12 erfolgreich geladene Bilder:

```text
shopware-produktbilder-12-bilder.zip
```

## Zweck und Funktionen

Das Userscript ergänzt rechts unter **Aktionen** die Schaltfläche **Auswahl als ZIP**, sobald mindestens zwei Dateien markiert sind. Es lädt die Originaldateien der Auswahl, nicht die Vorschaubilder.

- Liest die Auswahl bevorzugt über die Medien-IDs der Vue-Komponenten.
- Verwendet bei fehlendem Vue-Zugriff eindeutige Dateinamen aus der Auswahl-Seitenleiste.
- Lädt die Medienliste des aktuellen Ordners seitenweise (100 Einträge pro Anfrage).
- Erstellt das ZIP lokal im Browser, mit CRC32-Prüfsummen und ohne zusätzliche Kompression.
- Wandelt ZIP-Namen und enthaltene Dateinamen in Kleinbuchstaben um; ersetzt Leerzeichen durch Bindestriche.
- Wandelt Umlaute um: ä → ae, ö → oe, ü → ue, ß → ss.
- Löst Namenskollisionen mit Suffixen wie `bild-2.jpg` auf.
- Bricht bei uneindeutiger Auswahl, Nicht-Bilddateien, überschrittenem Speicherlimit oder einem Wechsel der Medienansicht ab.
- Fragt bei einzelnen fehlgeschlagenen Bildabrufen, ob ein unvollständiges ZIP erstellt werden soll. Die Zahl im ZIP-Namen entspricht immer den tatsächlich enthaltenen Bildern.

Die Originalnamen und Ordner in Shopware werden **nicht umbenannt**. Im ZIP liegen die Bilder flach, ohne Unterordner. „auswahl“ erscheint nicht im ZIP-Dateinamen.

## Voraussetzungen und Grenzen der Kompatibilität

- Shopware 6 mit deutscher Administrationsoberfläche und Zugriff auf `window.Shopware`.
- Angemeldeter Benutzer mit Leserechten auf Medien und Medienordner.
- Ein geöffneter Medienordner, dessen Route etwa `#/sw/media/index/0123456789abcdef0123456789abcdef` lautet.
- Mindestens zwei Bilder aus diesem Ordner; keine Ordner, PDFs oder Videos mit markieren.
- Moderner Desktopbrowser mit Fetch, Streams, Blob, TextEncoder, MutationObserver und einer geeigneten Erweiterung.

Die Auswahl-Seitenleiste wurde mit den öffentlichen Shopware-Quellen abgeglichen. Vue-Interna und DOM-Klassen sind keine stabile Erweiterungsschnittstelle: Änderungen an Shopware, Themes oder Admin-Erweiterungen können Anpassungen erfordern. Es wird keine pauschale Kompatibilität mit sämtlichen Shopware-6-Versionen behauptet.

## Installation: Tampermonkey oder Violentmonkey

1. Installiere **einen** Userscript-Manager über dessen offizielle Website:
   [Tampermonkey](https://www.tampermonkey.net/) oder
   [Violentmonkey](https://violentmonkey.github.io/).
2. Öffne das Dashboard der Erweiterung und erstelle ein neues Script.
3. Ersetze den gesamten Beispielcode durch den Inhalt von
   [shopware-media-zip.user.js](shopware-media-zip.user.js), einschließlich des Metadatenblocks.
4. Passe die `@match`-Zeile an deine tatsächliche Shop-Domain und den Admin-Pfad an:

```javascript
// @match https://shop.example.invalid/admin*
```

Beispiele für eigene Installationen:

```javascript
// @match https://shop.meine-domain.de/admin*
// @match https://verwaltung.meine-domain.de/backend/admin*
```

Verwende nur die zu deiner Installation passende Zeile. Die mitgelieferte Domain
`shop.example.invalid` ist absichtlich ein funktionsloser Platzhalter. Das
`*` berücksichtigt Varianten wie `/admin` und `/admin/`.
Die Route nach `#` gehört nicht in das Match-Muster.

5. Speichern, Erweiterung für diese Website zulassen und die Administration vollständig neu laden.
6. In aktuellen Chrome-Versionen gegebenenfalls bei der Erweiterung
   **Details → Nutzerskripte zulassen / Allow User Scripts** einschalten.
   Ältere Chrome-Versionen können dafür den Entwicklermodus benötigen; beachte die Hinweise deiner Erweiterung.
7. Das Script benötigt den **Seitenkontext**. Behalte diese Metadaten bei:

```javascript
// @grant none
// @sandbox raw
// @inject-into page
// @noframes
```

`@sandbox raw` ist die entsprechende Vorgabe für Tampermonkey;
`@inject-into page` für Violentmonkey. Je nach Browser, CSP und
Erweiterung kann der Seitenkontext trotzdem blockiert sein. Dann erscheint eine
verständliche Fehlermeldung; ein isolierter Kontext genügt diesem Script nicht.

Die Installation per Kopieren vermeidet eine Abhängigkeit von einer bereits
veröffentlichten Raw-URL. Ein späterer Klick auf eine rohe `.user.js`-Datei kann
ebenfalls die Installation im Manager öffnen. Eigene Änderungen an `@match`
bei einem Update prüfen und bei Bedarf erneut setzen.

## Installation: User JavaScript and CSS

Die Erweiterung heißt **User JavaScript and CSS**. Offizielle Informationen und Store-Links:
[User JS and CSS](https://tenrabbits.github.io/user-js-css-docs/).

1. Öffne die Administration deines Shops und die Erweiterung.
2. Erstelle eine neue Regel, beispielsweise mit dem Namen
   `shopware-media-zip`.
3. Begrenze die Regel auf deine Domain und den Admin-Pfad, z. B.
   `https://shop.meine-domain.de/admin*`.
4. Füge den vollständigen Inhalt der `.user.js`-Datei in das JavaScript-Feld ein.
   Die Metadaten sind dort normale Kommentare; maßgeblich ist das URL-Muster der Regel.
5. **Isolated environment deaktivieren.** Sonst sieht das Script zwar die Oberfläche,
   aber nicht Shopwares JavaScript-Objekte.
6. **All frames deaktiviert lassen.** Es wird keine zusätzliche CSS-Regel benötigt.
   Die normale Ausführung nach Aufbau des Dokuments genügt.
7. Speichern, Regel aktivieren und die Administration neu laden.
8. Falls JavaScript überhaupt nicht läuft, in den Browserdetails der Erweiterung
   **Allow User Scripts / Nutzerskripte zulassen** und den Websitezugriff prüfen.
   Firefox und ältere Chrome-Versionen können andere Freigabedialoge anzeigen.

Verwende nicht gleichzeitig dieselbe Regel und einen Userscript-Manager für dieses Script.

## Benutzung

1. In Shopware **Inhalte → Medien** öffnen und einen konkreten Medienordner betreten.
2. Mindestens zwei Bilder auswählen. Die rechte Seitenleiste muss die Anzahl der
   ausgewählten Dateien und den Bereich **Aktionen** anzeigen.
3. Bei **Aktionen → Auswahl als ZIP** klicken.
4. Während des Vorgangs in dieser Medienansicht bleiben. Das Script verwendet die beim
   Klick erfasste Auswahl und zeigt den Fortschritt im Button.
5. Falls einzelne Bilder fehlen, die Rückfrage zum unvollständigen ZIP bewusst beantworten.
6. Das ZIP im normalen Downloadordner des Browsers öffnen und die enthaltenen Bilder prüfen.

Fiktive Beispiele:

| Ordner in Shopware | Erfolgreiche Bilder | ZIP-Name |
| --- | ---: | --- |
| Produktbilder | 12 | `shopware-produktbilder-12-bilder.zip` |
| Beispiel Ordner | 3 | `shopware-beispiel-ordner-3-bilder.zip` |
| Kategorien | 8 | `shopware-kategorien-8-bilder.zip` |

Aus `Front Ansicht.JPG` wird im ZIP `front-ansicht.jpg`.
Ergeben mehrere Namen dasselbe Ergebnis, folgen `front-ansicht-2.jpg`, usw.
Nicht unterstützte Zeichen werden ersetzt; einzelne Namensbestandteile werden auf
160 Zeichen begrenzt. Falls der Ordnername nicht abrufbar ist, lautet der Ersatz
`medien`, z. B. `shopware-medien-2-bilder.zip`.

## Einrichtung und Berechtigungen

Es werden keine Zugangsdaten, API-Schlüssel oder zusätzlichen Serverendpunkte eingerichtet.
Das Script verwendet Shopwares Repository-Service und die bestehende Admin-Sitzung,
um Medien und Ordnerinformationen **lesend** abzurufen. Repository-Suchen können
technisch HTTP-POST-Anfragen sein; das Script führt keine Speicher-, Lösch- oder
Verschiebeoperationen aus.

Die Erweiterung braucht Websitezugriff auf die Administration. Der Seitenkontext
ist nötig, weil `window.Shopware` und die Vue-Komponenten in der Webseite liegen.
Er bedeutet auch, dass eingefügter JavaScript-Code mit den Möglichkeiten der
angemeldeten Admin-Seite läuft. Verwende eine eng begrenzte Domainregel und prüfe
den Scriptinhalt vor der Installation.

`@grant none` bedeutet, dass keine privilegierten GM-APIs angefordert werden;
es bedeutet nicht, dass Seitencode keine Rechte hätte. Das Script verwendet
keine externen Codebibliotheken, keine Analyse- oder Uploaddienste und keinen
lokalen Speicher für Bilder oder Anmeldedaten.

Bildanfragen gehen an die in Shopware hinterlegte Original-URL. Bei gleicher
Origin dürfen die bestehenden Cookies mitgeschickt werden; fremde Origins werden
mit `credentials: omit` abgerufen. Scheitert eine fremde URL unter
`/media/`, wird zusätzlich derselbe Pfad auf der Admin-Origin versucht.
Das ist nur ein Fallback für übliche Domainabweichungen und funktioniert nicht bei
jeder Hostingkonfiguration. URLs oder Dateinamen können in der Browserkonsole erscheinen;
Konsolenausgaben daher vor dem Teilen prüfen.

## Einschränkungen

- Nur Bilder im direkt geöffneten Ordner, keine Unterordner oder vollständigen Shop-Backups.
- Mindestens zwei markierte Dateien; die Einzeldateiansicht wird nicht ergänzt.
- Deutsche Oberflächentexte und die Standardstruktur der Medien-Seitenleiste werden vorausgesetzt.
- Die komplette Medienliste des Ordners wird abgefragt, auch wenn nur wenige Bilder markiert sind.
- Bei gleichem Originaldateinamen ist der Dateinamen-Fallback mehrdeutig und bricht ab.
  Über eindeutige Medien-IDs kann dieselbe Auswahl dennoch funktionieren.
- Externe Medienserver müssen Browserabrufe per CORS zulassen. Zusätzliche geschützte
  Medien, abweichende CDN-Pfade oder Zugangssperren werden nicht umgangen.
- Content Security Policy kann die Scriptausführung oder Bildabrufe verhindern.
- Höchstens 512 MiB Bilddaten pro Vorgang; der tatsächliche Speicherbedarf ist höher.
  Große Auswahlen in kleinere Gruppen teilen. Es gibt kein ZIP-Streaming auf die Festplatte.
- ZIP32: höchstens 65.535 Dateien und weniger als 4 GiB Archivdaten inklusive Strukturen.
  Das Speicherlimit greift normalerweise früher. ZIP64 wird nicht unterstützt.
- ZIP-Methode STORE: Bilder werden unverändert verpackt; das Archiv spart kaum Speicherplatz.
- Der Browser entscheidet über den endgültigen Speicherort und kann bei bereits existierenden
  Downloads eigene Suffixe ergänzen. Das Script kann einen gespeicherten Download nicht bestätigen.
- Kein offiziell von Shopware unterstütztes Plugin; keine Garantie für jede Installation.

## Fehlerbehebung

| Problem | Prüfung / Lösung |
| --- | --- |
| Der Button fehlt | Richtigen Medienordner öffnen, mindestens zwei Bilder markieren, deutsche Oberfläche und sichtbare Seitenleiste prüfen. Regel aktivieren, Domain/Pfad korrigieren und Seite neu laden. |
| Nur CSS funktioniert / JavaScript startet nicht | Nutzerskripte-Freigabe und Websitezugriff in den Browserdetails der Erweiterung kontrollieren. |
| „Shopware nicht erreichbar“ | In User JavaScript and CSS die Isolation ausschalten; im Manager Seitenkontext verwenden. Prüfen, ob die aktuelle Admin-Version `window.Shopware` bereitstellt. |
| „Auswahlliste … unvollständig“ | „Ausgewählte Dateien“ aufklappen, Auswahl neu setzen. Angepasste oder virtualisierte Listen können den Fallback verhindern. |
| „Dateiname nicht eindeutig“ | Unterschiedliche Originalnamen verwenden oder den Vue-ID-Zugriff ermöglichen. Es wird nicht geraten. |
| HTTP 401/403 | Admin-Sitzung, Leserechte und die Erreichbarkeit der Originaldatei prüfen. |
| CORS / Failed to fetch | Browserkonsole und Netzwerkansicht prüfen. Betreiber des Medienservers muss passende CORS-Regeln setzen; keine allgemeinen CORS-Abschalt-Erweiterungen verwenden. |
| HTML statt Bild | URL liefert häufig Login- oder Fehlerseite. Original-URL, Sitzung und Serverzuordnung prüfen. |
| „Medienansicht … gewechselt“ | Download im gewünschten Ordner neu starten und dort bleiben. |
| Speicherlimit / Browser reagiert langsam | Weniger oder kleinere Bilder auswählen. Auch unter 512 MiB kann ein schwaches Gerät an seine Grenze kommen. |
| Kein Download trotz Erfolgsmeldung | Browser-Downloadliste, blockierte Downloads und freien Speicher prüfen. „Download angestoßen“ bestätigt nur die Übergabe an den Browser. |
| Doppelte oder alte Buttons | Alte Regel deaktivieren, nur eine Installationsart verwenden, Administration vollständig neu laden. |
| Nach Shopware-Update defekt | Regel deaktivieren, Shopware-Version, Erweiterung, Browser und bereinigte Fehlermeldung für einen Fehlerbericht notieren. |

Zum Entfernen die Regel beziehungsweise das Userscript deaktivieren oder löschen
und die Administration neu laden. Das Script installiert nichts in Shopware.

## Prüfstand

Das Script benötigt weder einen Build noch eine Paketinstallation.
Die ausführbare Datei ist `shopware-media-zip.user.js`.

Die überarbeitete Fassung wurde lokal mit 19 automatisierten Tests geprüft.
Zusätzlich hat ein unabhängiger ZIP-Leser Dateinamen, CRC-Prüfsummen,
Datum und bytegenaue Inhalte eines erzeugten Archivs kontrolliert.
Tests und interne Prüfberichte sind nicht Teil dieses öffentlichen Repositories.

**Testgrenze:** Es wurde für diese Fassung kein Durchlauf in einer echten
Shopware-Administration durchgeführt. Vor größeren Downloads mit zwei bekannten
Bildern testen und Dateinamen, Anzahl und Bildinhalt im ZIP vergleichen.

## Lizenz

[MIT-Lizenz](license), Copyright © 2026 tuami.
Die Lizenz betrifft den Code und die Dokumentation. Rechte an heruntergeladenen
Bildern oder Berechtigungen für deren Weiterverwendung werden dadurch nicht erteilt.
Shopware ist eine Marke ihres jeweiligen Rechteinhabers; dieses Projekt ist unabhängig.

## Quellen zur Einrichtung

- [User JS and CSS: Regel- und Berechtigungseinstellungen](https://tenrabbits.github.io/user-js-css-docs/doc)
- [Tampermonkey: Metadaten und Ausführungskontext](https://www.tampermonkey.net/documentation.php)
- [Tampermonkey: Nutzerskripte-Freigabe](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)
- [Violentmonkey: Metadaten und inject-into](https://violentmonkey.github.io/api/metadata-block/)
- [Shopware: Medien-Seitenleiste](https://github.com/shopware/shopware/tree/trunk/src/Administration/Resources/app/administration/src/module/sw-media/component/sidebar)

Die Erweiterungsanleitungen wurden am 15. November 2026 anhand der offiziellen Dokumentation abgeglichen.
