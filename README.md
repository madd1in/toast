# Tentakel-Toast

**Ein inoffizielles Day-of-the-Tentacle-Fanspiel – direkt im Browser.**

▶ **Jetzt spielen:** https://madd1in.github.io/tentakel-toast/

![Titelbild](screenshots/titel.png)

Fünf Jahre nach dem großen Tentakel-Tag hat Dr. Fred seine größte Erfindung gebaut: den **Gut-O-Mat**. Ein Toast daraus macht selbst den bösesten Schurken lieb und nett. Blöd nur, dass Lila Tentakel durchs Chrono-Klo abgehauen ist, die Energiezelle geklaut und das letzte Freundlichkeits-Brot gefressen hat.

Jetzt müssen **Bernard** (Gegenwart), **Hoagie** (Jahr 1776) und **Laverne** (Zukunft) zusammenarbeiten und sich Gegenstände per Chrono-Klo durch die Zeit schicken.

| Gegenwart | 1776 | Zukunft |
|---|---|---|
| ![Labor](screenshots/labor.png) | ![Gasthaus](screenshots/gasthaus-1776.png) | ![Zukunftsgarten](screenshots/zukunft.png) |

## Features

- Klassische Verb-Steuerung im Stil der SCUMM-Adventures (Gib, Nimm, Benutze, Öffne, Schau an, Drücke, Schließe, Rede mit, Ziehe)
- 3 spielbare Figuren in 3 Zeitebenen und 7 Räumen, Wechsel per Klick auf die Gesichter
- Zeitreise-Rätsel: Was du 1776 tust, verändert die Zukunft
- Dialogbäume mit Dr. Fred, Grünem Tentakel, Oma Gertrude, John Hancock, der Tentakel-Wache und Lila Tentakel
- Komplett prozedurale Grafik (Canvas 2D) und Musik (WebAudio-Synthesizer), keine externen Assets
- Optionale Sprachausgabe über die Browser-Stimmen (Web Speech API)
- Automatisches Speichern im Browser, Tipp-System, funktioniert auch auf Tablet und Handy

## Steuerung

| Aktion | So geht's |
|---|---|
| Hinlaufen | Ohne Verb irgendwo hinklicken |
| Aktion | Verb anklicken, dann Gegenstand oder Person |
| Standard-Aktion | Rechtsklick (das hervorgehobene Verb) |
| Kombinieren | „Benutze X mit Y“, „Gib X an Y“ |
| Durch die Zeit schicken | Am Chrono-Klo: „Gib“ → Gegenstand → Gesicht unten rechts |
| Figur wechseln | Gesichter unten rechts oder Tasten 1–3 |
| Text überspringen | Klick oder `.` · Szene überspringen: `Esc` |
| Tipp | Button „Tipp“ oder Grünen Tentakel fragen |

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

Bonus: Hoagie kann seine Drumsticks 1776 in die Standuhr legen. Bernard findet sie in der Gegenwart wieder.
</details>

## Technik

Reines HTML5 + JavaScript ohne Build-Schritt und ohne Abhängigkeiten (nur Google Fonts).

```
index.html      Einstieg
js/draw.js      Zeichenhelfer, Figuren, Inventar-Icons
js/audio.js     WebAudio-Musik & Effekte, Sprachausgabe
js/rooms.js     Räume, Hintergründe, Hotspots
js/engine.js    Verben, Laufen, Dialoge, Zeitreise-Post, Speichern, Rendering
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
