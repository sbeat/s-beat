// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function ExamList(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'exams_';
	this.settings = {
		'default': {
			limit: 100,
			sort1: 'semester,1',
			filters: [],
			columns: ['exam_id', 'student_id', 'semester', 'stg', 'name', 'status', 'recognized', 'mandatory', 'try_nr', 'type', 'bonus', 'grade'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
		'exam': {
			limit: 100,
			sort1: 'semester,1',
			filters: [],
			columns: ['student_id', 'semester', 'stg', 'name', 'status', 'recognized', 'mandatory', 'try_nr', 'type', 'form', 'bonus', 'grade'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
		'student': {
			limit: 100,
			sort1: 'semester,1',
			filters: [],
			columns: ['exam_id', 'semester', 'name', 'status', 'recognized', 'mandatory', 'try_nr', 'type', 'bonus', 'grade', 'phase'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
//	filter: status == 'AN', semester == aktSemester, comment == None bzw. ''
//	columns: EDV Nr., Prüfungsleistung Name, Pflicht, Vers., Art, ECTS
		'current': {
			limit: 100,
			sort1: 'semester,1',
			filters: [
				{
					"id": "status",
					"name": "Status",
					"group": "Leistung",
					"type": "attribute",
					"formatting": "str",
					"value": "AN"
				},
				{
					"id": "semester",
					"name": "Semester",
					"group": "Leistung",
					"type": "attribute",
					"formatting": "semester",
					"value": "current"
				}
			],
			columns: ['exam_id', 'name', 'status', 'mandatory', 'try_nr', 'type', 'bonus'],
			displayFilters: false,
			displayPagination: false,
			sortable: true,
			displayStats: false
		}
	};
	this.examInfoId = parentDOM.attr('data-examinfoid');
	this.studentId = parentDOM.attr('data-id');

	this.displayStats = this.studentId ? true : false;
	this.displayFilters = true;
	this.displayPagination = true;
	this.sortable = true;

	this.paginationDOM = $(document.createElement('div'));
	this.pagination2DOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.limit = this.settings.default.limit;
	this.pagination.start = 0;
	this.pagination.secondaryDOM = this.pagination2DOM;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;
	this.pagination.sortOptions = {};

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);


	//Spaltenauswahl für Notenspiegel ohne StudentID und STG
	if (this.settingId == 'student') {

		this.columnData = {
			//'student_id': {id: 'student_id', label: 'Student ID', title: 'ID des Studenten', formatting: 'int'},
			'exam_id': {id: 'exam_id', label: CONFIG.exam_id_label, title: CONFIG.exam_id_desc, formatting: 'int'},
			//'stg': {id: 'stg', label: 'Studiengangsgruppe', title: 'Studiengangsgruppe', formatting: 'stg'},
			'name': {id: 'name', label: 'Prüfungsleistung Name', title: 'Prüfungsleistung Name', formatting: 'str'},
			'semester': {id: 'semester', label: 'Semester', title: 'Semester der Leistung', formatting: 'semester'},
			'bonus': {id: 'bonus', label: CONFIG.cp_label, title: CONFIG.cp_label+' Punkte für die Leistung', formatting: 'int'},
			'grade': {id: 'grade', label: 'Note', title: 'Note der Leistung', formatting: 'grade'},
			//'degree_type': {id: 'degree_type', label: 'Abschluss', title: 'Abschlussart', formatting: 'str'},
			//'by': {id: 'by', label: 'Prüfer', title: 'Prüfer', formatting: 'str', sortBy: 'by_surname'},
			//'by_surname': {id: 'by_surname', label: 'Prüfer Name', title: 'Prüfer Nachname', formatting: 'str'},
			//'by_forename': {id: 'by_forename', label: 'Prüfer Vorname', title: 'Prüfer Nachname', formatting: 'str'},
			'status': {id: 'status', label: 'Status', title: 'Status der Leistung', formatting: 'str'},
			'type': {id: 'type', label: 'Art', title: 'Art der Leistung', formatting: 'str'},
			'form': {id: 'form', label: 'Form', title: 'Form der Leistung', formatting: 'str'},
			'try_nr': {id: 'try_nr', label: 'Versuch', title: 'Versuch Nr.', formatting: 'int'},
			'mandatory': {id: 'mandatory', label: 'Pflicht', title: 'Pflichtbereich der Leistung', formatting: 'str'},
			'comment': {id: 'comment', label: 'Vermerk', title: 'Vermerk', formatting: 'str'},
			'phase': {id: 'phase', label: 'Phase', title: 'Phase im Studium', formatting: 'str'},
			'recognized': {
				id: 'recognized',
				label: 'Anerkannt',
				title: 'Ist eine anerkannte Prüfungsleistung',
				formatting: 'yesno'
			},
			'date': {id: 'date', label: 'Datum', title: 'Datum der Leistung', formatting: 'date'}
		};
	}

	//Für Notenspiegel auf Exam Detail Seite ohne Exam ID als Spaltenauswahl
	if (this.settingId == 'exam') {

		this.columnData = {
			'student_id': {id: 'student_id', label: 'Student ID', title: 'ID des Studenten', formatting: 'int'},
			//'exam_id': {id: 'exam_id', label: 'EDV Nr.', title: 'ID der Prüfungsleistung', formatting: 'int'},
			'stg': {id: 'stg', label: 'Studiengangsgruppe', title: 'Studiengangsgruppe', formatting: 'stg'},
			'name': {id: 'name', label: 'Prüfungsleistung Name', title: 'Prüfungsleistung Name', formatting: 'str'},
			'semester': {id: 'semester', label: 'Semester', title: 'Semester der Leistung', formatting: 'semester'},
			'bonus': {id: 'bonus', label: CONFIG.cp_label, title: CONFIG.cp_label+' Punkte für die Leistung', formatting: 'int'},
			'grade': {id: 'grade', label: 'Note', title: 'Note der Leistung', formatting: 'grade'},
			//'degree_type': {id: 'degree_type', label: 'Abschluss', title: 'Abschlussart', formatting: 'str'},
			//'by': {id: 'by', label: 'Prüfer', title: 'Prüfer', formatting: 'str', sortBy: 'by_surname'},
			//'by_surname': {id: 'by_surname', label: 'Prüfer Name', title: 'Prüfer Nachname', formatting: 'str'},
			//'by_forename': {id: 'by_forename', label: 'Prüfer Vorname', title: 'Prüfer Nachname', formatting: 'str'},
			'status': {id: 'status', label: 'Status', title: 'Status der Leistung', formatting: 'str'},
			'type': {id: 'type', label: 'Art', title: 'Art der Leistung', formatting: 'str'},
			'form': {id: 'form', label: 'Form', title: 'Form der Leistung', formatting: 'str'},
			'try_nr': {id: 'try_nr', label: 'Versuch', title: 'Versuch Nr.', formatting: 'int'},
			'mandatory': {id: 'mandatory', label: 'Pflicht', title: 'Pflichtbereich der Leistung', formatting: 'str'},
			'comment': {id: 'comment', label: 'Vermerk', title: 'Vermerk', formatting: 'str'},
			'phase': {id: 'phase', label: 'Phase', title: 'Phase im Studium', formatting: 'str'},
			'recognized': {
				id: 'recognized',
				label: 'Anerkannt',
				title: 'Ist eine anerkannte Prüfungsleistung',
				formatting: 'yesno'
			},
			'date': {id: 'date', label: 'Datum', title: 'Datum der Leistung', formatting: 'date'}

		};

	}

	else {
		this.columnData = {
			'student_id': {id: 'student_id', label: 'Student ID', title: 'ID des Studenten', formatting: 'int'},
			'exam_id': {id: 'exam_id', label: CONFIG.exam_id_label, title: CONFIG.exam_id_desc, formatting: 'int'},
			'stg': {id: 'stg', label: 'Studiengangsgruppe', title: 'Studiengangsgruppe', formatting: 'stg'},
			'name': {id: 'name', label: 'Prüfungsleistung Name', title: 'Prüfungsleistung Name', formatting: 'str'},
			'semester': {id: 'semester', label: 'Semester', title: 'Semester der Leistung', formatting: 'semester'},
			'bonus': {id: 'bonus', label: CONFIG.cp_label, title: CONFIG.cp_label+' Punkte für die Leistung', formatting: 'int'},
			'grade': {id: 'grade', label: 'Note', title: 'Note der Leistung', formatting: 'grade'},
			//'degree_type': {id: 'degree_type', label: 'Abschluss', title: 'Abschlussart', formatting: 'str'},
			//'by': {id: 'by', label: 'Prüfer', title: 'Prüfer', formatting: 'str', sortBy: 'by_surname'},
			//'by_surname': {id: 'by_surname', label: 'Prüfer Name', title: 'Prüfer Nachname', formatting: 'str'},
			//'by_forename': {id: 'by_forename', label: 'Prüfer Vorname', title: 'Prüfer Nachname', formatting: 'str'},
			'status': {id: 'status', label: 'Status', title: 'Status der Leistung', formatting: 'str'},
			'type': {id: 'type', label: 'Art', title: 'Art der Leistung', formatting: 'str'},
			'form': {id: 'form', label: 'Form', title: 'Form der Leistung', formatting: 'str'},
			'try_nr': {id: 'try_nr', label: 'Versuch', title: 'Versuch Nr.', formatting: 'int'},
			'mandatory': {id: 'mandatory', label: 'Pflicht', title: 'Pflichtbereich der Leistung', formatting: 'str'},
			'comment': {id: 'comment', label: 'Vermerk', title: 'Vermerk', formatting: 'str'},
			'phase': {id: 'phase', label: 'Phase', title: 'Phase im Studium', formatting: 'str'},
			'recognized': {
				id: 'recognized',
				label: 'Anerkannt',
				title: 'Ist eine anerkannte Prüfungsleistung',
				formatting: 'yesno'
			},
			'date': {id: 'date', label: 'Datum', title: 'Datum der Leistung', formatting: 'date'}
		};
	}
	this.columns = ['exam_id', 'semester', 'stg', 'name', 'status', 'mandatory', 'try_nr', 'type', 'bonus', 'grade', 'by_surname'];
	this.mandatoryColumns = [];

	this.tableDOM = $(document.createElement('table'));

	this.data = null; // Last loaded data
	this.metadata = null;

	this.drawn = false;

	this.openColumnDialog = openColumnDialog;
	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;
	this.removeColumn = removeDataColumn;

	ExamList.prototype.init.call(this);
}
/**
 * Gets called once this ExamList is initialized
 */
ExamList.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	// not necessary anymore, decided previously when the columnData attributes get created.
	var ignoreOnExamId = ['exam_id', 'bonus', 'name', 'type'];
	var ignoreOnStudentId = ['student_id', 'stg'];

	for (var colId in this.columnData) {
		var col = this.columnData[colId];
		if (
			(!this.examInfoId || ignoreOnExamId.indexOf(colId) == -1)
			&& (!this.studentId || ignoreOnStudentId.indexOf(colId) == -1)
			&& colId != 'degree_type'
		) {
			this.filter.addAttributeFilter(col.id, col.label, 'Leistung', col.formatting, col.formatting == 'int' ? 0 : '');
		}

		if (col.sortBy) continue;
		this.pagination.sortOptions[col.id + ',1'] = col.label + ' aufsteigend';
		this.pagination.sortOptions[col.id + ',-1'] = col.label + ' absteigend';
	}

	this.filter.sortFilters();

	this.pagination.onReset = function () {
		self.loadPresetSettings(self.settingId);
		self.load();
	};

	self.loadSettings();

	var query = parseQuery(location.href);
	/*
	 if(query['exam_id']) {
	 var fi=self.filter.getFilterById('exam_id');
	 if(fi) {
	 fi.value = query['exam_id'];
	 self.filter.removeFilter(fi);
	 self.filter.addFilter(fi);
	 }
	 }
	 */


	self.draw();

	this.pagination.changed = function (start) {
		self.load();
	};

	this.filter.filterChanged = function () {
		self.pagination.setStart(0);
		self.load();
	};

	var asyncParent = this.parentDOM.parents('[data-asyncload=1]');
	if (asyncParent.size()) {
		asyncParent.one('show', function () {
			self.load();
		});

	} else {
		self.load();
	}

};

/**
 * Gets called every time the ExamList must be drawn completely
 */
ExamList.prototype.draw = function () {
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

		this.pagination2DOM.addClass('pagination');
		this.parentDOM.append(this.pagination2DOM);

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
		this.tableDOM.text('Keine Prüfungsleistungen gefunden.');
		return;
	}


	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	drawTableHead.call(this, tr, 'tooltip_exam_');

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

	var bonus_sum = 0;
	var grade_sum = 0;
	var grade_count = 0;
	var bonus_grade_sum = 0;
	var bonus_with_grade = 0;

	for (i = 0; i < this.data.list.length; i++) {
		var exam = this.data.list[i];

		if (exam.status == 'BE') {
			bonus_sum += exam.bonus;
			if (exam.grade) {
				bonus_with_grade += exam.bonus;
				bonus_grade_sum += (exam.grade) * (exam.bonus);
				grade_count++;
				grade_sum += exam.grade;
			}
		}


		tbody.append(this.drawExam(exam));
	}

	var averageGrade = 0;
	var weightedGrade = 0;

	if (grade_count) {
		averageGrade = Math.round(grade_sum / grade_count);
		weightedGrade = Math.round(bonus_grade_sum / bonus_with_grade);
	}

	this.calcDOM.empty();

	if (this.displayStats) {
		var td;
		var calcTable = document.createElement('table');
		calcTable.className = 'tbl minimal';

		tr = calcTable.appendChild(document.createElement('tr'));
		tr.appendChild(document.createElement('td'))
			.appendChild(document.createTextNode(CONFIG.cp_label+' der angezeigten bestandenen Leistungen'));
		tr.appendChild(document.createElement('td'))
			.appendChild(getFormattedHTML(bonus_sum, 'int'));

		/**
		 tr = calcTable.appendChild(document.createElement('tr'));
		 tr.appendChild(document.createElement('td'))
		 .appendChild(document.createTextNode('Ø Momentane Note'));
		 tr.appendChild(document.createElement('td'))
		 .appendChild(getFormattedHTML(grade, 'grade'));
		 **/

		tr = calcTable.appendChild(document.createElement('tr'));
		td = tr.appendChild(document.createElement('td'));
		td.appendChild(document.createTextNode('Ø Note der angezeigten Leistungen'));
		var sup = td.appendChild(document.createElement('sup'));
		sup.appendChild(document.createTextNode('1'));
		tr.appendChild(document.createElement('td'))
			.appendChild(getFormattedHTML(weightedGrade, 'grade'));

		var container = document.createElement('p');
		container.appendChild(calcTable);
		this.calcDOM.append(container);

	}


};
ExamList.prototype.drawExam = function (exam) {

	var tr = $(document.createElement('tr'));
	tr.addClass('exam');

	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(exam, col, td);
	}

	return tr

};
ExamList.prototype.drawCellValue = function (exam, col, td) {
	var self = this;
	var value;
	if (col.id == 'semester') {
		td.addClass('noWrap');
	}

	var idA;
	if (col.id == 'student_id') {
		idA = $(document.createElement('a'));
		idA.attr('href', 'student_detail.html?id=' + exam.student_id);
		idA.text(getByPath(col.id, exam));
		td.append(idA);

		var detailA = $(document.createElement('a'));
		detailA.addClass('detailBtn');
		detailA.attr('href', 'student_detail.html?id=' + exam.student_id);

		td.append(detailA);

	} else if (col.id == 'exam_id') {
		value = getByPath(col.id, exam);
		idA = $(document.createElement('a'));
		idA.attr('href', 'examdetails.html?exam_info_id=' + exam.exam_info_id);
		idA.text(value);
		td.append(idA);

	} else if (col.id == 'by') {
		td.text(exam['by_forename'] + ' ' + exam['by_surname']);

	} else if (col.id == 'status' && exam['comment'] != '') {
		if (exam['comment'] == 'U') {
			td.addClass('retirement_without_excuse');
		}
		td.text(exam['status'] + '  (' + exam['comment'] + ')');

	} else if(col.id == 'grade' && self.data.compare_averages) {
		value = getByPath(col.id, exam);
		td.append(getFormattedHTML(value, col.formatting));

		var info = self.getInfoForExam(exam.exam_info_id);

		if (value && info && info.semester_data && info.semester_data[exam.semester] && info.semester_data[exam.semester].grades) {
			var cmpValue = info.semester_data[exam.semester].grades.mean;
			td.addClass('darr');
			if (typeof(value) == 'number' && value < cmpValue) {
				td.addClass('downgreen');
			} else if (typeof(value) == 'number' && value > cmpValue) {
				td.addClass('upred');
			}
			td.attr('title','Ø ' + getNumericValueOutput(cmpValue, col.formatting));
			td.tooltip();
		}



	} else {
		value = getByPath(col.id, exam);
		td.append(getFormattedHTML(value, col.formatting));

	}

	if (col.id == 'status') {
		td.addClass('st_' + exam['status']);
	}


};
ExamList.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;
	self.filter.possibleValues = metadata;
};

ExamList.prototype.getInfoForExam = function (exam_info_id) {
	var self = this;
	if(!self.data || !self.data.info) return null;
	for (var i = 0; i < self.data.info.length; i++) {
		var pi = self.data.info[i];
		if(pi.exam_info_id == exam_info_id) {
			return pi;
		}
	}
	return null;
};

ExamList.prototype.load = function () {
	var self = this;
	var url = '/api/GetExams';

	self.saveSettings();

	var params = [];
	params.push('load_info=true');
	if (self.studentId) {
		params.push('student_id=' + encodeURIComponent(self.studentId));
	}
	if (self.examInfoId) {
		params.push('exam_info_id=' + encodeURIComponent(self.examInfoId));
	}
	var filterQueries = this.filter.getQueries(false);
	for (var name in filterQueries) {
		params.push(name + '=' + encodeURIComponent(filterQueries[name]));
	}

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if (self.pagination.sort2)
		params.push('sort2=' + self.pagination.sort2);
	if (!self.metadata) {
		params.push('metadata=true');
	}
	if(isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.tableDOM.removeClass('loading');

		self.data = data;
		if (data.metadata) {
			self.initMetadata(data.metadata);
		}
		if(data.hide_exam_date) {
			self.removeColumn('date');
		}
		if(data['hide_exam_fields']) {
			data['hide_exam_fields'].forEach(function (field) {
				self.removeColumn(field);
			});
		}
		self.pagination.update(data);

		self.draw();

	}).fail(function () {
		self.tableDOM.removeClass('loading');
		self.tableDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};
