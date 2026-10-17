# Tracker (PWA)

Kleine private Tracker-App: eigene Buttons anlegen, antippen = Eintrag mit Datum/Uhrzeit, Liste pro Button mit Zeitraum-Filter.
Daten bleiben nur im Browser des Geräts (localStorage). Kein Server, keine Konten, keine externen Ressourcen.

- Lokal starten: `python3 -m http.server 8765` im Ordner, dann http://localhost:8765/ öffnen
- Datenlogik testen: `npm test` (node --test)
- Browser-Test: Server starten, dann `python test/e2e.py` (benötigt `pip install playwright && playwright install chromium`)
- iPhone: muss über HTTPS gehostet sein (z. B. GitHub Pages), dann in Safari „Teilen › Zum Home-Bildschirm“.
