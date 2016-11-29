// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function ExamInfoList(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset')||'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'examinfos_';
	this.settings = {
		'default':{
			limit:20,
			sort1: '_id,1',
			sort2: null,
			filters:[],
			columns: ['exam_id', 'stg', 'name', 'bonus', 'has_grade', 'count_successful', 'success_perc', 'semester_data.CURRENT.exams', 'semester_data.LAST.exams'],
			displayFilters:true,
			displayPagination:true,
			sortable:true
		}
	};

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

	this.columnData = {
		'exam_info_id': {id: 'exam_info_id', label: 'ID', title: 'Eindeutige ID der Prüfungsleistung', formatting: 'str', sortBy:'_id', group:'Leistung'},
		'exam_id': {id: 'exam_id', label: 'EDV Nr.', title: 'ID der Prüfungsleistung', formatting: 'int', sortBy:'exam_id', group:'Leistung'},
		'stg': {id: 'stg', label: 'Studiengangsgruppe', title: 'Studiengangsgruppe', formatting: 'stg', group:'Leistung'},
		'stg_original': {id: 'stg_original', label: 'Studiengang', title: 'Studiengang', formatting: 'stg', group:'Leistung'},
		'name': {id: 'name', label: 'Prüfungsleistung Name', title: 'Prüfungsleistung Name', formatting: 'str',group:'Leistung'},
		'has_grade': {id: 'has_grade', label: 'Hat Note', title: 'Ob für diese Leistung Noten vergeben wurden.', formatting: 'yesno',group:'Leistung'},
		'bonus': {id: 'bonus', label: CONFIG.cp_label, title: CONFIG.cp_label, formatting: 'int',group:'Leistung'},
		'count_exams': {id: 'count_exams', label: 'Anzahl', title: 'Gesamtzahl aller Leistungen', formatting: 'int',group:'Leistung.Anmeldungen'},
		'count_successful': {id: 'count_successful', label: 'Bestanden', title: 'Anzahl bestandene Leistungen', formatting: 'int',group:'Leistung.Bestanden'},
		'count_failed': {id: 'count_failed', label: 'Nicht bestanden', title: 'Anzahl nicht bestandene Leistungen', formatting: 'int',group:'Leistung.Nicht bestanden'},
		'count_applied': {id: 'count_applied', label: 'Anzahl mit Status=AN', title: 'Anzahl Leistungen mit Status=AN', formatting: 'int',group:'Leistung.Anmeldungen'},
		'success_perc': {id: 'success_perc', label: 'Bestanden in %', title: 'Prozentanteil bestandender Leistungen', formatting: 'percent',group:'Leistung.Bestanden'},
		'failed_perc': {id: 'failed_perc', label: 'Nicht bestanden in %', title: 'Prozentanteil nicht bestandender Leistungen', formatting: 'percent',group:'Leistung.Nicht bestanden'},
		'semester_data.CURRENT.exams': {id: 'semester_data.CURRENT.exams', label: 'Anzahl Anmeldungen dieses Semester', title: 'Anzahl Leistungen im aktuellen Semester', formatting: 'int',group:'Leistung.Anmeldungen'},
		'semester_data.CURRENT.successful': {id: 'semester_data.CURRENT.successful', label: 'Bestanden dieses Semester', title: 'Anzahl bestandene Leistungen im aktuellen Semester', formatting: 'int',group:'Leistung.Bestanden'},
		'semester_data.CURRENT.failed': {id: 'semester_data.CURRENT.failed', label: 'Nicht bestanden dieses Semester', title: 'Anzahl nicht bestandene Leistungen im aktuellen Semester', formatting: 'int',group:'Leistung.Nicht bestanden'},
		'semester_data.CURRENT.applied': {id: 'semester_data.CURRENT.applied', label: 'Status=AN dieses Semester', title: 'Anzahl Leistungen mit dem Status=AN im aktuellen Semester', formatting: 'int',group:'Leistung.Anmeldungen'},
		'semester_data.CURRENT.success_perc': {id: 'semester_data.CURRENT.success_perc', label: 'Bestanden dieses Semester in %', title: 'Prozentanteil bestandender Leistungen in diesem Semester', formatting: 'percent',group:'Leistung.Bestanden'},
		'semester_data.CURRENT.failed_perc': {id: 'semester_data.CURRENT.failed_perc', label: 'Nicht bestanden dieses Semester in %', title: 'Prozentanteil nicht bestandender Leistungen in diesem Semester', formatting: 'percent',group:'Leistung.Nicht bestanden'},
		'semester_data.LAST.exams': {id: 'semester_data.LAST.exams', label: 'Anzahl Anmeldungen letztes Semester', title: 'Anzahl Prüfungsanmeldungen letztes Semester', formatting: 'int',group:'Leistung.Anmeldungen'},
		'semester_data.LAST.successful': {id: 'semester_data.LAST.successful', label: 'Bestanden letztes Semester', title: 'Anzahl bestandene Leistungen im letzten Semester', formatting: 'int',group:'Leistung.Bestanden'},
		'semester_data.LAST.failed': {id: 'semester_data.LAST.failed', label: 'Nicht bestanden letztes Semester', title: 'Anzahl nicht bestandene Leistungen im letzten Semester', formatting: 'int',group:'Leistung.Nicht bestanden'},
		'semester_data.LAST.applied': {id: 'semester_data.LAST.applied', label: 'Status=AN letztes Semester', title: 'Anzahl Leistungen mit dem Status=AN im letzten Semester', formatting: 'int',group:'Leistung.Anmeldungen'},
		'semester_data.LAST.success_perc': {id: 'semester_data.LAST.success_perc', label: 'Bestanden letztes Semester in %', title: 'Prozentanteil bestandender Leistungen im letzten Semester', formatting: 'percent',group:'Leistung.Bestanden'},
		'semester_data.LAST.failed_perc': {id: 'semester_data.LAST.failed_perc', label: 'Nicht bestanden letztes Semester in %', title: 'Prozentanteil nicht bestandender Leistungen im letzten Semester', formatting: 'percent',group:'Leistung.Nicht bestanden'}

	};
	this.columns = this.settings.default.columns;
	this.mandatoryColumns = ['exam_id'];

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

	ExamInfoList.prototype.init.call(this);
}
/**
 * Gets called once this ExamInfoList is initialized
 */
ExamInfoList.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	for (var colId in this.columnData) {
		var col = this.columnData[colId];
		this.filter.addAttributeFilter(col.id, col.label, col.group, col.formatting, col.formatting == 'int' ? 0 : '');

		if (col.sortBy) continue;
		this.pagination.sortOptions[col.id + ',1'] = col.label + ' aufsteigend';
		this.pagination.sortOptions[col.id + ',-1'] = col.label + ' absteigend';
	}

	this.filter.sortFilters();

	this.pagination.onReset=function() {
		self.loadPresetSettings(self.settingId);
		self.load();
	};

	self.loadSettings();

	self.draw();

	this.pagination.changed = function (start) {
		self.load();
	};

	this.filter.filterChanged = function (op, f) {
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



	self.load();

};
ExamInfoList.prototype.findColumnByFilter = function (f) {
	var columnId = null;
	if (f.type == 'attribute') columnId = f.id;
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
 * Gets called every time the ExamInfoList must be drawn completely
 */
ExamInfoList.prototype.draw = function () {
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

		this.pagination.addLink('Einstellungen', function () {
			self.openSettingsDialog();
		});
		this.pagination.addLink('Spaltenauswahl', function () {
			self.openColumnDialog();
		});

		this.drawn = true;
	}

	if(this.displayFilters) this.filterDOM.show();
	else this.filterDOM.hide();

	if(this.displayPagination) this.paginationDOM.show();
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

	drawTableHead.call(this,tr,'tooltip_exam_');

	if(self.sortable) {
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


};
ExamInfoList.prototype.drawExam = function (exam) {

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
ExamInfoList.prototype.drawCellValue = function (exam, col, td) {
	var self = this;
	var value, fname = col.id.replace('CURRENT',self.data.current);
	fname = fname.replace('LAST',self.data.last);

	value = getByPath(fname, exam);

	if (col.id == 'exam_id') {
		var idA = $(document.createElement('a'));
		idA.attr('href', 'examdetails.html?exam_info_id=' + exam.exam_info_id);
		idA.text(value);
		td.append(idA);

	} else if(col.id=='stg' || col.id=='stg_original') {
		td.text(value.sort().join(', '));

	} else {
		td.append(getFormattedHTML(value, col.formatting));
	}


};

ExamInfoList.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;
	self.filter.possibleValues = metadata;
};

ExamInfoList.prototype.load = function () {
	var self = this;
	var url = '/api/GetExamInfos';

	self.saveSettings();

	var params = [];
	var filterQueries = this.filter.getQueries(false);
	for (var name in filterQueries) {
		params.push(name + '=' + encodeURIComponent(filterQueries[name]));
	}

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if(self.pagination.sort2)
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
		self.pagination.update(data);

		self.draw();

	}).fail(function () {
		self.tableDOM.removeClass('loading');
		self.tableDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};
