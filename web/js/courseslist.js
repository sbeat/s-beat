// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function CoursesList(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'courses_';
	this.settings = {
		'default': {
			limit: 100,
			sort1: '_id,1',
			sort2: null,
			filters: [],
			columns: ['stg_original', 'stg', 'name', 'degree_type', 'faculty', 'semesters', 'count_students', 'count_failed', 'count_successful', 'risk_data.mean'],
			displayPagination: true,
			sortable: true
		},
		'details': {
			limit: 100,
			sort1: '_id,-1',
			sort2: null,
			filters: [],
			columns: ['stg_original', 'semesters', 'count_students', 'count_failed', 'count_successful'],
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
		'stg_original': {id: 'stg_original', label: 'Kürzel', title: 'Kürzel', formatting: 'str', sortBy: '_id'},
		'stg': {id: 'stg', label: 'Gruppe', title: 'Gruppe', formatting: 'str'},
		'name': {id: 'name', label: 'Name', title: 'Name', formatting: 'str'},
		'faculty': {id: 'faculty', label: CONFIG.faculty_label, title: CONFIG.faculty_label, formatting: 'int'},
		'semesters': {id: 'semesters', label: 'Regelstu- dienzeit', title: 'Regelstudienzeit', formatting: 'int'},
		'degree_type': {id: 'degree_type', label: 'Abschluss', title: 'Abschlussart', formatting: 'str'},
		'count_finished': {
			id: 'count_finished',
			label: 'Studium abgeschl.',
			title: 'Studium abgeschlossen',
			formatting: 'int'
		},
		'count_successful': {
			id: 'count_successful',
			label: 'Studium erfolgreich',
			title: 'Studium erfolgreich',
			formatting: 'int'
		},
		'count_failed': {
			id: 'count_failed',
			label: 'Studium nicht erfolgreich',
			title: 'Studium nicht erfolgreich',
			formatting: 'int'
		},
		'count_students': {
			id: 'count_students',
			label: 'Anzahl Studenten',
			title: 'Anzahl Studenten',
			formatting: 'int'
		},
		'female_perc': {
			id: 'female_perc',
			label: 'Frauenanteil',
			title: 'Prozentualer Anteil weiblicher Studenten',
			formatting: 'percent'
		},
		'male_perc': {
			id: 'male_perc',
			label: 'Männeranteil',
			title: 'Prozentualer Anteil männlicher Studenten',
			formatting: 'percent'
		},
		'risk_data.mean': {
			id: 'risk_data.mean',
			label: 'Ø Risiko in %',
			title: 'Durchschnittliches Risiko in %',
			formatting: 'percent'
		},
		'age_data.mean': {
			id: 'age_data.mean',
			label: 'Ø Alter',
			title: 'Durchschnittliches Alter bei Immatrikulation',
			formatting: 'int'
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
		'hzb_grade_data.mean': {
			id: 'hzb_grade_data.mean',
			label: 'Ø HZB Note',
			title: 'Durchschnittliche Note der Hochschulzugangsberechtigung',
			formatting: 'grade'
		},
		'exam_perc_resigned': {
			id: 'exam_perc_resigned',
			label: 'Rücktritte in %',
			title: 'Anteil der Prüfungsleistungen von welchen zurückgetreten wurde',
			formatting: 'percent'
		},
		'exams_per_student': {
			id: 'exams_per_student',
			label: 'PL pro Student',
			title: 'Prüfungsleistungen pro Student',
			formatting: 'int'
		},
		'applicants.count': {id: 'applicants.count', label: 'Bewerber', title: 'Anzahl Bewerber', formatting: 'int'},
		'applicants.count_per_student': {
			id: 'applicants.count_per_student',
			label: 'Bewerber pro Platz',
			title: 'Bewerber pro Platz',
			formatting: 'float'
		}
	};
	this.columns = this.settings.default.columns.slice();
	this.mandatoryColumns = ['stg_original'];

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

	CoursesList.prototype.init.call(this);
}

/**
 * Gets called once this CoursesList is initialized
 */
CoursesList.prototype.init = function () {
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
 * Gets called every time the CoursesList must be drawn completely
 */
CoursesList.prototype.draw = function () {
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
CoursesList.prototype.drawCourse = function (course) {

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
CoursesList.prototype.drawCellValue = function (course, col, td) {
	var self = this;
	var value;

	if (col.id == 'stg') {
		value = getByPath(col.id, course);
		var idA = $(document.createElement('a'));
		idA.attr('href', 'coursedetails.html?stg=' + encodeURIComponent(value));
		idA.text(value);
		td.append(idA);

	} else if (col.id == 'risk_data.mean') {
		value = getByPath(col.id, course);
		td.append(getFormattedHTML(value ? value / 100 : null, col.formatting));

	} else {
		value = getByPath(col.id, course);
		td.append(getFormattedHTML(value, col.formatting));
	}

};

CoursesList.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;

	if (self.data && self.data.hide_resigned) {
		self.removeDataColumn('exam_perc_resigned');
	}
	if (self.data && !self.data.import_applicants) {
		Object.keys(self.columnData).forEach(function (key) {
			if (key.indexOf('applicants.') === 0) {
				self.removeDataColumn(key);
			}
		});

	}
};

CoursesList.prototype.load = function () {
	var self = this;
	var url = '/api/GetCourses';

	self.saveSettings();

	var params = [];
	params.push('ignore=false');
	if (self.courseStg) {
		params.push('stg=' + encodeURIComponent(self.courseStg));
	}

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if (self.pagination.sort2)
		params.push('sort2=' + self.pagination.sort2);

	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.tableDOM.removeClass('loading');

		self.data = data;
		self.pagination.update(data);

		self.draw();

	}).fail(function () {
		self.tableDOM.removeClass('loading');
		self.tableDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};