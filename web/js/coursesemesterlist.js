// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function CourseSemesterList(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'coursesemester_';
	this.settings = {
		'default': {
			limit: 100,
			sort1: 'semester_id,1',
			sort2: null,
			filters: [],
			columns: ['semester_id', 'students.count', 'students.studying', 'students.failed', 'students.failed_perc',
				'students.successful', 'risk_data.mean', 'grade_data.mean', 'exams.resign_perc'],
			displayPagination: true,
			sortable: true
		}
	};
	this.courseStg = parentDOM.attr('data-stg');

	this.paginationDOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.limit = this.settings.default.limit;
	this.displayPagination = true;
	this.sortable = true;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;
	this.pagination.sortOptions = {};

	this.columnData = {
		'semester_id': {id: 'semester_id', label: 'Startsemester', title: 'Startsemester', formatting: 'semester'},
		'students.count': {
			id: 'students.count',
			label: 'Studenten',
			title: 'Anzahl der Studenten in dem Startsemester',
			formatting: 'int'
		},
		'students.studying': {
			id: 'students.studying',
			label: 'Studierend',
			title: 'Aktuell studierende',
			formatting: 'int'
		},
		'students.failed': {
			id: 'students.failed',
			label: 'Abgebrochen',
			title: 'Anzahl der Abbrecher',
			formatting: 'int'
		},
		'students.failed_perc': {
			id: 'students.failed_perc',
			label: 'Abgebrochen in %',
			title: 'Anteil Studenten, welche ihr Studium abgebrochen haben',
			formatting: 'percent'
		},
		'students.success_perc': {
			id: 'students.success_perc',
			label: 'Erfolgreich in %',
			title: 'Anteil Studenten, welche ihr Studium erfolgreich abgeschlossen haben',
			formatting: 'percent'
		},
		'students.successful': {
			id: 'students.successful',
			label: 'Erfolgreich beendet',
			title: 'Anzahl Studenten, welche den Studiengang erfolgreich abgeschlossen haben',
			formatting: 'int'
		},
		'risk_data.mean': {
			id: 'risk_data.mean',
			label: 'Ø Risiko in %',
			title: 'Durchschnittlicher Risikowert',
			formatting: 'percent'
		},
		'grade_data.mean': {
			id: 'grade_data.mean',
			label: 'Ø Note',
			title: 'Durchschnittliche aktuelle Note',
			formatting: 'grade'
		},
		'exams.resign_perc': {
			id: 'exams.resign_perc',
			label: 'Rücktritte in %',
			title: 'Anteil der Rücktritte von Prüfungsleistungen',
			formatting: 'percent'
		},
		'students.female_perc': {
			id: 'students.female_perc',
			label: 'Frauenanteil',
			title: 'Prozentualer Anteil weiblicher Studenten',
			formatting: 'percent'
		},
		'students.male_perc': {
			id: 'students.male_perc',
			label: 'Männeranteil',
			title: 'Prozentualer Anteil männlicher Studenten',
			formatting: 'percent'
		},
		'age_data.mean': {
			id: 'age_data.mean',
			label: 'Ø Alter',
			title: 'Durchschnittliches Alter bei Immatrikulation',
			formatting: 'float'
		},
		'age_data.max': {
			id: 'age_data.max',
			label: 'Höchstes Alter',
			title: 'Höchstes Alter eines Studenten',
			formatting: 'int'
		},
		'age_data.min': {
			id: 'age_data.min',
			label: 'Niedrigstes Alter',
			title: 'Niedrigstes Alter eines Studenten',
			formatting: 'int'
		},
		'semesters_failed_data.mean': {
			id: 'semesters_failed_data.mean',
			label: 'Ø Semester bei Abbruch',
			title: 'Durchschnittliche Semesteranzahl bei Abbruch',
			formatting: 'float'
		},
		'semesters_failed_data.max': {
			id: 'semesters_failed_data.max',
			label: 'Max. Semester bei Abbruch',
			title: 'Max. Semester bei Abbruch',
			formatting: 'int'
		},
		'semesters_failed_data.min': {
			id: 'semesters_failed_data.min',
			label: 'Min. Semester bei Abbruch',
			title: 'Min. Semester bei Abbruch',
			formatting: 'int'
		},
		'semesters_success_data.mean': {
			id: 'semesters_success_data.mean',
			label: 'Ø Semester bei Erfolg',
			title: 'Durchschnittliche Semesteranzahl bei Erfolg',
			formatting: 'float'
		},
		'semesters_success_data.max': {
			id: 'semesters_success_data.max',
			label: 'Max. Semester bei Erfolg',
			title: 'Max. Semester bei Erfolg',
			formatting: 'int'
		},
		'semesters_success_data.min': {
			id: 'semesters_success_data.min',
			label: 'Min. Semester bei Erfolg',
			title: 'Min. Semester bei Erfolg',
			formatting: 'int'
		},
		'hzb_grade_data.mean': {
			id: 'hzb_grade_data.mean',
			label: 'Ø HZB Note',
			title: 'Durchschnittliche Note der Hochschulzugangsberechtigung',
			formatting: 'grade'
		},
		'exams.count': {
			id: 'exams.count',
			label: 'Prüfungsleistungen',
			title: 'Anzahl der Prüfungsleistungen',
			formatting: 'int'
		},
		'exams.success_perc': {
			id: 'exams.success_perc',
			label: 'Bestandene Leistungen in %',
			title: 'Anteil bestandener Leistungen',
			formatting: 'percent'
		},
		'exams.failed_perc': {
			id: 'exams.failed_perc',
			label: 'Nicht bestandene Leistungen in %',
			title: 'Anteil nicht bestandener Leistungen',
			formatting: 'percent'
		},
		'bonus_data.mean': {
			id: 'bonus_data.mean',
			label: 'Ø ' + CONFIG.cp_label,
			title: 'Durchschnittliche ' + CONFIG.cp_label + ' Anzahl',
			formatting: 'int'
		},
		'bonus_data.max': {
			id: 'bonus_data.max',
			label: 'Höchste ' + CONFIG.cp_label,
			title: 'Höchste ' + CONFIG.cp_label + ' Anzahl',
			formatting: 'int'
		},
		'bonus_data.min': {
			id: 'bonus_data.min',
			label: 'Niedrigste ' + CONFIG.cp_label,
			title: 'Niedrigste ' + CONFIG.cp_label + ' Anzahl',
			formatting: 'int'
		},
		'applicants.count': {
			id: 'applicants.count',
			label: 'Bewerber',
			title: 'Anzahl Bewerber',
			formatting: 'int'
		},
		'applicants.admitted': {
			id: 'applicants.admitted',
			label: 'Zugelassene Bewerber',
			title: 'Anzahl zugelassene Bewerber',
			formatting: 'int'
		},
		'applicants.count_per_student': {
			id: 'applicants.count_per_student',
			label: 'Bewerber pro Platz',
			title: 'Bewerber pro Platz',
			formatting: 'float'
		},
		'applicants.denied_quote': {
			id: 'applicants.denied_quote',
			label: 'Ablehnungsquote',
			title: 'Nicht zugelassen / Anzahl Bewerber',
			formatting: 'percent'
		},
		'applicants.refusal_quote': {
			id: 'applicants.refusal_quote',
			label: 'Absagequote',
			title: '(Zugelassene Bewerber - Anzahl Studenten) / Zugelassene Bewerber',
			formatting: 'percent'
		},
		'applicants.accept_quote': {
			id: 'applicants.accept_quote',
			label: 'Annahmequote',
			title: 'Anzahl Studenten / Zugelassene Bewerber',
			formatting: 'percent'
		},
		'applicants.hzb_grade_data.mean': {
			id: 'applicants.hzb_grade_data.mean',
			label: 'Ø HZB Note Bewerber',
			title: 'Durchschnittliche Note der Hochschulzugangsberechtigung von Bewerbern',
			formatting: 'grade'
		},
		'applicants.hzb_grade_data.min': {
			id: 'applicants.hzb_grade_data.mean',
			label: 'Min. HZB Note Bewerber',
			title: 'Minimale Note der Hochschulzugangsberechtigung von Bewerbern',
			formatting: 'grade'
		},
		'applicants.hzb_grade_data.max': {
			id: 'applicants.hzb_grade_data.max',
			label: 'Max. HZB Note Bewerber',
			title: 'Maximale Note der Hochschulzugangsberechtigung von Bewerbern',
			formatting: 'grade'
		}
	};
	this.columns = this.settings.default.columns.slice();
	this.mandatoryColumns = ['semester_id'];

	this.tableDOM = $(document.createElement('table'));

	this.data = null; // Last loaded data
	this.metadata = null;

	this.calc = null;

	this.drawn = false;

	this.openColumnDialog = openColumnDialog;
	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;
	this.removeDataColumn = removeDataColumn;

	CourseSemesterList.prototype.init.call(this);
}

/**
 * Gets called once this CourseSemesterList is initialized
 */
CourseSemesterList.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	for (var colId in this.columnData) {
		var col = this.columnData[colId];
		var sf = col.id;
		if (col.sortBy) {
			sf = col.sortBy;
		}
		this.pagination.sortOptions[sf + ',1'] = col.label + ' aufsteigend';
		this.pagination.sortOptions[sf + ',-1'] = col.label + ' absteigend';
	}


	self.loadSettings();

	self.draw();

	this.pagination.changed = function (start) {
		self.load();
	};
	this.pagination.onReset = function () {
		self.loadPresetSettings(self.settingId);
		self.load();
	};

	self.load();

};

/**
 * Gets called every time the CourseSemesterList must be drawn completely
 */
CourseSemesterList.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.tableDOM.addClass('studentList tbl sortable');
		this.parentDOM.append(this.tableDOM);

		this.calcDOM = $(document.createElement('div'));
		this.calcDOM.addClass('calc');
		this.parentDOM.append(this.calcDOM);

		this.pagination.addLink('Einstellungen', function () {
			self.openSettingsDialog();
		});
		this.pagination.addLink('Spaltenauswahl', function () {
			self.openColumnDialog();
		});

		this.drawn = true;
	}

	if (this.displayPagination) this.paginationDOM.show();
	else this.paginationDOM.hide();


	if (!this.data) {
		this.tableDOM.text('Keine Daten verfügbar');
		return;
	}


	this.pagination.draw();

	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	drawTableHead.call(this, tr, 'tooltip_course_');

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


	var tbody = $(document.createElement('tbody'));
	this.tableDOM.append(tbody);

	for (i = 0; i < this.data.list.length; i++) {
		var course = this.data.list[i];

		tbody.append(this.drawCourse(course));
	}

	adjustTableHeaders(this.tableDOM);


};
CourseSemesterList.prototype.drawCourse = function (course) {

	var tr = $(document.createElement('tr'));
	tr.addClass('course');

	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(course, col, td);
	}

	return tr

};
CourseSemesterList.prototype.drawCellValue = function (course, col, td) {
	var self = this;
	var value = getByPath(col.id, course);

	if (col.id == 'risk_data.mean') {
		td.append(getFormattedHTML(value ? value / 100 : null, col.formatting));

	} else if (col.id == 'semester_id') {
		$(document.createElement('a'))
			.attr('href', 'coursesemesterdetails.html?stg=' + encodeURIComponent(self.courseStg) + '&sem=' + course.semester_id)
			.append(getFormattedHTML(value, col.formatting))
			.appendTo(td);

	} else {
		td.append(getFormattedHTML(value, col.formatting));
	}

};

CourseSemesterList.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;

	if (self.data && self.data.hide_resigned) {
		self.removeDataColumn('exams.resign_perc');
	}
	if (self.data && !self.data.import_applicants) {
		Object.keys(self.columnData).forEach(function (key) {
			if (key.indexOf('applicants.') === 0) {
				self.removeDataColumn(key);
			}
		});
	}

};

CourseSemesterList.prototype.load = function () {
	var self = this;
	var url = '/api/GetCourseSemesterInfos';

	self.saveSettings();

	var params = [];
	if (self.courseStg) {
		params.push('stg=' + encodeURIComponent(self.courseStg));
	}

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if (self.pagination.sort2)
		params.push('sort2=' + self.pagination.sort2);
	if (!self.metadata) {
		params.push('metadata=true');
	}

	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.tableDOM.removeClass('loading');

		self.data = data;

		self.initMetadata(data.metadata);

		self.pagination.update(data);

		self.draw();

	}).fail(function () {
		self.tableDOM.removeClass('loading');
		self.tableDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};