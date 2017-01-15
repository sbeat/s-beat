# S-BEAT - Studenten Beratungs- und Analysetool

This Software is currently aimed towards a German audience, sorry.

<a href="http://s-beat.de"><img src="https://s-beat.p-stats.com/img/sbeat_logo_klein.png" align="left" hspace="10" vspace="6"></a>

> Das Studenten Beratungs- & Analysetool S-BEAT ist ein Werkzeug, welches sich insbesondere an die beratenden Stellen einer Hochschule richtet.
Durch seine detaillierte und übersichtliche Darstellung liefert es aber auch Studiendekanen wichtige und interessante Einblicke in die Studiengänge und weitergehende Analysemöglichkeiten.
Zentraler Punkt der Software ist die Möglichkeit, kritische Studienverläufe frühzeitig automatisiert zu erkennen, um Studenten gezielt beraten und Gegenmaßnahmen ergreifen zu können. S-BEAT liefert hierfür einen Risikowert, der Auskunft darüber gibt, wie hoch die Wahrscheinlichkeit für einen Studierenden ist, sein Studium nicht erfolgreich abzuschließen. Im Falle eines hohen Risikowertes bietet S-BEAT, in Form einer kausalen Analyse, vielfältige Möglichkeiten Rückschlüsse über mögliche Ursachen zu ziehen und steht somit für Nachvollziehbarkeit und Transparenz. 

S-BEAT ist eine Web-Software. Sie besteht aus dem Backend, welches ein Webserver ist, und aus dem in HTML, CSS und JS geschrieben Frontend.

Es wird MongoDB für die Speicherung von Daten verwendet. Ein Reverse-Proxy (meistens Apache2) wird für die Benutzerauthentifizierung verwendet.


## Resourcen

* [Projekt-Webseite](http://s-beat.de)

## Anleitungen

* [Installation unter Debian](INSTALL_DEBIAN.md)
* [Einrichtung der Entwicklungsumgebung](INSTALL_DEV.md)

## Voraussetzungen

S-BEAT kann sowohl auf Windows als auch auf Linux ausgeführt werden. Für den produktiven Betrieb wird Linux Debian 8+ amd64 empfohlen.

* Freier Festplattenspeicher: mind. 4GB
* Arbeitsspeicher: mind. 1GB
* Python 2.x
* MongoDB 3+

Für den produktiven Betrieb muss ein Webserver als Reverse-Proxy vorgeschaltet werden. Z.B. Apache2. Dieser übernimmt die SSL Verschlüsselung und die Authentifizierung der Benutzer.

Für den Zugriff auf die Weboberfläche wird ein moderner Web-Browser, welcher mit HTML5, CSS3 & JavaScript umgehen kann, benötigt.


## Lizenz

S-BEAT ist unter der GPLv3 lizenziert. Siehe [Lizenzinformationen](LICENSE.md)
