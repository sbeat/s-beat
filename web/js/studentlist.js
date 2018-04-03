// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function StudentList(parentDOM) {
	this.parentDOM = parentDOM;

	this.mlistId = this.parentDOM.attr('data-mlist');
	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'students_';
	this.settingsServerSaveable = true;
	this.settings = {
		'default': {
			title: "Studenten Übersicht",
			limit: 20,
			sort1: '_id,1',
			sort2: null,
			filters: [],
			columns: ['ident', 'stg', 'start_semester', 'finishstatus', 'age', 'gender', 'bonus_total', 'exam_count', 'grade_current'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
		'risk': {
			title: "Risikofälle",
			limit: 20,
			sort1: 'risk.median_scaled,-1',
			sort2: null,
			filters: [
				{
					"id": "268447631572803",
					"type": "filterElement",
					"query": {
						"category": "Student.Studium.Prüfungsleistungen",
						"ignore": false,
						"name": "Semester mit Prüfungsleistungen",
						"success": false,
						"query_type": "dict",
						"q": "study_time_real",
						"depends": null,
						"formatting": "int"
					},
					"condition": {"negate": false, "name": "sem_1", "compare_value": 1, "comparator": "greater_equal"}
				},
				{
					"id": "finished",
					"name": "Studium abgeschlossen",
					"group": "Student.Studium",
					"type": "attribute",
					"formatting": "yesno",
					"value": "false"
				}
			],
			columns: ['ident', 'stg', 'start_semester', 'finishstatus', 'age', 'gender', 'bonus_total', 'risk', 'risk.median_scaled', 'study_time_real', 'exam_success_perc', 'grade_current'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
		'pathbased': {
			title: "Studenten",
			limit: 20,
			sort1: 'risk.median_scaled,-1',
			sort2: null,
			filters: [],
			columns: ['ident', 'stg', 'start_semester', 'finishstatus', 'age', 'gender', 'bonus_total', 'risk', 'risk.median_scaled', 'study_time_real', 'exam_success_perc', 'grade_current'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
		'mlist': {
			title: "Vormerkungsliste",
			limit: 20,
			sort1: 'risk.median_scaled,-1',
			filters: [],
			columns: ['ident', 'stg', 'start_semester', 'finishstatus', 'age', 'gender', 'bonus_total', 'risk', 'risk.median_scaled', 'comment', 'actions'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		}
	};

	this.displayFilters = true;
	this.displayPagination = true;
	this.sortable = true;

	this.paginationDOM = $(document.createElement('div'));
	this.pagination2DOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.secondaryDOM = this.pagination2DOM;
	this.pagination.limit = this.settings.default.limit;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;
	this.pagination.sortOptions = {
		'_id,1': CONFIG.student_ident_label + ' aufsteigend',
		'_id,-1': CONFIG.student_ident_label + ' absteigend'
	};

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);
	//this.filter.addAttributeFilter('risk.median_scaled', 'Misserfolg in %', 'Vorhersage', 'percent', 0);
	if (this.settingId != 'mlist') {
		this.filter.addAttributeFilter('ident', CONFIG.student_ident_desc, 'Student', 'str', '');
	}

	this.filter.multiFilters = {
		exam_count: ['exam_count', 'exam_count_success', 'exam_count_applied']
	};

	this.columnData = {
		'ident': {
			id: 'ident',
			label: CONFIG.student_ident_label,
			title: CONFIG.student_ident_desc,
			formatting: 'str',
			sortBy: '_id'
		},
		'stg': {id: 'stg', label: 'STG', title: 'Studiengangsgruppe', formatting: 'stg'},
		'stg_original': {id: 'stg_original', label: 'Studiengang', title: 'Studiengang', formatting: 'stg'},
		'degree_type': {id: 'degree_type', label: 'Abschluss', title: 'Abschluss', formatting: 'str'},
		'start_semester': {id: 'start_semester', label: 'Start', title: 'Start semester', formatting: 'semester'},
		'finishstatus': {
			id: 'finishstatus',
			label: 'Status',
			title: 'Status des Studiums',
			formatting: 'yesno',
			sortBy: 'status',
			filters: ['success', 'aborted', 'finished']
		},
		'age': {id: 'age', label: 'Alter bei Immatrik.', title: 'Alter bei Immatrikulation', formatting: 'int'},
		'birth_date': {id: 'birth_date', label: 'Geburtstag', title: 'Geburtstag', formatting: 'date'},
		'hzb_grade': {
			id: 'hzb_grade',
			label: 'HZB Note',
			title: 'Hochschulzugangsberechtigung Note',
			formatting: 'grade'
		},
		'hzb_type': {
			id: 'hzb_type',
			label: 'HZB Gruppe',
			title: 'Hochschulzugangsberechtigung Gruppe',
			formatting: 'str'
		},
		'hzb_date': {
			id: 'hzb_date',
			label: 'HZB Datum',
			title: 'Hochschulzugangsberechtigung Datum',
			formatting: 'date'
		},
		'imm_date': {id: 'imm_date', label: 'Immatrikulation', title: 'Datum der Immatrikulation', formatting: 'date'},
		'exm_date': {id: 'exm_date', label: 'Exmatrikulation', title: 'Datum der Exmatrikulation', formatting: 'date'},
		'semesters': {id: 'semesters', label: 'Semester', title: 'Semester immatrikuliert', formatting: 'int'},
		'hzb_imm_time': {
			id: 'hzb_imm_time',
			label: 'Monate seit HZB',
			title: 'Monate zwischen HZB und Immatrikulation',
			formatting: 'int'
		},
		'gender': {id: 'gender', label: 'Geschl.', title: 'Geschlecht', formatting: 'gender'},
		'risk': {
			id: 'risk',
			label: 'Risiko',
			title: 'Risikobereich',
			formatting: 'risk',
			sortBy: 'risk.median_scaled'
		},
		//'risk.median': {id: 'risk.median', label: 'Misserfolg', title: 'Misserfolgswahrscheinlichkeit', formatting: 'percent'},
		'risk.median_scaled': {
			id: 'risk.median_scaled',
			label: 'Risiko in %',
			title: 'Skalierte Misserfolgswahrscheinlichkeit in %',
			formatting: 'percent'
		},
		'risk_all.median_scaled': {
			id: 'risk_all.median_scaled',
			label: 'Gesamtrisiko in %',
			title: 'Gesamte skalierte Misserfolgswahrscheinlichkeit in %',
			formatting: 'percent'
		},
		'risk_stg.median_scaled': {
			id: 'risk_stg.median_scaled',
			label: 'Studiengangsrisiko in %',
			title: 'Skalierte Misserfolgswahrscheinlichkeit im Studiengang in %',
			formatting: 'percent'
		},
		'risk_degree.median_scaled': {
			id: 'risk_degree.median_scaled',
			label: 'Risiko im Abschluss in %',
			title: 'Skalierte Misserfolgswahrscheinlichkeit im Abschluss in %',
			formatting: 'percent'
		},
		'exam_count': {
			id: 'exam_count',
			label: 'Prüfungsleistungen',
			title: 'Gesamtzahl Prüfungsleistungen',
			formatting: 'int'
		},
		'exam_count_finish': {
			id: 'exam_count_finish',
			label: 'PL fertig',
			title: 'Anzahl abgeschlossener Prüfungsleistungen',
			formatting: 'int'
		},
		'exam_count_success': {
			id: 'exam_count_success',
			label: 'PL bestanden',
			title: 'Anzahl bestandener Prüfungsleistungen',
			formatting: 'int'
		},
		'exam_count_applied': {
			id: 'exam_count_applied',
			label: 'PL angemeldet',
			title: 'Anzahl angemeldete Prüfungsleistungen',
			formatting: 'int'
		},
		'exam_count_resigned': {
			id: 'exam_count_resigned',
			label: 'Rücktritte',
			title: 'Anzahl Rücktritte von Prüfungsleistungen',
			formatting: 'int'
		},
		'exam_success_perc': {
			id: 'exam_success_perc',
			label: 'PL bestanden in %',
			title: 'Bestandene Prüfungsleistungen in %',
			formatting: 'percent'
		},
		'exam_count_failed': {
			id: 'exam_count_failed',
			label: 'PL nicht bestanden',
			title: 'Anzahl nicht bestandener Prüfungsleistungen',
			formatting: 'int'
		},
		'exam_failed_perc': {
			id: 'exam_failed_perc',
			label: 'PL nicht bestanden in %',
			title: 'Nicht bestandene Prüfungsleistungen in %',
			formatting: 'percent'
		},

		'cnt_delayed_exams': {
			id: 'cnt_delayed_exams',
			label: 'Entschuldigte Rücktritte',
			title: 'Entschuldigte Rücktritte von Prüfungsleistungen',
			formatting: 'int'
		},
		'cnt_unauthorized_delayed_exams': {
			id: 'cnt_unauthorized_delayed_exams',
			label: 'Unentschuldigte Rücktritte',
			title: 'Unentschuldigte Rücktritte von Prüfungsleistungen',
			formatting: 'int'
		},
		'bonus_total': {
			id: 'bonus_total',
			label: CONFIG.cp_label,
			title: 'Anzahl ' + CONFIG.cp_label + ' im gesamten Studium',
			formatting: 'int'
		},
		'study_time_real': {
			id: 'study_time_real',
			label: 'Semester mit PL',
			title: 'Anzahl Semester mit Prüfungsleistungen',
			formatting: 'int'
		},
		'grade_basic_studies': {
			id: 'grade_basic_studies',
			label: 'Note Grundstudium',
			title: 'Note der Pflicht PL in den ersten beiden Semestern',
			formatting: 'grade'
		},
		'grade_main_studies': {
			id: 'grade_main_studies',
			label: 'Note Hauptstudium',
			title: 'Note der PL im Hauptstudium',
			formatting: 'grade'
		},
		'grade_current': {
			id: 'grade_current',
			label: 'Note Aktuell',
			title: 'Gewichtete Durchschnittsnote aller bisherigen Prüfungsleistungen',
			formatting: 'grade'
		},
		'grade_nb_current': {
			id: 'grade_nb_current',
			label: 'Note Aktuell inkl. NB, EN',
			title: 'Gewichtete Durchschnittsnote aller Prüfungsleistungen einschließlich nicht bestandener Leistungen',
			formatting: 'grade'
		},
		'grade_total': {
			id: 'grade_total',
			label: 'Note',
			title: 'Durchschnittsnote aller Prüfungsleistungen',
			formatting: 'grade'
		},
		'final_grade': {
			id: 'final_grade',
			label: 'Abschlussnote',
			title: 'Abschlussnote des Studiums',
			formatting: 'grade'
		},
		'comment': {
			id: 'comment',
			label: 'Kommentar',
			title: 'Kommentar aus Vormerkung',
			formatting: 'str',
			sortBy: null
		},
		//'category': {id: 'category', label: 'Kategorie', title: 'Kategorie aus Vormerkung', formatting: 'str', sortBy: null},

		'semester_data.sem_1.bonus_total': {
			id: 'semester_data.sem_1.bonus_total',
			label: CONFIG.cp_label + ' nach 1. Semester',
			title: 'Erreichte ' + CONFIG.cp_label + ' nach 1. Semester',
			formatting: 'int'
		},
		'semester_data.sem_1.grade': {
			id: 'semester_data.sem_1.grade',
			label: 'Note im 1. Semester',
			title: 'Note im 1. Semester',
			formatting: 'grade'
		},
		'semester_data.sem_1.delayed': {
			id: 'semester_data.sem_1.delayed',
			label: 'Entschuldigte Rücktritte im 1. Semester',
			title: 'Entschuldigte Rücktritte im 1. Semester',
			formatting: 'int'
		},
		'semester_data.sem_1.failed': {
			id: 'semester_data.sem_1.failed',
			label: 'Nicht bestandene Prüfungsleistungen im 1. Semester',
			title: 'Nicht bestandene Prüfungsleistungen im 1. Semester',
			formatting: 'int'
		},
		'semester_data.sem_1.successful': {
			id: 'semester_data.sem_1.successful',
			label: 'Bestandene Prüfungsleistungen im 1. Semester',
			title: 'Bestandene Prüfungsleistungen im 1. Semester',
			formatting: 'int'
		},
		'semester_data.sem_1.count_KL': {
			id: 'semester_data.sem_1.count_KL',
			label: 'Klausuren im 1. Semester',
			title: 'Klausuren im 1. Semester',
			formatting: 'int'
		},

		'semester_data.sem_2.bonus_total': {
			id: 'semester_data.sem_2.bonus_total',
			label: CONFIG.cp_label + ' nach 2. Semester',
			title: 'Erreichte ' + CONFIG.cp_label + ' nach 2. Semester',
			formatting: 'int'
		},
		'semester_data.sem_2.grade': {
			id: 'semester_data.sem_2.grade',
			label: 'Note im 2. Semester',
			title: 'Note im 2. Semester',
			formatting: 'grade'
		},
		'semester_data.sem_2.delayed': {
			id: 'semester_data.sem_2.delayed',
			label: 'Entschuldigte Rücktritte im 2. Semester',
			title: 'Entschuldigte Rücktritte im 2. Semester',
			formatting: 'int'
		},
		'semester_data.sem_2.failed': {
			id: 'semester_data.sem_2.failed',
			label: 'Nicht bestandene Prüfungsleistungen im 2. Semester',
			title: 'Nicht bestandene Prüfungsleistungen im 2. Semester',
			formatting: 'int'
		},
		'semester_data.sem_2.successful': {
			id: 'semester_data.sem_2.successful',
			label: 'Bestandene Prüfungsleistungen im 2. Semester',
			title: 'Bestandene Prüfungsleistungen im 2. Semester',
			formatting: 'int'
		},
		'semester_data.sem_2.count_KL': {
			id: 'semester_data.sem_2.count_KL',
			label: 'Klausuren im 2. Semester',
			title: 'Klausuren im 2. Semester',
			formatting: 'int'
		},

		'semester_data.sem_3.bonus_total': {
			id: 'semester_data.sem_3.bonus_total',
			label: CONFIG.cp_label + ' nach 3. Semester',
			title: 'Erreichte ' + CONFIG.cp_label + ' nach 3. Semester',
			formatting: 'int'
		},
		'semester_data.sem_3.grade': {
			id: 'semester_data.sem_3.grade',
			label: 'Note im 3. Semester',
			title: 'Note im 3. Semester',
			formatting: 'grade'
		},
		'semester_data.sem_3.delayed': {
			id: 'semester_data.sem_3.delayed',
			label: 'Entschuldigte Rücktritte im 3. Semester',
			title: 'Entschuldigte Rücktritte im 3. Semester',
			formatting: 'int'
		},
		'semester_data.sem_3.failed': {
			id: 'semester_data.sem_3.failed',
			label: 'Nicht bestandene Prüfungsleistungen im 3. Semester',
			title: 'Nicht bestandene Prüfungsleistungen im 3. Semester',
			formatting: 'int'
		},
		'semester_data.sem_3.successful': {
			id: 'semester_data.sem_3.successful',
			label: 'Bestandene Prüfungsleistungen im 3. Semester',
			title: 'Bestandene Prüfungsleistungen im 3. Semester',
			formatting: 'int'
		},
		'semester_data.sem_3.count_KL': {
			id: 'semester_data.sem_3.count_KL',
			label: 'Klausuren im 3. Semester',
			title: 'Klausuren im 3. Semester',
			formatting: 'int'
		},
		'actions': {
			id: 'actions',
			label: 'Aktionen',
			title: 'Aktionen',
			formatting: 'actions',
			noDownload: true,
			sortBy: null,
			presets: ['mlist']
		},
		'tags': {
			id: 'tags',
			label: 'Tags',
			title: 'Tags',
			formatting: 'tags'
		},
		'country': {
			id: 'country',
			label: 'Herkunftsland',
			title: 'Land des Studierenden',
			formatting: 'str'
		},
		'zip': {
			id: 'zip',
			label: 'PLZ',
			title: 'Postleitzahl des Studierenden',
			formatting: 'str'
		},
		'citship': {
			id: 'citship',
			label: 'Staatsangehörigkeit',
			title: 'Staatsangehörigkeit des Studierenden',
			formatting: 'str'
		},
		'eu': {
			id: 'eu',
			label: 'EU Bürger',
			title: 'Ist der Bewerber EU Bürger',
			formatting: 'yesno'
		}

	};
	this.columns = this.settings.default.columns;
	this.mandatoryColumns = ['ident'];

	this.tableDOM = $(document.createElement('table'));
	this.allCheck = null;
	this.checkMenuDom = $(document.createElement('div'));

	this.data = null; // Last loaded data
	this.markedData = null;
	this.definitions = null;

	this.drawn = false;

	this.openColumnDialog = openColumnDialog;
	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;
	this.openLoadSettingsDialog = openLoadSettingsDialog;
	this.removeColumn = removeDataColumn;

	StudentList.prototype.init.call(this);
}

/**
 * Gets called once this MarkedList is initialized
 */
StudentList.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	for (var colId in self.columnData) {
		var col = self.columnData[colId];
		if (colId == 'ident' || col.sortBy) continue;
		self.pagination.sortOptions[col.id + ',1'] = col.label + ' aufsteigend';
		self.pagination.sortOptions[col.id + ',-1'] = col.label + ' absteigend';
	}

	self.pagination.onReset = function () {
		self.loadPresetSettings(self.settingId);
		self.filter.draw();
		self.load();
	};


	self.pagination.changed = function (start) {
		self.load();
	};

	self.filter.filterChanged = function (op, f) {
		if (op == 'add') {
			var col = self.findColumnByFilter(f);
			if (col && self.columns.indexOf(col.id) == -1) {
				if (confirm('Möchten Sie die Spalte "' + col.label + '" hinzufügen?')) {
					self.columns.push(col.id);
				}
			}
		}
		self.pagination.setStart(0);
		self.load();
	};

	var settings = self.settings[self.settingId] || self.settings['default'];

	if (typeof(settings.title) != 'undefined')
		$('#headline_students').text(settings.title);


	var serverSettingId = self.parentDOM.attr('data-ssid');
	if (serverSettingId) {
		getServerSetting('list', serverSettingId, function (value) {
			if (value) {
				self.loadSettings(value);
			} else {
				self.loadSettings();
			}
			self.draw();
			self.load();
		});
	} else {
		self.loadSettings();
		self.draw();
		self.load();
	}


};
StudentList.prototype.findColumnByFilter = function (f) {
	var columnId = null;
	if (f.type == 'attribute') columnId = f.id;
	if (f.type == 'value') columnId = f.id;
	if (f.type == 'filterElement') columnId = f.query.q;
	if (!columnId) return null;

	for (var id in this.columnData) {
		var cd = this.columnData[id];
		if (columnId == id || cd.filters && cd.filters.indexOf(columnId) != -1) {
			return cd;
		}
	}
	return null;
};

/**
 * Gets called every time the MarkedList must be drawn completely
 */
StudentList.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.filterDOM.addClass('filterlist');
		this.parentDOM.append(this.filterDOM);
		this.filter.draw();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.tableDOM.addClass('studentList tbl sortable');
		this.parentDOM.append(this.tableDOM);

		this.parentDOM.append(this.checkMenuDom);
		this.checkMenuDom.hide();
		this.drawCheckMenu();

		this.pagination2DOM.addClass('pagination');
		this.parentDOM.append(this.pagination2DOM);

		this.drawn = true;

		this.pagination.addLink('Einstellungen', function () {
			self.openSettingsDialog();
		});
		this.pagination.addLink('Spaltenauswahl', function () {
			self.openColumnDialog();
		});
		this.pagination.addLink('Berechnungen', function () {
			self.openCalculationsDialog();
		});
		this.pagination.addLink('Herunterladen', function () {
			self.openDownloadDialog();
		});
		this.allCheck = createCheckbox(function (state) {
			self.checkAll(state);
		});
	}

	if (this.mlistId) {
		$('[data-mlistdata]').each(function () {
			var el = $(this);
			var field = el.attr('data-mlistdata');
			self.drawMListValue(field, el);
		});
	}

	if (this.displayFilters) this.filterDOM.show();
	else this.filterDOM.hide();

	if (this.displayPagination) this.paginationDOM.show();
	else this.paginationDOM.hide();

	this.pagination.draw();

	if (!this.data) {
		this.tableDOM.text('Keine Daten verfügbar');
		return;
	}

	if (!this.data.list.length) {

		this.tableDOM.text('Keine Studenten gefunden.');
		return;
	}


	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	var th = document.createElement('th');
	th.appendChild(this.allCheck);
	tr.append(th);

	drawTableHead.call(this, tr, 'tooltip_student_');


	if (self.sortable) {
		thead.find('th').click(function (e) {
			var col = self.columnData[this.colId];
			var sortField = col.sortBy ? col.sortBy : col.id;

			if (self.pagination.sort1 == sortField + ',1') {
				self.pagination.sort1 = sortField + ',-1';
			} else {
				self.pagination.sort1 = sortField + ',1';
			}
			if (self.pagination.sort2 == sortField + ',1' || self.pagination.sort2 == sortField + ',-1') {
				self.pagination.sort2 = null;
			}

			self.load();

		});
	}


	var tbody = $(document.createElement('tbody'));
	this.tableDOM.append(tbody);

	for (var i = 0; i < this.data.list.length; i++) {
		var student = this.data.list[i];
		tbody.append(this.drawStudent(student));
	}

	adjustTableHeaders(this.tableDOM);
};

StudentList.prototype.drawCheckMenu = function () {
	var self = this;
	this.checkMenuDom.append('Auswahl: ');

	$('<a href=""></a>')
		.text('Tags hinzufügen')
		.click(function (e) {
			e.preventDefault();
			var avilableTags = self.definitions.tags.filter(function (tag) {
				return tag.active;
			});
			var dialog = selectTagsDialog(avilableTags, [], function (tags) {
				saveTagsSelection('add', tags, dialog);
			});
		})
		.appendTo(this.checkMenuDom);
	this.checkMenuDom.append(' ');

	$('<a href=""></a>')
		.text('Tags entfernen')
		.click(function (e) {
			e.preventDefault();
			var usedTags = [];
			self.getAllCheckedIds().forEach(function (studentId) {
				var student = getByField(self.data.list, 'ident', studentId);
				if (student && student.tags) {
					usedTags = usedTags.concat(student.tags);
				}
			});
			var avilableTags = self.definitions.tags.filter(function (tag) {
				return tag.active && usedTags.indexOf(tag.name) !== -1;
			});

			var dialog = selectTagsDialog(avilableTags, [], function (tags) {
				saveTagsSelection('remove', tags, dialog);
			});
		})
		.appendTo(this.checkMenuDom);
	this.checkMenuDom.append(' ');

	$('<a href=""></a>')
		.text('Herunterladen')
		.click(function (e) {
			e.preventDefault();
			self.openDownloadDialog(self.getAllCheckedIds());
		})
		.appendTo(this.checkMenuDom);

	function saveTagsSelection(mode, tagNames, dialogBox) {
		var studentIds = self.getAllCheckedIds();
		var index = 0;

		function handleStudent() {
			if (index < studentIds.length) {
				var id = studentIds[index++];
				saveTagsSelectionForStudent(id, mode, tagNames, dialogBox, handleStudent);
			} else {
				dialogBox.dialog("close");
				self.load();
			}

		}

		handleStudent();

	}

	function saveTagsSelectionForStudent(studentId, mode, tagNames, dialogBox, callb) {
		var student = getByField(self.data.list, 'ident', studentId);
		var running = 0;
		self.definitions.tags.forEach(function (tag) {
			var tagName = tag.name;
			var index = student.tags.indexOf(tagName);
			var selected = tagNames.indexOf(tagName) !== -1;
			if (selected && index === -1 && mode === 'add') {
				running++;
				tagAction('assign_tag', {
					id: tagName,
					student_id: studentId
				}, $('<div></div>').appendTo(dialogBox), function (result) {
					if (result && result.status === 'ok') {
						student.tags.push(tagName);
						finish();
					}
				});
			} else if (selected && index !== -1 && mode === 'remove') {
				running++;
				tagAction('unlink_tag', {
					id: tagName,
					student_id: studentId
				}, $('<div></div>').appendTo(dialogBox), function (result) {
					if (result && result.status === 'ok') {
						index = student.tags.indexOf(tagName);
						student.tags.splice(index, 1);
						finish();
					}
				});
			}

		});

		if (!running) {
			callb();
		}

		function finish() {
			running--;
			if (running === 0) {
				callb();
			}
		}
	}

};

StudentList.prototype.drawMListValue = function (field, el) {
	var self = this;
	var value;
	el.empty();

	if (!self.data) {
		el.text('-');

	} else if (field == 'user_roles') {
		value = getByPath(field, self.data['mlist']);
		var text = value ? value.join(', ') : 'Keine';
		if (value) {
			var readOnly = getByPath('read_only', self.data['mlist']);
			text += ' (' + (readOnly ? 'Nur lesen' : 'Schreiben') + ')';
		}
		el.text(text);

	} else if (field.indexOf('date_') == 0) {
		value = getByPath(field, self.data['mlist']);
		if (value) {
			el.text(getDateTimeText(new Date(Math.floor(value * 1000))));
		} else {
			el.text('Nie');
		}

	} else if (field == 'modify_button') {
		var btn = $(document.createElement('a'))
			.text('Einstellungen der Vormerkungsliste bearbeiten')
			.attr('href', '')
			.click(function (e) {
				e.preventDefault();
				self.openMarkedListSettingsDialog();
			});
		if (self.data['mlist'] && self.data['mlist']['is_writable']) {
			el.append(btn);
		}


	} else {
		value = getByPath(field, self.data['mlist']);
		el.append(getFormattedHTML(value, 'str'));

	}

};

StudentList.prototype.getAllCheckedIds = function () {
	var allBoxes = this.tableDOM.find('tbody').find('input[type=checkbox]');
	var ids = [];
	allBoxes.each(function () {
		if (this.checked) {
			ids.push(this.value);
		}
	});
	return ids;
};

StudentList.prototype.checkAll = function (state) {
	var allBoxes = this.tableDOM.find('tbody').find('input[type=checkbox]');
	if (state === undefined) {
		var allChecked = true;
		var anyChecked = false;
		allBoxes.each(function () {
			if (!this.checked) {
				allChecked = false;
			} else {
				anyChecked = true;
			}
		});
		if (allChecked && !this.allCheck.checked) {
			this.allCheck.checked = true;
		} else if (!allChecked && this.allCheck.checked) {
			this.allCheck.checked = false;
		}
		if (anyChecked) {
			this.checkMenuDom.show();
		} else {
			this.checkMenuDom.hide();
		}
	} else {
		allBoxes.each(function () {
			if (this.checked !== state) {
				this.checked = state;
			}
			if (this.checked) {
				this.checkMenuDom.show();
			} else {
				this.checkMenuDom.hide();
			}
		});
	}

};

StudentList.prototype.drawStudent = function (student) {
	var self = this;

	var tr = $(document.createElement('tr'));
	tr.addClass('student');

	var td = document.createElement('td');
	var box = createCheckbox(function () {
		self.checkAll();
	});
	box.value = student.ident;
	td.appendChild(box);
	tr.append(td);

	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		if (!col) continue;
		td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(student, col, td);
	}

	return tr

};
StudentList.prototype.drawCellValue = function (student, col, td) {
	var self = this;
	var value;
	var role = getUserRole();
	td.addClass('col_student_' + col.id);
	if (self.definitions.restricted.indexOf(col.id) != -1) {
		td.text('***');
		return
	}

	if (col.id == 'ident') {
		var idA = $(document.createElement('a'));
		idA.attr('href', 'student_detail.html?id=' + student.ident);
		idA.text(getByPath(col.id, student));
		td.append(idA);

		var detailA = $(document.createElement('a'));
		detailA.addClass('detailBtn');
		detailA.attr('href', 'student_detail.html?id=' + student.ident);
		/*
		 detailA.click(function (e) {
		 e.preventDefault();
		 self.openDetailDialog(student);
		 });
		 */
		td.append(detailA);

	} else if (col.id == 'actions') {
		if (self.data.mlist && self.data.mlist.list.indexOf(student.ident) != -1 && self.data.mlist.is_writable) {
			var delA = $(document.createElement('a'))
				.attr('href', '')
				.text('Entfernen')
				.attr('title', 'Entfernt diesen Studenten aus der Vormerkungsliste')
				.appendTo(td);
			delA.tooltip();
			delA.click(function (e) {
				e.preventDefault();

				if (!confirm('Soll dieser Student wirklich aus der Liste entfernt werden?')) {
					return;
				}
				var data = {};
				data['remove_idents'] = [student.ident];

				self.tableDOM.addClass('loading');
				$.ajax({
					url: '/api/SaveMarkedList?ident=' + self.data.mlist.ident,
					type: 'POST',
					contentType: 'application/json; charset=utf-8',
					data: JSON.stringify(data)
				}).success(function (data) {
					self.load();

				}).fail(function () {
					self.tableDOM.removeClass('loading');
					self.tableDOM.text('Speichern der Daten ist fehlgeschlagen.');
				});

			});

		}

	} else if (col.id == 'category') {
		var mark = self.getMarkedInfo(student.ident);
		if (mark) {
			td.text(mark.category ? mark.category : '-');
		} else {
			td.text('-');
		}

	} else if (col.id == 'comment') {
		if (self.data.mlist && self.data.mlist.comments[student.ident]) {
			td.text(self.data.mlist.comments[student.ident].text);
		} else {
			td.text('-');
		}

	} else if (col.id === 'tags') {
		if (student.tags && self.definitions.tags) {
			self.definitions.tags.forEach(function (tag) {
				if (student.tags.indexOf(tag.name) !== -1) {
					var tagO = createDom('span', 'singletag');
					tagO.appendChild(document.createTextNode(tag.name));
					td.append(tagO);
				}
			});
		}

	} else if (col.id == 'finishstatus') {
		if (student.finished) {
			if (student.success) {
				td.text('Erfolgreich');
			} else if (student.aborted) {
				td.text('Abgebrochen');
			} else {
				td.text('Abgeschlossen');
			}

		} else {
			td.text('Studiert');
		}

	} else if (col.id == 'risk') {
		if (!student.risk || student.risk.median === null) {
			td.text('-');
		} else {
			value = student.risk.median_scaled;
			td.append(drawRiskLightsForStudent(value, student, self.definitions.lights));
		}

	} else if (col.id == 'risk.median_scaled' && !self.definitions.risk_value_allowed) {
		td.text('***');

	} else {
		value = getByPath(col.id, student);
		//console.log('value from '+col.id,value,student);
		td.append(getFormattedHTML(value, col.formatting));

	}


};

StudentList.prototype.initDefinitions = function (definitions) {
	var self = this;
	self.definitions = definitions;
	var query;
	var usedQueries = [];

	self.filter.tagsDefinition = self.definitions.tags;

	if (!self.definitions['hide_student_fields']) {
		self.definitions['hide_student_fields'] = [];
	}

	if (!self.definitions.risk_value_allowed) {
		self.definitions.restricted.push('risk.median_scaled');
		self.removeColumn('risk.median_scaled');

		self.definitions.restricted.push('risk_all.median_scaled');
		self.removeColumn('risk_all.median_scaled');

		self.definitions.restricted.push('risk_stg.median_scaled');
		self.removeColumn('risk_stg.median_scaled');

		self.definitions.restricted.push('risk_degree.median_scaled');
		self.removeColumn('risk_degree.median_scaled');

	} else {
		this.filter.addAttributeFilter('risk.median_scaled', 'Risiko in %', 'Vorhersage', 'percent', 0);
		if (self.definitions['generate_risk_group_all'] && self.definitions['generate_risk_group_stg']) {
			this.filter.addAttributeFilter('risk_all.median_scaled', 'Gesamtrisiko in %', 'Vorhersage', 'percent', 0);
		} else {
			self.removeColumn('risk_all.median_scaled');
		}
		if (self.definitions['generate_risk_group_stg']) {
			this.filter.addAttributeFilter('risk_stg.median_scaled', 'Studiengangsrisiko in %', 'Vorhersage', 'percent', 0);
		} else {
			self.removeColumn('risk_stg.median_scaled');
		}
		if (self.definitions['generate_risk_group_degree']) {
			this.filter.addAttributeFilter('risk_degree.median_scaled', 'Risiko im Abschluss in %', 'Vorhersage', 'percent', 0);
		} else {
			self.removeColumn('risk_degree.median_scaled');
		}
	}

	if (self.definitions['hide_resigned']) {
		self.definitions['hide_student_fields'].push(
			'exam_count_resigned',
			'cnt_delayed_exams',
			'cnt_unauthorized_delayed_exams',
			'semester_data.sem_3.delayed',
			'semester_data.sem_4.delayed',
			'semester_data.sem_2.delayed',
			'semester_data.sem_1.delayed'
		);
	}

	self.definitions['hide_student_fields'].forEach(function (field) {
		self.definitions.restricted.push(field);
		self.removeColumn(field);
	});

	for (var peId in self.definitions['path_elements']) {
		var pe = self.definitions['path_elements'][peId];
		query = self.definitions['queries'][pe['query_id']];
		if (self.definitions.restricted.indexOf(query.q) != -1) continue;

		self.filter.addElementFilter(peId, query, pe.condition);
		if (usedQueries.indexOf(pe['query_id'].toString()) == -1) {
			usedQueries.push(pe['query_id'].toString());
		}
	}
	for (var qId in self.definitions['queries']) {
		query = self.definitions['queries'][qId];
		if (self.definitions.restricted.indexOf(query.q) != -1) continue;
		if (usedQueries.indexOf(qId) == -1) {
			self.filter.addAttributeFilter(query.q, query.name, query.category, query['formatting'], null);
		} else if (['int', 'grade', 'percent'].indexOf(query['formatting']) != -1) {
			var catg = query.category.split('.');
			catg.push(query.name);
			var f = self.filter.addAttributeFilter(query.q, query.name, catg, query['formatting'], null);
			f.displayName = 'Benutzerdefiniert';
		}
	}

	self.filter.addValueFilter('risk', 'Risikobereich Ampel', 'Vorhersage', 'risk', {
		'red': 'Rot',
		'yellow': 'Gelb',
		'green': 'Grün'
	}, null);

	if (self.definitions['generate_risk_group_all'] && self.definitions['main_risk_group'] != 'all') {
		self.filter.addValueFilter('risk_all', 'Gesamtrisikobereich Ampel', 'Vorhersage', 'risk', {
			'red': 'Rot',
			'yellow': 'Gelb',
			'green': 'Grün'
		}, null);
	}
	if (self.definitions['generate_risk_group_stg'] && self.definitions['main_risk_group'] != 'stg') {
		self.filter.addValueFilter('risk_stg', 'Studiengangsrisikobereich Ampel', 'Vorhersage', 'risk', {
			'red': 'Rot',
			'yellow': 'Gelb',
			'green': 'Grün'
		}, null);
	}
	if (self.definitions['generate_risk_group_degree'] && self.definitions['main_risk_group'] != 'degree') {
		self.filter.addValueFilter('risk_degree', 'Risikobereich im Abschluss Ampel', 'Vorhersage', 'risk', {
			'red': 'Rot',
			'yellow': 'Gelb',
			'green': 'Grün'
		}, null);
	}

	if (self.definitions.tags.length) {
		self.filter.addAttributeFilter('tags', 'Tags', 'Student', 'tags', '');
	}

	self.filter.sortFilters();


};
StudentList.prototype.setCustomFilters = function (ids) {
	this.loadPresetSettings(this.settingId);

	for (var i = 0; i < this.filter.available.length; i++) {
		var f = this.filter.available[i];
		if (ids.indexOf(f.id) == -1) continue;
		this.filter.filters.push(f);

		var col = this.findColumnByFilter(f);
		if (col && this.columns.indexOf(col.id) == -1) {
			this.columns.push(col.id);
		}

	}
	this.filter.draw();
	this.load();

};
StudentList.prototype.checkStudents = function (studentIds) {
	var allBoxes = this.tableDOM.find('tbody').find('input[type=checkbox]');
	allBoxes.each(function () {
		if (studentIds.indexOf(this.value) !== -1) {
			this.checked = true;
		}
	});
	this.checkAll();
};

StudentList.prototype.load = function () {
	var self = this;
	var url = '/api/GetStudents';

	self.saveSettings();

	var params = [];
	var filterQueries = this.filter.getQueries(false);
	for (var name in filterQueries) {
		params.push(name + '=' + encodeURIComponent(filterQueries[name]));
	}

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if (self.pagination.sort2)
		params.push('sort2=' + self.pagination.sort2);
	if (!self.definitions) {
		params.push('definitions=true');
	}
	if (this.mlistId) {
		params.push('mlist=' + this.mlistId);
	}

	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	var query = parseQuery(location.href);

	var studentIds = this.getAllCheckedIds();

	$.ajax({
		url: url
	}).success(function (data) {


		self.data = data;
		if (data.definitions) {
			self.initDefinitions(data.definitions);

			if (query['setFilterByIds']) {
				self.setCustomFilters(query['setFilterByIds'].split(','));
				return;
			}

		}

		self.tableDOM.removeClass('loading');

		self.pagination.update(data);

		//self.loadMarkedInfo();

		self.draw();

		self.checkStudents(studentIds);

	}).fail(function (jqXHR) {
		self.tableDOM.removeClass('loading');
		self.tableDOM.text('Laden der Daten ist fehlgeschlagen.');
		if (jqXHR.responseJSON && jqXHR.responseJSON.error == 'invalid_filter') {
			$('<p/>').text('Error: Fehlerhafter Filter (' + jqXHR.responseJSON.name + ')').appendTo(self.tableDOM);

		} else if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
			$('<p/>').text('Error: ' + jqXHR.responseJSON.error).appendTo(self.tableDOM);
			if (jqXHR.responseJSON.error.indexOf('Overflow') != -1) {
				$('<p/>').text('Die Kombindation aus sehr hoher Seitenzahl und sortierter Spalte benötigt zu viele Resourcen. Sortieren Sie in umgekehrter Reihenfolge oder reduzieren Sie die Anzahl der Seiten mit weiteren Filtern.').appendTo(self.tableDOM);
			}

		}
	})

};

StudentList.prototype.findQuery = function (q) {
	for (var qId in this.definitions['queries']) {
		var query = this.definitions['queries'][qId];
		if (query.q == q) return query;
	}
	return null;
};

StudentList.prototype.getMarkedInfo = function (ident) {
	var self = this;
	if (!self.markedData) return null;
	for (var i = 0; i < self.markedData.list.length; i++) {
		var mark = self.markedData.list[i];
		if (mark.ident == ident) return mark;
	}
	return null;
};

StudentList.prototype.loadMarkedInfo = function () {
	var self = this;
	var url = '/api/GetMarkedStudents';

	var idents = [];
	for (var i = 0; i < self.data.list.length; i++) {
		var d = self.data.list[i];
		idents.push(d.ident);
	}


	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify({
			idents: idents
		})
	}).success(function (data) {

		self.markedData = data;

		self.draw();

	}).fail(function () {
	})

};

StudentList.prototype.openCalculationsDialog = function (student) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Durchschnittliche Berechnungen');

	$('<p />').text('Die Durchschnittswerte beziehen sich auf die aktuelle Filterauswahl.').appendTo(dialogBox);

	function drawDataRow(field, value, query) {

		var boxO = document.createElement('tr');
		boxO.className = 'dataRow';

		var nameO = boxO.appendChild(document.createElement('td'));
		nameO.className = 'name';

		var valueO = boxO.appendChild(document.createElement('td'));
		valueO.className = 'value';

		var tempO = null;

		if (query) {
			nameO.appendChild(document.createTextNode(query.name));
			valueO.appendChild(getFormattedHTML(value, query.formatting));
		} else {
			nameO.appendChild(document.createTextNode(field));
			valueO.appendChild(getFormattedHTML(value, 'auto'));
		}

		return boxO;
	}

	var url = '/api/GetStudents';

	var params = [];
	params.push('do_calc=avgs');
	var filterQueries = this.filter.getQueries(false);
	for (var name in filterQueries) {
		params.push(name + '=' + encodeURIComponent(filterQueries[name]));
	}


	if (params.length) url += '?';
	url += params.join('&');


	$.ajax({
		url: url
	}).success(function (data) {

		var dl = document.createElement('table');
		dl.className = 'tbl datalist';

		var entries = data.avgs;

		var field, query;
		for (field in entries) {
			if (field == '_id') continue;
			query = self.findQuery(field);
			dl.appendChild(drawDataRow(field, entries[field], query));
		}

		sortElements($(dl));

		dialogBox.append(dl);

	}).fail(function () {
	});


	dialogBox.dialog({
		width: 500,
		modal: false
	});

};

StudentList.prototype.openDetailDialog = function (student) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Studenten Details ' + student.ident);

	function drawDataRow(field, value, query) {

		var boxO = document.createElement('tr');
		boxO.className = 'dataRow';

		var nameO = boxO.appendChild(document.createElement('td'));
		nameO.className = 'name';


		var valueO = boxO.appendChild(document.createElement('td'));
		valueO.className = 'value';

		var tempO = null;

		if (field == 'risk') {
			nameO.appendChild(document.createTextNode('Risikowahrscheinlichkeit'));
			for (var succField in value) {
				tempO = valueO.appendChild(document.createElement('div'));
				tempO.appendChild(document.createTextNode(succField + ': '));
				tempO.appendChild(getFormattedHTML(value[succField], 'percent'));
			}

		} else if (field == 'study_semesters' && Array.isArray(value)) {
			nameO.appendChild(document.createTextNode('Semester mit Prüfungen'));
			value.forEach(function (semnr, i) {
				if (i) valueO.appendChild(document.createTextNode(', '));
				valueO.appendChild(getFormattedHTML(semnr, 'semester'));
			});

		} else if (query) {
			nameO.appendChild(document.createTextNode(query.name));
			valueO.appendChild(getFormattedHTML(value, query.formatting));
		} else {
			nameO.appendChild(document.createTextNode(field));
			valueO.appendChild(getFormattedHTML(value, 'auto'));
		}

		return boxO;
	}

	var dl = document.createElement('table');
	dl.className = 'tbl datalist';

	var field, query;
	for (field in student) {
		query = self.findQuery(field);
		if (query) {
			dl.appendChild(drawDataRow(field, student[field], query));
		}
	}
	for (field in student) {
		query = self.findQuery(field);
		if (!query) {
			dl.appendChild(drawDataRow(field, student[field], query));
		}
	}

	dialogBox.append(dl);

	dialogBox.dialog({
		width: 500,
		modal: false,
		buttons: {
			'Detailseite': function () {
				location.href = 'student_detail.html?id=' + student.ident;
			},
			Close: function () {
				$(this).dialog("close");
			}
		}

	});

};

StudentList.prototype.openMarkedListSettingsDialog = function () {
	var self = this;

	var mlist = self.data['mlist'];
	if (!mlist) {
		return;
	}

	var mlists = new MarkedLists($(document.createElement('div')));
	var box = mlists.drawMarkedListSettings(mlist, self.definitions['user_roles']);


	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Vormerkungsliste Einstellungen');

	var status = $(document.createElement('p')).appendTo(dialogBox);

	dialogBox.append(box);


	var buttons = {};
	buttons['Speichern'] = function () {

		var data = box.getValues();

		$.ajax({
			url: '/api/SaveMarkedList?ident=' + mlist.ident,
			type: 'POST',
			contentType: 'application/json; charset=utf-8',
			data: JSON.stringify(data)
		}).success(function (data) {
			status.removeClass('loading');
			if (data && data.mlist) {
				self.data['mlist'] = data.mlist;
				self.draw();
			}
			$(dialogBox).dialog("close");

		}).fail(function () {
			status.removeClass('loading');
			status.text('Speichern der Daten ist fehlgeschlagen.');
		});

	};
	if (mlist['deleteable'] && mlist['owner'] == getUserName()) {
		buttons['Löschen'] = function () {
			$.ajax({
				url: '/api/SaveMarkedList?ident=' + mlist.ident,
				type: 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({'delete': true})
			}).success(function (data) {
				status.removeClass('loading');
				$(dialogBox).dialog("close");
				location.href = 'markedlists.html';

			}).fail(function () {
				status.removeClass('loading');
				status.text('Speichern der Daten ist fehlgeschlagen.');
			});

		};
	}
	buttons['Abbrechen'] = function () {
		$(dialogBox).dialog("close");
	};


	dialogBox.dialog({
		width: 400,
		modal: true,
		buttons: buttons
	});

};

StudentList.prototype.openDownloadDialog = function (studentIds) {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Herunterladen als CSV');


	function drawRow(col) {
		if (col.noDownload) return null;

		var boxO = document.createElement('li');
		boxO.className = 'colrow';
		boxO.colId = col.id;

		var labelO = boxO.appendChild(document.createElement('label'));

		var checkO = labelO.appendChild(document.createElement('input'));
		checkO.className = 'name';
		checkO.type = 'checkbox';

		checkO.checked = self.columns.indexOf(col.id) !== -1;
		if (self.mandatoryColumns.indexOf(col.id) !== -1) {
			checkO.disabled = true;
		}

		if (checkO.checked) {
			boxO.className += ' sortable';
			var orderBox = document.createElement('div');
			orderBox.className = 'orderbox';
			boxO.appendChild(orderBox);
		}

		labelO.appendChild(document.createTextNode(col.label));

		return boxO;
	}

	var ul = $(document.createElement('ul'));
	ul.addClass('columnlist');
	var i, col;
	for (i = 0; i < this.columns.length; i++) {
		col = self.columnData[self.columns[i]];
		ul.append(drawRow(col));
	}

	var columnsSorted = Object.keys(self.columnData);
	columnsSorted.sort(function (a, b) {
		var cola = self.columnData[a];
		var colb = self.columnData[b];
		if (cola.label < colb.label) return -1;
		if (cola.label > colb.label) return 1;
		return 0;
	});
	for (var j = 0; j < columnsSorted.length; j++) {
		var colId = columnsSorted[j];
		if (self.columns.indexOf(colId) === -1) {
			ul.append(drawRow(self.columnData[colId]));
		}
	}

	dialogBox.append(ul);

	ul.sortable();

	dialogBox.dialog({
		width: 400,
		maxHeight: 500,
		modal: true,
		buttons: {
			'Herunterladen': function () {

				var url = '/api/GetStudents';

				var params = [];
				var filterQueries = self.filter.getQueries(false);
				for (var name in filterQueries) {
					params.push(name + '=' + encodeURIComponent(filterQueries[name]));
				}

				params.push('sort1=' + self.pagination.sort1);
				if (self.pagination.sort2)
					params.push('sort2=' + self.pagination.sort2);
				if (self.mlistId) {
					params.push('mlist=' + self.mlistId);
				}
				if(studentIds) {
					params.push('idents=' + encodeURIComponent(studentIds.join(',')));
				}

				params.push('output=csv');

				if (params.length) url += '?';
				url += params.join('&');


				var columns = [];
				$(this).find('li').each(function () {
					var checkO = $('input', this)[0];
					if (checkO.checked && this.colId && self.columnData[this.colId]) {
						var col = self.columnData[this.colId];
						columns.push({
							q: col.id,
							name: col.label,
							formatting: col.formatting
						});
					}
				});

				var form = document.createElement('form');
				form.action = url;
				form.method = 'post';
				form.target = 'download';

				var input = document.createElement('input');
				input.type = 'hidden';
				input.name = 'csvcolumns';
				input.value = JSON.stringify(columns);
				form.appendChild(input);

				dialogBox.append(form);

				form.submit();

				$(this).dialog("close");

			},
			'Abbrechen': function () {
				$(this).dialog("close");
			}
		}
	});

};
