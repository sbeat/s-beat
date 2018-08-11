# Datenspezifikation

Die Daten der Studenten und Prüfungsleistungsdaten für S-BEAT werden in Form von CSV Dateien auf der Weboberfläche von S-BEAT hochgeladen. Nachfolgend werden die verwendeten Datenformate und die Spalten der verschiedenen in S-BEAT verwendeten CSV Dateien spezifiziert.

## CSV Dateiformat

Alle CSV Dateien verwenden '`;`' (Semikolon) als Trennzeichen für die Spalten. Die Zeilen werden mit einem Windows-Zeilenumbruch CR-LF (`\r\n`) getrennt. Als Textbegrenzungszeichen werden `"` (Double quotes) verwendet. Die Feldnamen müssen in der ersten Zeile stehen. Die Groß-/Kleinschreibung der Feldnamen muss dabei nicht beachtet werden.
 
Die CSV Dateien können mit einem der nachfolgenden Zeichnkodierungen kodiert sein: '`windows-1252`', '`utf8`', '`cp437`', '`ascii`', '`latin_1`'
Die Windows-1252 Zeichenkodierung wird üblicherweise von deutschen Microsoft Access und Excel Programmen beim Export von CSV bzw. Textdaten verwendet.
Alle CSV Dateien müssen die gleiche Zeichnkodierungen haben.

## Datumsformate

Für Datumsangaben sind zwei verschiedene Formate zulässig.

### Format 1: `TT.MM.YYYY`

TT ist der Monatstag mit führender Null bei Zahlen unter 10. MM ist die Monatszahl mit führender Null bei Zahlen unter 10. YYYY ist die vierstellige Jahreszahl.

### Format 2: `TT-MMM-YY`

TT steht hierbei für den zweistelligen Tag des Monats. MMM bezeichnet die ersten drei Buchstaben des deutschen Monatsnamens, wobei Umlaute übersprungen werden. YY steht für die zweistellige Schreibweise der Jahreszahl.
Ist die Jahreszahl kleiner 40 wird angenommen, dass es sich um ein Jahr nach 2000 handelt. Ist die Jahreszahl größer oder gleich 40 wird angenommen es handelt sich um ein Jahr vor 2000.

Es wird empfohlen das Format 1 zu verwenden, um Ungenauigkeiten bei der Jahreszahl zu vermeiden.


## Studentendaten CSV Datei

Die Daten von Studenten liegen in anonymisierter Form vor. Jedem Student ist eine Identifikationsnummer (IDENTNR) zugeordnet, welche nur von ausgesuchten Personen auf die Matrikel-Nr. und die persönlichen Daten des Studenten zurückgeführt werden kann. Für diese Deanonymisierung sind die Identifikationsdaten notwendig. Die Felder der Identifikationsdaten können auch als Spalten der Studentendaten geliefert werden.

### Spalten

Neben den folgenden Spalten, können die aus den Studentenidentifikationsdaten ebenfalls verwendet werden.

#### `IDENTNR`

Identifikationsnummer eines Studenten


#### `STG`

Studiengangskürzel


#### `IMMDAT`

Immatrikulationsdatum (Datumsfeld)


#### `EXMDAT`

Exmatrikulationsdatum (Datumsfeld)


#### `SEM_START`

Optional: Startsemester in Form <Jahr><1=SoSe oder 2=WiSe>. Wenn diese Spalte nicht gegeben ist, wird das Startsemester aus `IMMDAT` berechnet.

Beispiel: SoSe 2017: `20171`, WiSe 17/18: `20172`

#### `SEM_END`

Optional: Endsemester in Form <Jahr><1=SoSe oder 2=WiSe>. Wenn diese Spalte nicht gegeben ist, wird das Endsemester aus `EXMDAT` berechnet.

#### `SPERRART1`

Befristet immatrikuliert (bei dem Wert 01, wird der Eintrag nicht importiert)


#### `PNR`

=8000, wenn Abschluss erhalten, sonst leer.
Kann mit der Einstellung 'PNR der Thesis' allgemein oder pro STG konfiguriert werden. Wenn der Wert mit der konfigurierten Nummer übereinstimmt, wird ein erfolgreicher Abschluss angenommen.


#### `PDATUM`

Datum der Abschlussprüfung (Datumsfeld)


#### `GESCHL`

Geschlecht (M oder W)


#### `GEBDAT`

Geburtsdatum (Datumsfeld)


#### `HZBNOTE`

Hochschulzugangsberechtigungsnote (Hinweis: ist das Feld leer oder eine Note von 9.9 eingetragen bedeutet das, dass keine solche vorliegt.)


#### `HZBDATUM`

Hochschulzugangsberechtigungsdatum (Datumsfeld)

#### `HZBGRP`

Die Hochzugangsberechtigungsgruppe, welche statt der HZBART verwendet werden kann. (Optional, wenn HZBART gegeben ist)

#### `HZBART` <small>(veraltet, bitte `HZBGRP` nutzen)</small>

Nummer der Hochschulzugangsberechtigungsart. (Optional, wenn HZBGRP gegeben ist)
Die Nummer wird über die [mappings.json](data/mappings.default.json) eine der folgenden Hochschulzugangsberechtigungsgruppen zugeordnet: 

* Abitur = Allgemeine Hochschulreife 
* Ausland = Im Ausland erworbene Hochschulzugangsberechtigung 
* Beruf = Studienberechtigung ohne formale Hochschulreife 
* F-Abitur = Fachgebundene Hochschulreife 
* FH-Reife = Fachhochschulreife 
* Kolleg = Fachhochschulreife Kolleg






## Prüfungsleistungsdaten CSV Datei

Die Prüfungsleistungsdaten werden während des Studiums erfasst und werden jedes Semester aktualisiert.

### Spalten

#### `IDENTNR`

Identifikationsnummer des Studenten


#### `PNR`

EDV Nummer der Leistung


#### `PDTXT`

Name der Leistung


#### `ABSCHLART`

Art des Abschlusses auf den diese Leistung angerechnet wird (Optional, wenn ABSCHL gegeben ist):

* Diplom
* Master
* Zusatzausbildung
* Bachelor


#### `ABSCHL` <small>(veraltet, bitte `ABSCHLART` verwenden)</small>

Nummer der Abschlussart (Optional, wenn ABSCHLART gegeben ist): 

* 51=Diplom
* 90=Master
* 59=Zusatzausbildung
* 84=Bachelor

Die Nummer wird über die [mappings.json](data/mappings.default.json) zugeordnet.

#### `STG`

Studiengangskürzel


#### `PSEM`

Semester in welchem die Leistung abgelegt wurde. Das Semester wird im Format `YYYYS` angegeben. `YYYY` ist die vierstellige Jahreszahl. `S` ist 1 bei einem Sommersemester und ist 2 für Wintersemester, die in dem mit `YYYY` angegebenen Jahr starten.


#### `BONUS`

Anzahl der ECTS Punkte bzw. Credit Points für diese Leistung


#### `NACHNAME`

Nachname des Prüfers (Optionales Feld)


#### `VORNAME`

Vorname des Prüfers (Optionales Feld)


#### `PSTATUS`

Status: 

* AN = Angemeldet 
* BE = Bestanden 
* NB = Nicht bestanden 
* EN = Endgültig nicht bestanden


#### `PART`

Art: 

* PL = Prüfungsleistung 
* PV = Prüfungsvorleistung 
* VS = Vorleistung zur Zwischenprüfung bzw. Bachelorarbeit


#### `PNOTE`

Note der Leistung in dreistelliger Zahlenform als Integer bzw. das Hundertfache der Kommanote.


#### `PVERMERK`

Vermerk: 

* G = Genehmigter Rücktritt 
* U = Unentschuldigter Rücktritt 
* RT = Rücktritt (SB-Funktionen)

Bei status=AN und vermerk=G, wird der Rücktritt als genehmigt gezählt. Bei status=AN und vermerk=U, wird der Rücktritt als unentschuldigt gezählt.  Bei status=AN und vermerk=RT, wird nur ein Rücktritt ohne Wertung gezählt.

#### `PVERSUCH`

Nr. des Versuchs


#### `PFORM`

Form:

* A = Anwesenheitspflicht (mit definierter Mindestquote)
* BA = Bachelorarbeit
* EN = Entwurf (z.B. Erstellen einer techn. Zeichnung)
* HA = Hausarbeit
* KL = Klausurarbeit
* LA = Laborarbeit
* LT = Lerntagebuch
* LÜ = Laborübungen
* MP = Mündliche Prüfung
* N = Sonderform 
* PA = Praktische Arbeit
* PP = Praktische Arbeit und Präsentation
* PS = Praktisches Studiensemester
* RE = Referat 
* SP = Praktische Arbeit (hoher Kreativanteil & besondere Arbeitsumgebung Studio/Atelier)
* ST = Studienarbeit
* TE = Theoretisch-empirische Arbeit

Oder jede andere Abkürzung


#### `PANERK`

* J = ist anerkannte Leistung
* N = ist keine anerkannte Leistung


#### `PFLICHT`

Bereich der Leistung:

* P = Pflichtfach
* W = Wahlpflichtfach
* WA = Wahlpflichtfach anderer Studiengang
* Z = Zusatzfach


#### `PABSCHN`

Studiumsabschnitt welchem die Prüfung zugeordnet wird:

* G = Grundstudium
* H = Hauptstudium


#### `PVERSION`

SPO Version der Prüfungsleistung (Optional)


### Hinweise

Auf Basis der Prüfungsleistungsdaten berechnet S-BEAT die gewichteten Durchschnittsnoten der Studenten. Dies kann nicht komplett erfolgen, da die Bachelor Thesis nicht in den Daten enthalten ist. Jedoch ist die Abschlussnote in den Daten enthalten, in welche die Bachelor Thesis bereits einberechnet wurde.
Vor dem Import jeder Datei, wird geprüft welche Semester in der Datei vorkommen. Die Anmeldungen dieser Semester werden vor dem Import aus der Datenbank gelöscht.


## Studentenidentifikationsdaten CSV Datei

Die Identifikationsdaten enthalten die persönlichen Daten der Studenten und können nur von berechtigten Benutzern eingesehen werden.
Diese Daten sind optional. Es wird nicht vorausgesetzt, dass diese ins System importiert werden.
Alternativ können die nachfolgenden Felder auch als Teil der Studentendaten geliefert werden. Dann muss die Einstellung *Studentendaten inkl. ident. Daten* aktiviert werden.

### Spalten

#### `IDENTNR`

Identifikationsnummer eines Studenten


#### `MATRIKELNR`

Matrikel-Nr. eines Studenten (alternativ `MTKNR`)


#### `VORNAME`

Vorname des Studenten


#### `NACHNAME`

Nachname des Studenten


#### `KUERZEL`

Kürzel bzw. Benutzername des Studenten (Optionales Feld)


#### `EMAIL`

E-Mail des Studenten


#### `LAND`

Herkunftsland des Studenten (Optionales Feld)


#### `PLZ`

Postleitzahl des Wohnorts des Studenten (Optionales Feld)


#### `STANG`

Staatsangehörigkeit des Studenten (Optionales Feld)


#### `EU`

Ist der Studierende ein EU Bürger (J/N) (Optionales Feld)



## Studiengangsdaten CSV Datei

Damit Namen, Regelstudienzeit, Fakultäts-Nr. und Abschlussart zu einem Studiengangskürzel ausgegeben werden kann, wird eine Liste mit Studiengängen benötigt.


### Spalten

#### `STG`

Studiengangskürzel, welches auch in der Spalte STG der Studentendaten und Studienleistungsdaten verwendet wird.


#### `GRUPPE`

Die Studiengangsgruppe. (Optionales Feld)
Wenn die Gruppe nicht angegeben ist, wird eine eigene Gruppe für STG erstellt.


#### `ABSCHLART`

Bezeichnung der Abschlussart (Optional, wenn ABSCHL gegeben ist):
* Diplom
* Master
* Zusatzausbildung
* Bachelor


#### `ABSCHL` <small>(veraltet, bitte `ABSCHLART` nutzen)</small>

Nummer der Abschlussart (Optional, wenn ABSCHLART gegeben ist):
* 51=Diplom
* 90=Master
* 59=Zusatzausbildung
* 84=Bachelor

Die Nummer wird über die [mappings.json](data/mappings.default.json) zugeordnet.


#### `LTXT`

Ausführlicher Name des Studiengangs


#### `KTXT`

Kurzname des Studiengangs


#### `FB`

Nummer des Fakultätsbereichs


#### `REGELSTZ`

Anzahl der Semester der Regelstudienzeit


### Hinweise

Studiengänge, welche nicht eine der eingestellten Abschlussarten (Erlaubte Abschlussarten bei Studiengängen) haben, werden beim Import ignoriert.


## Bewerberdaten CSV Datei

Die Bewerberdaten erhalten alle Bewerbungen. Somit sollten in einem Semester mindestens so viele Einträge vorhanden sein, wie in den Studentendaten.

### Spalten

#### `IDENTNR`

Identifikationsnummer des Bewerbers

#### `STG`

Studiengangskürzel


#### `GESCHL`

Geschlecht (M oder W)


#### `GEBDAT`

Geburtsdatum (Datumsfeld)


#### `HZBNOTE`

Hochschulzugangsberechtigungsnote (Hinweis: eine Note von 9.9 oder eine leere Zelle bedeutet hier, dass keine Note vorliegt.)


#### `HZBDATUM`

Hochschulzugangsberechtigungsdatum (Datumsfeld)


#### `HZBART` <small>(veraltet)</small>

Nummer der Hochschulzugangsberechtigungsart. (Optional wenn HZBGRP gegeben ist)
Die Nummer wird über die [mappings.json](data/mappings.default.json) eine der folgenden Hochschulzugangsberechtigungsgruppen zugeordnet: 

* Abitur = Allgemeine Hochschulreife 
* Ausland = Im Ausland erworbene Hochschulzugangsberechtigung 
* Beruf = Studienberechtigung ohne formale Hochschulreife 
* F-Abitur = Fachgebundene Hochschulreife 
* FH-Reife = Fachhochschulreife 
* Kolleg = Fachhochschulreife Kolleg


#### `HZBGRP`

Die Hochzugangsberechtigungsgruppe, welche statt der HZBART verwendet werden kann. (Optional wenn HZBART gegeben ist)


#### `APPLDAT`

Bewerbungsdatum (Datumsfeld)


#### `SEM`

Semester für welches die Bewerbung zugerechnet werden soll. Das Semester wird im Format `YYYYS` angegeben. `YYYY` ist die vierstellige Jahreszahl. `S` ist 1 bei einem Sommersemester und ist 2 für Wintersemester, die in dem mit `YYYY` angegebenen Jahr starten.

Optionales feld. Wenn die Spalte nicht enthalten ist, wird das Folgesemester des aus dem `APPLDAT` hergeleiteten Semester verwendet.


#### `ZULDAT`

Zulassungdatum (Datumsfeld). Ist leer, wenn keine Zulassung erfolgt ist.


#### `VORNAME`

Vorname des Studenten  (Optionales Feld)


#### `NACHNAME`

Nachname des Studenten  (Optionales Feld)


#### `KUERZEL`

Kürzel bzw. Benutzername des Studenten (Optionales Feld)


#### `EMAIL`

E-Mail des Studenten  (Optionales Feld)


#### `LAND`

Herkunftsland des Studenten (Optionales Feld)


#### `PLZ`

Postleitzahl des Wohnorts des Studenten (Optionales Feld)


#### `STANG`

Staatsangehörigkeit des Studenten (Optionales Feld)


#### `EU`

Ist der Studierende ein EU Bürger (J/N) (Optionales Feld)


