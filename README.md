# Tentakel-Toast

**Ein inoffizielles Day-of-the-Tentacle-Fanspiel – direkt im Browser.**

▶ **Jetzt spielen:** https://madd1in.github.io/tentakel-toast/

![Titelbild](screenshots/titel.png)

Fünf Jahre nach dem großen Tentakel-Tag hat Dr. Fred seine größte Erfindung gebaut: den **Gut-O-Mat**. Ein Toast daraus macht selbst den bösesten Schurken lieb und nett. Blöd nur, dass Lila Tentakel durchs Chrono-Klo abgehauen ist, die Energiezelle geklaut und das letzte Freundlichkeits-Brot gefressen hat.

Jetzt müssen **Bernard** (Gegenwart), **Hoagie** (Jahr 1776) und **Laverne** (Zukunft) zusammenarbeiten und sich Gegenstände per Chrono-Klo durch die Zeit schicken.

| Gegenwart | 1776 | Zukunft |
|---|---|---|
| ![Labor](screenshots/labor.png) | ![Gasthaus](screenshots/gasthaus-1776.png) | ![Zukunftsgarten](screenshots/zukunft.png) |

## Zwei Grafikstile: Remastered und Klassisch

Mit **F1**, **P**, dem Knopf „Pixel“ oder dem rechten Stick am Controller schaltest du jederzeit um – wie in der Remastered-Fassung des Originals. Im klassischen Modus zeichnet ein eigener Software-Renderer jeden Raum, jede Figur und jedes Objekt neu als VGA-Pixel-Art auf 320×200 – im Stil von Simon the Sorcerer und dem Original-DOTT: harte Kanten, Licht von links oben mit Farbrampen (kühle Schatten, warme Lichter), gerasterte Übergänge, gemalte Hintergründe und farbige Konturen. Die Musik klingt dann wie eine alte Soundkarte.

| Remastered | Klassisch |
|---|---|
| ![Hotspot-Anzeige im HD-Modus](screenshots/hotspots.png) | ![Labor als VGA-Pixel-Art](screenshots/klassisch-labor.png) |
| ![Labor in HD](screenshots/labor.png) | ![Palast als VGA-Pixel-Art](screenshots/klassisch-palast.png) |

## Features

- Klassische Verb-Steuerung im Stil der SCUMM-Adventures (Gib, Nimm, Benutze, Öffne, Schau an, Drücke, Schließe, Rede mit, Ziehe)
- 3 spielbare Figuren in 3 Zeitebenen und 7 Räumen, Wechsel mit Zeitstrudel-Effekt
- Zeitreise-Rätsel: Was du 1776 tust, verändert die Zukunft
- Dialogbäume mit Dr. Fred, Grünem Tentakel, Oma Gertrude, John Hancock, der Tentakel-Wache und Lila Tentakel
- **Steuerung mit Maus, Touch, Tastatur oder Xbox-Controller** (auch in Edge auf der Xbox), mit Vibration
- **Vollbild** startet automatisch, auf dem Handy mit Querformat-Sperre
- 10 Erfolge, Fortschrittsanzeige, Statistik am Ende, Hotspot-Anzeige, Tipp-System
- Prozedurale Grafik (Canvas 2D) und Musik (WebAudio-Synthesizer) mit eigenen Themen pro Zeitalter, Umgebungsgeräuschen, Schritten je nach Boden und Plapperstimmen pro Figur
- Optionale Sprachausgabe über die Browser-Stimmen (Web Speech API)
- Automatisches Speichern im Browser

## Steuerung

| Aktion | Maus / Tastatur | Touch | Xbox-Controller |
|---|---|---|---|
| Zeiger bewegen | Maus · Pfeiltasten springen | – | Linker Stick · Steuerkreuz springt |
| Aktion | Klick · Enter | Tippen | A |
| Standard-Aktion | Rechtsklick | Lange drücken | X |
| Zurück / Text überspringen | Esc · Punkt | Tippen | B |
| Verb wählen | Klick · G N B O S D C R Z | Tippen | LT / RT |
| Figur wechseln | Gesichter · 1–3 | Gesichter | LB / RB |
| Hotspots zeigen | Tab · Leertaste | „Zeigen“ | Ansicht |
| Tipp | H · „Tipp“ | „Tipp“ | Y |
| Pixel-Grafik | F1 · P | „Pixel“ | Rechter Stick |
| Vollbild | F | Symbol oben rechts | – |
| Menü | Esc | „Menü“ | Menü |

Gegenstände schickst du am Chrono-Klo durch die Zeit: **Gib** → Gegenstand → Gesicht unten rechts.

<details>
<summary><strong>Komplettlösung (Spoiler!)</strong></summary>

1. **Bernard:** In der Lobby die Zuckerdose nehmen, das Sofa durchsuchen (Münze), Münze in den Kaffeeautomaten.
2. **Bernard:** Im Labor den Würfelzucker an Hoagie und den Kaffee an Laverne schicken.
3. **Hoagie:** Gertrude den Zucker geben, sie backt das Freundlichkeits-Brot. Apfel aus der Schale nehmen und essen.
4. **Hoagie:** Im Garten die Schaufel nehmen, ein Loch ins Beet graben, Apfelbutzen pflanzen, Eimer am Brunnen füllen und gießen.
5. **Hoagie:** Das Brot vom Plumpsklo an Bernard schicken.
6. **Laverne:** Auf den neuen Apfelbaum klettern, Energiezelle holen und an Bernard schicken. Der Wache im Palast den Kaffee geben.
7. **Bernard:** Energiezelle und Brot in den Gut-O-Mat, Regler auf GUT drehen, Hebel ziehen, Toast an Laverne schicken.
8. **Laverne:** Im Thronsaal Lila den Toast geben.

Bonus: Hoagie kann seine Drumsticks 1776 in die Standuhr legen. Bernard findet sie in der Gegenwart – und der Grüne Tentakel weiß, was man damit macht.
</details>

## Technik

Reines HTML5 + JavaScript ohne Build-Schritt und ohne Abhängigkeiten (nur Google Fonts).

```
index.html      Einstieg
js/draw.js      Zeichenhelfer, Figuren, Inventar-Icons
js/pixel.js     Pixel-Renderer für den Klassik-Modus (Software-Rasterizer mit Canvas-API)
js/audio.js     WebAudio-Musik, Effekte, Umgebung, Schritte, Plapperstimmen, Sprachausgabe
js/rooms.js     Räume, Hintergründe, Hotspots, Effekte
js/engine.js    Verben, Laufen, Dialoge, Zeitreise-Post, Eingabe (Maus/Touch/Controller), Vollbild, Erfolge, Speichern, Rendering
js/story.js     Figuren, Gegenstände, Rätsel, Dialoge, Zwischensequenzen
```

Lokal starten:

```bash
python -m http.server 8000
```

Dann http://localhost:8000 öffnen.

## Rechtliches

Fan-Projekt ohne kommerzielle Absicht. Nicht verbunden mit LucasArts, Disney oder Double Fine. *Day of the Tentacle* und die Figuren sind Eigentum der jeweiligen Rechteinhaber. Geschichte, Rätsel, Dialoge, Code, Grafik und Musik dieses Spiels sind neu geschrieben; es werden keine Original-Assets verwendet.

Der Quellcode steht unter der MIT-Lizenz (siehe `LICENSE`).
