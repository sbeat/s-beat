// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function ApplicantList(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'applicants_';
	this.settingsServerSaveable = true;
	this.settings = {
		'default': {
			title: "Bewerber Übersicht",
			limit: 20,
			sort1: '_id,1',
			sort2: null,
			filters: [],
			columns: ['ident', 'stg', 'start_semester', 'admissionstatus', 'age', 'gender', 'hzb_type', 'hzb_grade'],
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
		'start_semester': {
			id: 'start_semester',
			label: 'Start Semester',
			title: 'Voraussichtliches Startsemester',
			formatting: 'semester'
		},
		'admissionstatus': {
			id: 'admissionstatus',
			label: 'Status',
			title: 'Status der Zulassung',
			formatting: 'yesno',
			sortBy: 'admitted'
		},
		'admitted': {
			id: 'admitted',
			label: 'Zugelassen',
			title: 'Ist der Bewerber zugelassen worden',
			formatting: 'yesno'
		},
		'age': {id: 'age', label: 'Alter b. Bewerb.', title: 'Alter bei Bewerbung', formatting: 'int'},
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
		'appl_date': {id: 'appl_date', label: 'Bewerbung', title: 'Datum der Bewerbung', formatting: 'date'},
		'adm_date': {id: 'adm_date', label: 'Zulassung', title: 'Datum der Zulassung', formatting: 'date'},
		'hzb_imm_time': {
			id: 'hzb_imm_time',
			label: 'Monate seit HZB',
			title: 'Monate zwischen HZB und Immatrikulation',
			formatting: 'int'
		},
		'gender': {id: 'gender', label: 'Geschl.', title: 'Geschlecht', formatting: 'gender'}

	};
	this.columns = this.settings.default.columns;
	this.mandatoryColumns = ['ident'];

	this.tableDOM = $(document.createElement('table'));

	this.data = null; // Last loaded data

	this.drawn = false;

	this.valueStats = {};

	this.openColumnDialog = openColumnDialog;
	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;
	this.openLoadSettingsDialog = openLoadSettingsDialog;
	this.removeColumn = removeDataColumn;

	ApplicantList.prototype.init.call(this);
}

/**
 * Gets called once this MarkedList is initialized
 */
ApplicantList.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	for (var colId in this.columnData) {
		var col = this.columnData[colId];

		this.addFilterForData(col);

		var sf = col.id;
		if (col.sortBy) {
			sf = col.sortBy;
		}
		this.pagination.sortOptions[sf + ',1'] = col.label + ' aufsteigend';
		this.pagination.sortOptions[sf + ',-1'] = col.label + ' absteigend';
	}

	this.filter.sortFilters();

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
		$('#headline_applicants').text(settings.title);


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

ApplicantList.prototype.addFilterForData = function (cd) {
	var self = this;
	if (['str', 'stg', 'gender'].indexOf(cd.formatting) !== -1 && cd.id !== 'ident' && cd.id !== 'admissionstatus') {
		this.filter.addValueFilter(cd.id, cd.label, 'Bewerber', cd.formatting, getValues, null);
	} else {
		this.filter.addAttributeFilter(cd.id, cd.label, 'Bewerber', cd.formatting, cd.formatting === 'int' ? 0 : '');
	}

	function getValues(filter, callb) {
		if (self.valueStats[filter.id]) {
			callb(getValuesFromStats(filter));
		} else {
			self.loadValuesOfColumn(filter.id, function () {
				callb(getValuesFromStats(filter));
			})
		}

	}

	function getValuesFromStats(filter) {
		const values = {};
		if (self.valueStats[filter.id]) {
			self.valueStats[filter.id].forEach(function (gs) {
				values[gs.value] = getCompareValueInfo(gs.value, gs.formatting).text + ' (' + gs.count + ')';
			});
		}
		console.log('values for ', filter, values);
		return values;
	}


};
ApplicantList.prototype.loadValuesOfColumn = function (col, callb) {
	var self = this;
	var url = '/api/GetApplicants';

	var params = [];

	var groups = [col];

	params.push('single_groups=' + encodeURIComponent(groups.join(',')));

	if (params.length) url += '?';
	url += params.join('&');

	$.ajax({
		url: url
	}).success(function (data) {

		if (data.group_results) {
			for (var grp in data.group_results) {
				if (!data.group_results.hasOwnProperty(grp)) continue;
				var values = data.group_results[grp];
				self.valueStats[grp] = values.map(function (d) {
					return {
						value: d._id[grp],
						count: d.count
					};
				});
			}
		}
		callb();

	}).fail(function (jqXHR) {
		callb();
	})
};

ApplicantList.prototype.findColumnByFilter = function (f) {
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
ApplicantList.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.filterDOM.addClass('filterlist');
		this.parentDOM.append(this.filterDOM);
		this.filter.draw();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.tableDOM.addClass('applicantList tbl sortable');
		this.parentDOM.append(this.tableDOM);

		this.pagination2DOM.addClass('pagination');
		this.parentDOM.append(this.pagination2DOM);

		this.drawn = true;

		this.pagination.addLink('Einstellungen', function () {
			self.openSettingsDialog();
		});
		this.pagination.addLink('Spaltenauswahl', function () {
			self.openColumnDialog();
		});
		// this.pagination.addLink('Berechnungen', function () {
		// 	self.openCalculationsDialog();
		// });
		// this.pagination.addLink('Herunterladen', function () {
		// 	self.openDownloadDialog();
		// });
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

		this.tableDOM.text('Keine Bewerber gefunden.');
		return;
	}


	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	drawTableHead.call(this, tr, 'tooltip_applicant_');


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

	for (i = 0; i < this.data.list.length; i++) {
		var applicant = this.data.list[i];
		tbody.append(this.drawApplicant(applicant));
	}

	adjustTableHeaders(this.tableDOM);
};

ApplicantList.prototype.drawApplicant = function (applicant) {

	var tr = $(document.createElement('tr'));
	tr.addClass('applicant');

	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		if (!col) continue;
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(applicant, col, td);
	}

	return tr

};
ApplicantList.prototype.drawCellValue = function (applicant, col, td) {
	var self = this;
	var value;
	var role = getUserRole();
	td.addClass('col_applicant_' + col.id);

	if (col.id == 'ident') {
		var idA = $(document.createElement('a'));
		idA.attr('href', 'applicant_detail.html?id=' + applicant.ident);
		idA.text(getByPath(col.id, applicant));
		td.append(idA);

		var detailA = $(document.createElement('a'));
		detailA.addClass('detailBtn');
		detailA.attr('href', 'applicant_detail.html?id=' + applicant.ident);
		/*
		 detailA.click(function (e) {
		 e.preventDefault();
		 self.openDetailDialog(applicant);
		 });
		 */
		td.append(detailA);

	} else if (col.id == 'admissionstatus') {
		if (applicant.admitted) {
			td.text('Zugelassen');
		} else {
			td.text('(Noch) nicht zugelassen');
		}

	} else {
		value = getByPath(col.id, applicant);
		//console.log('value from '+col.id,value,applicant);
		td.append(getFormattedHTML(value, col.formatting));

	}


};
ApplicantList.prototype.setCustomFilters = function (ids) {
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
ApplicantList.prototype.load = function () {
	var self = this;
	var url = '/api/GetApplicants';

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

	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	var query = parseQuery(location.href);

	$.ajax({
		url: url
	}).success(function (data) {


		self.data = data;

		self.tableDOM.removeClass('loading');

		if(data['hide_applicant_fields']) {
			data['hide_applicant_fields'].forEach(function (field) {
				self.removeColumn(field);
			});
		}

		self.pagination.update(data);

		//self.loadMarkedInfo();

		self.draw();

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

ApplicantList.prototype.openCalculationsDialog = function (applicant) {
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

	var url = '/api/GetApplicants';

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

ApplicantList.prototype.openDetailDialog = function (applicant) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Bewerber Details ' + applicant.ident);

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

	var dl = document.createElement('table');
	dl.className = 'tbl datalist';

	var field, query;
	for (field in applicant) {
		query = self.findQuery(field);
		if (query) {
			dl.appendChild(drawDataRow(field, applicant[field], query));
		}
	}
	for (field in applicant) {
		query = self.findQuery(field);
		if (!query) {
			dl.appendChild(drawDataRow(field, applicant[field], query));
		}
	}

	dialogBox.append(dl);

	dialogBox.dialog({
		width: 500,
		modal: false,
		buttons: {
			'Detailseite': function () {
				location.href = 'applicant_detail.html?id=' + applicant.ident;
			},
			Close: function () {
				$(this).dialog("close");
			}
		}

	});

};

ApplicantList.prototype.openDownloadDialog = function () {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Download als CSV');


	function drawRow(col) {
		if (col.noDownload) return null;

		var boxO = document.createElement('li');
		boxO.className = 'colrow';
		boxO.colId = col.id;

		var labelO = boxO.appendChild(document.createElement('label'));

		var checkO = labelO.appendChild(document.createElement('input'));
		checkO.className = 'name';
		checkO.type = 'checkbox';

		checkO.checked = self.columns.indexOf(col.id) != -1;
		if (self.mandatoryColumns.indexOf(col.id) != -1) {
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
		if (self.columns.indexOf(colId) == -1) {
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

				var url = '/api/GetApplicants';

				var params = [];
				var filterQueries = self.filter.getQueries(false);
				for (var name in filterQueries) {
					params.push(name + '=' + encodeURIComponent(filterQueries[name]));
				}

				params.push('start=' + self.pagination.start);
				params.push('limit=' + self.pagination.limit);
				params.push('sort1=' + self.pagination.sort1);
				if (self.pagination.sort2)
					params.push('sort2=' + self.pagination.sort2);

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
