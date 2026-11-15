# Shopware 6 – Bilder als ZIP herunterladen

Mehrere Bilder aus der **Shopware 6 Medienverwaltung auf einmal herunterladen**: Dieses kostenlose Userscript ergänzt die Schaltfläche **„Auswahl als ZIP“** für einen einfachen Sammeldownload direkt im Browser.

## Was kann es?

- Lädt die ausgewählten Originalbilder gemeinsam als ZIP herunter.
- Benennt das ZIP nach Ordner und Bildanzahl, z. B. `shopware-produktbilder-12-bilder.zip`.
- Schreibt Downloadnamen klein und ersetzt Leerzeichen durch Bindestriche.
- Die Bilder und Ordner in Shopware bleiben unverändert.

## Installation

1. Für Chrome empfehlen wir [**User JavaScript and CSS**](https://chromewebstore.google.com/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld?pli=1).
2. Öffne das [**Skript**](shopware-media-zip.user.js) und kopiere den gesamten Code über **Raw**.
3. Erstelle in der Erweiterung eine Regel für die Admin-Adresse deines Shops, z. B. `https://shop.example.com/admin*`, und füge den Code ins JavaScript-Feld ein.
4. **„Isolated environment“ ausschalten**, speichern und die Shopware-Seite neu laden.

Andere CSS-/JavaScript-Injection-Erweiterungen funktionieren ebenfalls, wenn sie JavaScript im Seitenkontext ausführen können. In Shopware selbst muss nichts installiert werden.

## Benutzung

Medienordner öffnen → mindestens **zwei Bilder auswählen** → rechts unter **Aktionen** auf **„Auswahl als ZIP“** klicken.

Der Download startet automatisch. Währenddessen im geöffneten Ordner bleiben.

**Hinweis:** Für die deutsche Shopware-6-Oberfläche und Bilder aus einem Ordner. Zuerst mit zwei Bildern ausprobieren; große Auswahlen in kleinere Gruppen teilen.

[MIT-Lizenz](license)
