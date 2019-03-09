// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function SettingsManager(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingsDOM = $(document.createElement('div'));
	this.data = null; // Last loaded data
	this.drawn = false;

	this.settings = {
		'path_min_support': {
			type: 'float',
			name: 'Minimaler Support',
			desc: 'Minimaler Support für Pfadgenerierung als Wert zwischen 0 und 1',
			group: 'Pfadgenerierung',
			defaultVal: 0.05
		},
		"path_min_confidence": {
			type: 'float',
			name: 'Minimale Confidence',
			desc: 'Minimale Confidence für Pfadgenerierung als Wert zwischen 0 und 1',
			group: 'Pfadgenerierung',
			defaultVal: 0.01
		},
		"path_max_k": {
			type: 'int',
			name: 'Maximale Dimension',
			desc: 'Maximale Dimension für den Algorithmus',
			group: 'Pfadgenerierung',
			defaultVal: 10
		},
		"path_min_students": {
			type: 'int',
			name: 'Minimale Studentenzahl',
			desc: 'Minimale Anzahl Studenten, die auf die Filterbedingungen eines Pfades passen müssen.',
			group: 'Pfadgenerierung',
			defaultVal: 50
		},
		"lights": {
			type: 'lights',
			name: 'Ampel Grenzwerte',
			desc: 'Startwerte für die Ampelanzeige des Risikos eines Studenten',
			group: 'Risikoanzeige',
			defaultVal: [0, 0.4, 0.7],
			perStg: true
		},
		"risk_value_(.+)": {
			type: 'boolean',
			name: 'Risikowerte anzeigen für Gruppe $1',
			desc: 'Können Benutzer der Gruppe $1 die Risikowerte sehen.',
			group: 'Risikoanzeige'
		},
		"course_allowed_degree_types": {
			type: 'list',
			name: 'Erlaubte Abschlussarten bei Studiengängen',
			desc: 'Liste der Abschlussarten (z.B. Bachelor, Master), welche beim Import von Studiengängen nicht ignoriert werden.',
			group: 'Import',
			defaultVal: ['Bachelor']
		},
		"ignore_exam_numbers": {
			type: 'list',
			name: 'Ignorierte Prüfungsnummern',
			desc: 'Liste der Prüfungsleistungen, welche beim Import nicht importiert werden sollen. Eingabe einer Nummer oder eines Bereichs, z.B.: 1-22, 23',
			group: 'Import',
			perStg: true
		},
		"final_exam_numbers_ba": {
			type: 'list',
			name: 'PNR der Thesis',
			desc: 'Mit dieser Nummer wird die Abschlussprüfung in den importierten Studentendaten erkannt.',
			group: 'Import',
			perStg: true
		},
		"grade_exam_number": {
			type: 'int',
			name: 'PNR der Abschlussnote',
			desc: 'Mit dieser Nummer wird die Abschlussnote in den importierten Prüfungsleistungen erkannt.',
			group: 'Import',
			perStg: true
		},
		"min_semester": {
			type: 'int',
			name: 'Minimales Semester',
			desc: 'Das minimal erlaubte Semester für Studenten- und Prüfungsleistungsdaten.',
			group: 'Import',
			defaultVal: 20042,
			perStg: true
		},
		"max_valid_cp": {
			type: 'int',
			name: 'Maximale CP eines Studenten',
			desc: 'Wenn die maximalen CP überschritten werden, wird der Student nicht importiert.',
			group: 'Import',
			defaultVal: 220,
			perStg: true
		},
		"import_ident_from_students": {
			type: 'boolean',
			name: 'Studentendaten inkl. ident. Daten',
			desc: 'Sind die Spalten für die identifizierenden Daten in den Studentendaten enthalten und sollen von dort importiert werden?',
			group: 'Import',
			defaultVal: false
		},
		"import_applicants": {
			type: 'boolean',
			name: 'Bewerberdaten-Import',
			desc: 'Sollen Bewerberdaten importiert werden?',
			group: 'Import',
			defaultVal: false
		},
		"unique_exam_info_id": {
			type: 'list',
			name: 'Eindeutige ID eines Prüfungsmoduls',
			desc: 'Die Felder aus welchen sich die eindeutige ID eines Prüfungsmoduls ergeben.',
			group: 'Import'
		},
		"unique_exam_id": {
			type: 'list',
			name: 'Eindeutige ID einer Prüfungsleistung',
			desc: 'Die Felder aus welchen sich die eindeutige ID einer angemeldeten Prüfungsleistung ergeben.',
			group: 'Import'
		},
		"student_ident_string": {
			type: 'boolean',
			name: 'Studenten-ID als String',
			desc: 'Soll die IDENTNR aus den Studentendaten, Bewerberdaten und Identifikationsdaten als String importiert werden?',
			group: 'Import',
			defaultVal: false
		},
		"unique_student_id": {
			type: 'list',
			name: 'Eindeutige ID eines Studiums',
			desc: 'Die Datenbankfelder aus welchen sich die eindeutige ID eines Studiums ergibt. Wenn diese Einstellung vom Standard abweicht, wird ein separater Identifikationsdatenimport nicht unterstützt.',
			group: 'Import',
			defaultVal: ['ident_original']
		},
		"use_preferred_paths": {
			type: 'boolean',
			name: 'Risiko auf Basis bevorzugter Risikokriterien berechnen',
			desc: 'Risikokriterien welche aus den gleichen Feldern bestehen werden nur noch einmal verwendet.',
			group: 'Risikoberechnung'
		},
		"generate_risk_group_all": {
			type: 'boolean',
			name: 'Risiko für alle Studenten berechnen',
			desc: 'Es wird ein Risikowert für alle Studenten berechnet',
			group: 'Risikoberechnung',
			defaultVal: true
		},
		"generate_risk_group_stg": {
			type: 'boolean',
			name: 'Risiko nach Studiengang berechnen',
			desc: 'Es wird ein Risikowert für jeden Studenten in seinem Studiengang berechnet. Dies kann ' +
			'den Updatevorgang erheblich verlängern.',
			group: 'Risikoberechnung',
			defaultVal: false
		},
		"generate_risk_group_degree": {
			type: 'boolean',
			name: 'Risiko nach Abschluss berechnen',
			desc: 'Es wird ein Risikowert für jeden Studenten in seiner Abschlussgruppe berechnet. Dies kann ' +
			'den Updatevorgang erheblich verlängern.',
			group: 'Risikoberechnung',
			defaultVal: false
		},
		"main_risk_group": {
			type: 'string',
			name: 'Hauptrisikowert',
			desc: 'Der Risikowert, welcher als Risiko in den Studentendaten verwendet wird.',
			group: 'Risikoberechnung',
			selectItems: ['all', 'stg', 'degree'],
			defaultVal: 'all'
		},
		"min_stg_students": {
			type: 'int',
			name: 'Minimale Studentenzahl im Studiengang',
			desc: 'Die minimale Anzahl Studenten, die einen Studiengang abgeschlossen haben müssen, ' +
			'bevor ein eigener Risikowert für den Studiengang berechnet wird.',
			group: 'Pfadgenerierung',
			defaultVal: 200
		},
		"risk_ignore_recognized_exams": {
			type: 'boolean',
			name: 'Anerkannte Leistungen ignorieren',
			desc: 'Sollen bei der Berechnung anerkannte Prüfungsleistungen ignoriert werden?',
			group: 'Risikoberechnung'
		},
		"contact_software": {
			type: 'string',
			name: 'Software Kontakt',
			desc: 'Kontaktperson bei Fragen zur Software im Format: email,name',
			group: 'Kontakt',
			defaultVal: 'kontakt@s-beat.de,Team S-BEAT'
		},
		"contact_hosting": {
			type: 'string',
			name: 'Hosting Kontakt',
			desc: 'Kontaktperson bei Fragen zum Hosting im Format: email,name',
			group: 'Kontakt'
		},
		"contact_data": {
			type: 'string',
			name: 'Datenupdate Kontakt',
			desc: 'Kontaktperson bei Fragen zum Datenupdate im Format: email,name',
			group: 'Kontakt'
		},
		"compare_averages": {
			type: 'boolean',
			name: 'Student mit Durchschnitt vergleichen',
			desc: 'Auf der Studentendetailseite werden die Semesterwerte und Prüfungsleistungen mit dem Durchschnitt verglichen',
			group: 'Anzeige'
		},
		"cp_label": {
			type: 'string',
			name: 'Bezeichnung für Credit Points',
			desc: 'Wie sollen die Credit Points bezeichnet werden? Beispiele: ECTS, CP, Bonus',
			defaultVal: 'ECTS',
			group: 'Anzeige'
		},
		"hide_resigned": {
			type: 'boolean',
			name: 'Rücktrittsanalysen verstecken',
			desc: 'Sollen Rücktritte und Rücktrittsquoten versteckt werden. Z.B. weil dies in den Daten nicht feststellbar ist.',
			group: 'Anzeige'
		},
		"hide_finished_ident_data": {
			type: 'boolean',
			name: 'Ident. Daten von exmat. verstecken',
			desc: 'Sollen indentifizierende Daten bei exmatrikulierten Studenten ausgeblendet werden?',
			group: 'Anzeige'
		},
		"hide_finished_after_days": {
			type: 'int',
			name: 'Tage bis exmat. versteckt werden',
			desc: 'Nach wievielen Tagen vom aktuellen Zeitpunkt aus sollen exmatrikulierte Studierende ausgeblendet werden? -1 für nie',
			group: 'Anzeige'
		},
		"update_manual_apply": {
			type: 'boolean',
			name: 'Update manuell übernehmen',
			desc: 'Sollen die Daten nach einem Update manuell von einem Administrator in den Produktivstand übernommen werden?',
			defaultVal: false,
			group: 'Import'
		},
		"import_encoding": {
			type: 'string',
			name: 'Datei Kodierung',
			desc: 'Mit welchem Zeichensatz sind die CSV Dateien kodiert?',
			selectItems: ['windows-1252', 'utf8', 'cp437', 'ascii', 'latin_1'],
			defaultVal: 'windows-1252',
			group: 'Import'
		},
		"hide_exam_date": {
			type: 'boolean',
			name: 'Prüfungsleistungsdatum ausblenden',
			desc: 'Soll die Datumsspalte bei Prüfungsleistungsdaten ausgeblendet werden?',
			defaultVal: true,
			group: 'Anzeige'
		},
		"always_display_all_courses": {
			type: 'boolean',
			name: 'Anzeige aller Studiengänge für eingeschr. User',
			desc: 'Sollen alle Studiengänge für eingeschränkte Benutzer angezeigt werden? Studenten von eingeschränkten Studiengangsgruppen bleiben für diese User nicht sichtbar.',
			defaultVal: false,
			group: 'Anzeige'
		},
		"hide_median_risk": {
			type: 'boolean',
			name: 'Median Risikowert ausblenden',
			desc: 'Soll der unskalierte Median Risikowert für einen Studierenden ausgeblendet werden?',
			defaultVal: false,
			group: 'Anzeige'
		},
		"hide_student_fields": {
			type: 'list',
			name: 'Student Felder ausblenden',
			desc: 'Liste der technischen Felder, welche ausgeblendet werden sollen. Z.B. weil diese Daten nicht verfügbar sind.',
			group: 'Anzeige'
		},
		"hide_applicant_fields": {
			type: 'list',
			name: 'Bewerber Felder ausblenden',
			desc: 'Liste der technischen Felder, welche ausgeblendet werden sollen. Z.B. weil diese Daten nicht verfügbar sind.',
			group: 'Anzeige'
		},
		"hide_exam_fields": {
			type: 'list',
			name: 'Prüfungsfelder ausblenden',
			desc: 'Liste der technischen Felder, welche ausgeblendet werden sollen. Z.B. weil diese Daten nicht verfügbar sind.',
			group: 'Anzeige'
		},
		"sv_show_risk_value": {
			type: 'boolean',
			name: 'Risikwert anzeigen',
			desc: 'Soll der Risikowert angezeigt werden?',
			defaultVal: false,
			group: 'Studierendenansicht'
		},
		"sv_hide_student_fields": {
			type: 'list',
			name: 'Student Felder ausblenden',
			desc: 'Liste der technischen Felder, welche ausgeblendet werden sollen. Z.B. weil diese Daten nicht verfügbar sind.',
			group: 'Studierendenansicht'
		},
		"sv_hide_exam_fields": {
			type: 'list',
			name: 'Prüfungsfelder ausblenden',
			desc: 'Liste der technischen Felder, welche ausgeblendet werden sollen. Z.B. weil diese Daten nicht verfügbar sind.',
			group: 'Studierendenansicht'
		},
		"sv_compare_averages": {
			type: 'boolean',
			name: 'Student mit Durchschnitt vergleichen',
			desc: 'Auf der Studentendetailseite werden die Semesterwerte und Prüfungsleistungen mit dem Durchschnitt verglichen',
			group: 'Studierendenansicht'
		},
		"sv_max_risk_paths": {
			type: 'int',
			name: 'Maximale Anzahl Risikokriterien',
			desc: 'Maximale Anzahl der Risikokriterien, welche angezeigt werden.',
			group: 'Studierendenansicht'
		},
		"sv_text_top": {
			type: 'text',
			name: 'Text oben',
			desc: 'Text, welcher über den Daten des Studierenden angezeigt wird.',
			group: 'Studierendenansicht'
		},
		"sv_text_left": {
			type: 'text',
			name: 'Text links',
			desc: 'Text, welcher links unter den Personendaten angezeigt wird.',
			group: 'Studierendenansicht'
		},
		"sv_text_bottom": {
			type: 'text',
			name: 'Text unten',
			desc: 'Text, welcher unterhalb aller Daten angezeigt wird.',
			group: 'Studierendenansicht'
		}
	};

	SettingsManager.prototype.init.call(this);
}

/**
 * Gets called once this SettingsManager is initialized
 */
SettingsManager.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};
/**
 * Gets called every time the SettingsManager must be drawn completely
 */
SettingsManager.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.settingsDOM.addClass('settingslist');
		this.parentDOM.append(this.settingsDOM);

		this.drawn = true;
	}


	if (!this.data || !this.data['settings']) {
		this.settingsDOM.text('Keine Daten verfügbar');
		return;
	}

	var list = [];
	var groups = [];
	for (var key in this.data['settings']) {
		if (key.match(/:\w+?$/)) continue;
		list.push(key);
		var info = self.getSettingInfo(key);
		if (info && groups.indexOf(info.group) == -1) {
			groups.push(info.group);
		} else if (!info && groups.indexOf('Unbekannt') == -1) {
			groups.push('Unbekannt');
		}
	}
	groups.sort();
	list.sort(function (a, b) {
		var da = self.getSettingInfo(a);
		var db = self.getSettingInfo(b);
		if (!da && db) return 1;
		if (da && !db) return -1;
		if (!da && !db) return a < b ? -1 : 1;
		var namea = da.group + ' ' + da.name;
		var nameb = db.group + ' ' + db.name;
		if (namea < nameb) return -1;
		if (namea > nameb) return 1;
		return 0;

	});

	self.settingsDOM.empty();
	groups.forEach(function (group) {
		self.settingsDOM.append($('<h2/>').text(group));
		for (var i = 0; i < list.length; i++) {
			var key = list[i];
			var info = self.getSettingInfo(key);
			if (info && info.group != group) continue;
			if (!info && group != 'Unbekannt') continue;
			self.settingsDOM.append(self.drawSetting(key));
		}
	});


};
SettingsManager.prototype.getSettingInfo = function (name) {
	for (var pattern in this.settings) {
		var regExp = new RegExp('^' + pattern + '$');
		var m = name.match(regExp);
		if (m) {
			var rd = {};
			for (var key in this.settings[pattern]) {
				var value = this.settings[pattern][key];
				if (typeof(value) == 'string') {
					for (var i = 0; i < m.length; i++) {
						value = value.replace('$' + i, m[i]);
					}
				}

				rd[key] = value;
			}
			return rd;
		}
	}
	return null;
};
SettingsManager.prototype.findStgSettingValues = function (name) {
	var self = this;
	if (!self.data) return;
	var result = {};
	for (var key in self.data['settings']) {
		if (key.indexOf(name) == 0 && key.match(/:(\w+)$/)) {
			result[RegExp.$1] = self.data['settings'][key];
		}
	}
	return result;
};
SettingsManager.prototype.drawSetting = function (name) {
	var self = this;
	var value = self.data['settings'][name];
	var settingO = document.createElement('div');
	settingO.className = 'settingitem';
	settingO.infoData = value;

	var info = self.getSettingInfo(name);

	//$('<div class="group" />').text(info ? info.group : '-').appendTo(settingO);
	var nameO = $('<div class="name" />').text(info ? info.name : name).appendTo(settingO);
	var dataO = $('<div class="data" />').appendTo(settingO);
	var valueO = $('<div class="valueEntry" />').appendTo(dataO);
	valueO.append(self.drawValue(name));

	if (info && info.perStg) {
		var additionalValues = self.findStgSettingValues(name);
		for (var stg in additionalValues) {
			valueO = $('<div class="valueEntry" />').appendTo(dataO);
			$('<i/>').text(stg + ': ').appendTo(valueO);
			valueO.append(self.drawValue(name, stg));
		}
	}

	$('<div class="opt" />')
		.appendTo(nameO)
		.click(function (e) {
			self.drawSettingDialog(name);
		});


	return settingO;
};
/**
 * Outputting the value of a setting in readable form
 * @param name
 * @param [stg]
 */
SettingsManager.prototype.drawValue = function (name, stg) {
	var self = this;
	var key = name;
	if (stg) key = name + ':' + stg;
	var info = self.getSettingInfo(name);
	var value = self.data['settings'][key];
	var defaultVal = info ? info.defaultVal : undefined;
	var type = info ? info.type : 'string';
	if (!info && typeof(value) == 'number') type = 'float';
	if (!info && typeof(value) == 'object' && Array.isArray(value)) type = 'list';
	if (type == 'float' || type == 'int') {
		return drawNumeric();
	}
	if (type == 'lights') {
		return drawLights();
	}
	if (type == 'string' || type == 'text') {
		return drawString();
	}
	if (type == 'boolean') {
		return drawBoolean();
	}
	if (type == 'list') {
		return drawList();
	}

	function drawNumeric() {
		var span = $(document.createElement('span'));
		if (defaultVal !== undefined)
			span.text(value + " (" + defaultVal + ")");
		else
			span.text(value);

		return span;
	}

	function drawString() {
		var span = $(document.createElement('span'));
		span.addClass('text');
		if (defaultVal !== undefined)
			span.text(value + " (" + defaultVal + ")");
		else
			span.text(value);
		return span;
	}

	function drawBoolean() {
		var span = $(document.createElement('span'));
		span.text(value ? 'Ja' : 'Nein');
		return span;
	}

	function drawLights() {
		var span = $(document.createElement('span'));
		var text = '';
		text += 'Grün ab: ' + value[0];
		text += ' Gelb ab: ' + value[1];
		text += ' Rot ab: ' + value[2];
		if (defaultVal !== undefined)
			span.text(text + " (" + defaultVal[0] + ", " + defaultVal[1] + ", " + defaultVal[2] + ")");
		else
			span.text(text);
		return span;
	}

	function drawList() {
		var span = $(document.createElement('span'));
		var text = value.join(', ');
		if (defaultVal !== undefined)
			span.text(text + " (" + defaultVal.join(',') + ")");
		else
			span.text(text);
		return span;
	}


};

SettingsManager.prototype.drawValueInput = function (name, stg) {
	var self = this;
	var key = name;
	if (stg) key = name + ':' + stg;
	var info = self.getSettingInfo(name);
	var value = self.data['settings'][key];
	var type = info ? info.type : 'string';
	if (!info && typeof(value) == 'number') type = 'float';
	if (!info && typeof(value) == 'object' && Array.isArray(value)) type = 'list';
	if (type == 'float' || type == 'int') {
		return drawNumeric();
	}
	if (type == 'string') {
		return drawString();
	}
	if (type == 'text') {
		return drawString(true);
	}
	if (type == 'lights') {
		if (!value) {
			value = [0, 0, 0];
		}
		return drawLights();
	}
	if (type == 'boolean') {
		return drawBoolean();
	}
	if (type == 'list') {
		if (!Array.isArray(value)) value = [];
		return drawList();
	}

	function drawNumeric() {
		var box = $(document.createElement('div'));

		var input = $(document.createElement('input')).appendTo(box);
		input.val(value);

		box.getValue = function () {
			return parseFloat(input.val());
		};
		return box;
	}

	function drawString(textarea) {
		var box = $(document.createElement('div'));
		var input;
		if (info && info.selectItems) {
			input = $(drawSelect(info.selectItems, value)).appendTo(box);
		} else {
			input = $(document.createElement(textarea ? 'textarea' : 'input')).appendTo(box);
			input.val(value);
		}


		box.getValue = function () {
			return input.val();
		};
		return box;
	}

	function drawBoolean() {
		var box = $(document.createElement('div'));
		var select = $(drawSelect({'true': 'Ja', 'false': 'Nein'}, value ? 'true' : 'false'));
		box.append(select);
		box.getValue = function () {
			return select.val() == 'true' ? true : false;
		};
		return box;
	}

	function drawLights() {
		var box = $(document.createElement('div'));

		var p;
		p = $('<p class="optionset"/>').appendTo(box);
		$('<label/>').text('Grün ab:').appendTo(p);
		var input1 = $('<input/>').val(value[0]).appendTo(p);

		p = $('<p class="optionset"/>').appendTo(box);
		$('<label/>').text('Gelb ab:').appendTo(p);
		var input2 = $('<input/>').val(value[1]).appendTo(p);

		p = $('<p class="optionset"/>').appendTo(box);
		$('<label/>').text('Rot ab:').appendTo(p);
		var input3 = $('<input/>').val(value[2]).appendTo(p);


		box.getValue = function () {
			return [
				parseFloat(input1.val()),
				parseFloat(input2.val()),
				parseFloat(input3.val())
			];
		};
		return box;
	}

	function drawList() {
		var box = $(document.createElement('div'));
		var items = $(document.createElement('span')).appendTo(box);

		box.drawItem = function (item_value) {
			var item = createDom('span', 'selectitem', items);
			item.appendChild(document.createTextNode(item_value));

			var link = $(createDom('a', 'crossicon', item));
			link.attr('href', '');
			link.click(function (e) {
				e.preventDefault();
				var pos = value.indexOf(item_value);
				if (pos != -1) {
					value.splice(pos, 1);
					$(item).remove();
				}
			});
		};

		for (var i = 0; i < value.length; i++) {
			var item_value = value[i];
			box.drawItem(item_value);
		}

		var link = $(createDom('a', '', box));
		link.attr('href', '');
		link.text('Wert hinzufügen');
		link.click(function (e) {
			e.preventDefault();

			var item_value = prompt('Neuer Listeneintrag');
			if (typeof(item_value) == 'string' && item_value.length) {
				value.push(item_value);
				box.drawItem(item_value);
			}

		});


		box.getValue = function () {
			return value;
		};
		return box;
	}
};

SettingsManager.prototype.drawSettingDialog = function (name) {
	var self = this;
	var dialog = $(document.createElement('div'));
	var value = self.data['settings'][name];
	var info = self.getSettingInfo(name);
	var title = name;
	if (info) {
		title = info.name;
		$('<p />').text(info.desc).appendTo(dialog);
	}

	var valuesO = $('<div class="values" />').appendTo(dialog);

	var valueO = $('<div class="valueInputItem" />').appendTo(valuesO);
	var inputs = {};
	inputs[name] = self.drawValueInput(name);
	valueO.append(inputs[name]);

	if (info.perStg) {
		var additionalValues = self.findStgSettingValues(name);

		function drawStgEntry(stg) {
			var valueO = $('<div class="valueInputItem" />').appendTo(valuesO);
			var titleO = $('<b/>').text('Studiengang ' + stg + ' ').appendTo(valueO);
			$('<a href=""/>').text('Entfernen').appendTo(valueO)
				.click(function (e) {
					e.preventDefault();
					inputs[key] = null;
					valueO.remove();
				});

			var key = name + ':' + stg;
			inputs[key] = self.drawValueInput(name, stg);
			valueO.append(inputs[key]);

		}

		Object.keys(additionalValues).forEach(drawStgEntry);

		var buttonContainer = $('<p />').appendTo(dialog);
		$('<a href=""/>').text('Studiengangsspezifischen Wert hinzufügen').appendTo(buttonContainer)
			.click(function (e) {
				e.preventDefault();
				var stg = prompt('Studiengangskürzel');
				if (!stg) return;
				drawStgEntry(stg);
			});

	}


	var buttons = {};
	buttons['Speichern'] = function () {

		var keys = Object.keys(inputs);
		var index = 0;

		function saveNext() {
			if (index == keys.length) {
				self.load();
				$(dialog).dialog("close");
				return;
			}
			var key = keys[index++];
			var input = inputs[key];
			if (input == null) {
				self.removeSetting(key, saveNext);
				return;
			}

			var newValue = input.getValue();
			console.log('new value ' + key + ' :', newValue);
			if (typeof(newValue) == 'number' && isNaN(newValue)) {
				alert('Ungültige Nummer');
				return;
			}

			self.saveSetting(key, newValue, saveNext);

		}

		saveNext();

	};
	buttons['Abbrechen'] = function () {
		$(this).dialog("close");
	};

	dialog.dialog({
		title: title + ' bearbeiten',
		width: 400,
		modal: true,
		buttons: buttons
	})

};

SettingsManager.prototype.saveSetting = function (name, value, onDone) {
	var self = this;

	self.settingsDOM.addClass('loading');

	var data = {
		id: name,
		data: value
	};

	var url = '/api/SaveSettings';
	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify(data)
	}).success(function (data) {
		self.settingsDOM.removeClass('loading');
		if (onDone) onDone();
		else self.load();

	}).fail(function () {
		self.settingsDOM.removeClass('loading');
		self.settingsDOM.text('Speichern der Daten ist fehlgeschlagen.');
		if (onDone) onDone();
	});


};

SettingsManager.prototype.removeSetting = function (name, onDone) {
	var self = this;

	self.settingsDOM.addClass('loading');

	var data = {
		id: name,
		delete: true
	};

	var url = '/api/SaveSettings';
	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify(data)
	}).success(function (data) {
		self.settingsDOM.removeClass('loading');
		if (onDone) onDone();
		else self.load();

	}).fail(function () {
		self.settingsDOM.removeClass('loading');
		self.settingsDOM.text('Speichern der Daten ist fehlgeschlagen.');
		if (onDone) onDone();
	});


};

SettingsManager.prototype.load = function () {
	var self = this;
	var url = '/api/GetSettings';

	var params = [];

	if (params.length) url += '?';
	url += params.join('&');

	self.settingsDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.settingsDOM.removeClass('loading');

		self.data = data;

		self.draw();

	}).fail(function () {
		self.settingsDOM.removeClass('loading');
		self.settingsDOM.text('Laden der Daten ist fehlgeschlagen.');
	});

};




