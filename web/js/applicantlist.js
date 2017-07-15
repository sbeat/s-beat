// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function ApplicantList(parentDOM) {
	this.parentDOM = parentDOM;

	this.mlistId = this.parentDOM.attr('data-mlist');
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
			columns: ['ident', 'stg', 'start_semester', 'admissionstatus', 'age', 'gender', 'bonus_total', 'exam_count', 'grade_current'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		},
		'mlist': {
			title: "Vormerkungsliste",
			limit: 20,
			sort1: 'risk.median_scaled,-1',
			filters: [],
			columns: ['ident', 'stg', 'start_semester', 'admissionstatus', 'age', 'gender', 'bonus_total', 'risk', 'risk.median_scaled', 'comment', 'actions'],
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
		'_id,1': 'Ident aufsteigend',
		'_id,-1': 'Ident absteigend'
	};

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);
	//this.filter.addAttributeFilter('risk.median_scaled', 'Misserfolg in %', 'Vorhersage', 'percent', 0);
	if (this.settingId != 'mlist') {
		this.filter.addAttributeFilter('ident', 'Identifikationsnummer', 'Student', 'int', 0);
	}

	this.filter.multiFilters = {
		exam_count: ['exam_count', 'exam_count_success', 'exam_count_applied']
	};

	this.columnData = {
		'ident': {id: 'ident', label: 'Ident', title: 'Identifikationsnummer', formatting: 'str', sortBy: '_id'},
		'stg': {id: 'stg', label: 'STG', title: 'Studiengangsgruppe', formatting: 'stg'},
		'stg_original': {id: 'stg_original', label: 'Studiengang', title: 'Studiengang', formatting: 'stg'},
		//'degree_type': {id: 'degree_type', label: 'Abschluss', title: 'Abschluss', formatting: 'str'},
		'start_semester': {id: 'start_semester', label: 'Start', title: 'Voraussichtliches Startsemester', formatting: 'semester'},
		'admissionstatus': {
			id: 'admissionstatus',
			label: 'Status',
			title: 'Status der Zulassung',
			formatting: 'yesno',
			sortBy: 'status',
			filters: ['admitted', 'not_admitted']
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
		'zul_date': {id: 'zul_date', label: 'Zulassung', title: 'Datum der Zulassung', formatting: 'date'},
		'hzb_imm_time': {
			id: 'hzb_imm_time',
			label: 'Monate seit HZB',
			title: 'Monate zwischen HZB und Immatrikulation',
			formatting: 'int'
		},
		'gender': {id: 'gender', label: 'Geschl.', title: 'Geschlecht', formatting: 'gender'},

		'comment': {
			id: 'comment',
			label: 'Kommentar',
			title: 'Kommentar aus Vormerkung',
			formatting: 'str',
			sortBy: null
		},
		//'category': {id: 'category', label: 'Kategorie', title: 'Kategorie aus Vormerkung', formatting: 'str', sortBy: null},

		'actions': {
			id: 'actions',
			label: 'Aktionen',
			title: 'Aktionen',
			formatting: 'actions',
			noDownload: true,
			sortBy: null,
			presets: ['mlist']
		}

	};
	this.columns = this.settings.default.columns;
	this.mandatoryColumns = ['ident'];

	this.tableDOM = $(document.createElement('table'));

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

	ApplicantList.prototype.init.call(this);
}
/**
 * Gets called once this MarkedList is initialized
 */
ApplicantList.prototype.init = function () {
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
		this.pagination.addLink('Berechnungen', function () {
			self.openCalculationsDialog();
		});
		this.pagination.addLink('Herunterladen', function () {
			self.openDownloadDialog();
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


ApplicantList.prototype.drawMListValue = function (field, el) {
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
	if (self.definitions.restricted.indexOf(col.id) != -1) {
		td.text('***');
		return
	}

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

	} else if (col.id == 'actions') {
		if (self.data.mlist && self.data.mlist.list.indexOf(applicant.ident) != -1 && self.data.mlist.is_writable) {
			var delA = $(document.createElement('a'))
				.attr('href', '')
				.text('Entfernen')
				.attr('title', 'Entfernt diesen Bewerber aus der Vormerkungsliste')
				.appendTo(td);
			delA.tooltip();
			delA.click(function (e) {
				e.preventDefault();

				if (!confirm('Soll dieser Bewerber wirklich aus der Liste entfernt werden?')) {
					return;
				}
				var data = {};
				data['remove_idents'] = [applicant.ident];

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
		var mark = self.getMarkedInfo(applicant.ident);
		if (mark) {
			td.text(mark.category ? mark.category : '-');
		} else {
			td.text('-');
		}

	} else if (col.id == 'comment') {
		if (self.data.mlist && self.data.mlist.comments[applicant.ident]) {
			td.text(self.data.mlist.comments[applicant.ident].text);
		} else {
			td.text('-');
		}

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
ApplicantList.prototype.removeColumn = function (col) {
	var self = this;
	var pos = self.columns.indexOf(col);
	if (pos != -1) self.columns.splice(pos, 1);
	if (self.columnData[col]) {
		delete self.columnData[col];
	}

};
ApplicantList.prototype.initDefinitions = function (definitions) {
	var self = this;
	self.definitions = definitions;
	var query;
	var usedQueries = [];


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


	self.filter.sortFilters();


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
	if (!self.definitions) {
		params.push('definitions=true');
	}
	if (this.mlistId) {
		params.push('mlist=' + this.mlistId);
	}

	if(isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	var query = parseQuery(location.href);

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

ApplicantList.prototype.findQuery = function (q) {
	for (var qId in this.definitions['queries']) {
		var query = this.definitions['queries'][qId];
		if (query.q == q) return query;
	}
	return null;
};

ApplicantList.prototype.getMarkedInfo = function (ident) {
	var self = this;
	if (!self.markedData) return null;
	for (var i = 0; i < self.markedData.list.length; i++) {
		var mark = self.markedData.list[i];
		if (mark.ident == ident) return mark;
	}
	return null;
};

ApplicantList.prototype.loadMarkedInfo = function () {
	var self = this;
	var url = '/api/GetMarkedApplicants';

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

ApplicantList.prototype.openMarkedListSettingsDialog = function () {
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
				if (!self.definitions) {
					params.push('definitions=true');
				}
				if (self.mlistId) {
					params.push('mlist=' + self.mlistId);
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
