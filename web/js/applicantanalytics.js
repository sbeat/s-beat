// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

/**
 * Applicant analytics table
 * Depends on applicantlist
 * @constructor
 */
function ApplicantAnalytics(parentDOM, settingsPrefix) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.query = this.parentDOM.attr('data-query') || '';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = settingsPrefix || 'aanalytics_';
	this.tooltipPrefix = settingsPrefix || 'tooltip_';
	this.settings = {
		'default': {
			limit: 0,
			sort1: null,
			sort2: null,
			filters: [],
			columns: [],
			rows: ['start_semester', 'hzb_type'],
			displayPagination: false,
			sortable: false,
			graphMode: 'relative'
		},
		'course': {
			limit: 0,
			sort1: null,
			sort2: null,
			filters: [],
			columns: [],
			rows: ['hzb_type'],
			displayPagination: false,
			sortable: false,
			graphMode: 'relative'
		},
		'course_sem': {
			limit: 0,
			sort1: null,
			sort2: null,
			filters: [],
			columns: [],
			rows: ['hzb_type'],
			displayPagination: false,
			sortable: false,
			graphMode: 'relative'
		}
	};

	this.paginationDOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.limit = this.settings.default.limit;

	this.displayFilters = true;
	this.displayPagination = false;
	this.sortable = true;
	this.clientSort = false;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;
	this.pagination.sortOptions = {};

	this.columnData = {};
	this.columns = [];
	this.rows = [];
	this.mandatoryColumns = ['group'];

	this.mode = 'table'; // table, graph

	this.definitions = null;

	this.linkBox = $(document.createElement('div'));

	this.tableDOM = $(document.createElement('table'));

	this.graphDOM = $(document.createElement('div'));
	this.graph = null;

	this.graphMode = 'relative';

	this.data = null; // Last loaded list
	this.metadata = null;

	this.groupStats = null;
	this.valueStats = {};

	this.drawn = false;

	this.entries = null;

	this.showGroupSummary = true;
	this.openLevels = 0;

	this.allowedTableFormats = ['grade', 'percent', 'float', 'int'];

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);

	this.settingsFields = ['graphMode', 'rows'];

	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;
	this.addFilterForData = ApplicantList.prototype.addFilterForData;
	this.loadValuesOfColumn = ApplicantList.prototype.loadValuesOfColumn;

	ApplicantAnalytics.prototype.init.call(this);
}

ApplicantAnalytics.prototype.defineColumn = function (id, label, title, formatting, groupable, calculations) {
	return this.columnData[id] = {
		id: id,
		label: label,
		title: title,
		formatting: formatting,
		groupable: groupable,
		calculations: calculations
	};
};

ApplicantAnalytics.prototype.getColumnObject = function (cdId, grpValue, calcOp) {
	var cd = this.columnData[cdId];
	var col = {
		id: cd.id,
		cdId: cdId, // ref to the columnData
		type: 'direct', // direct, group, calc
		grpValue: null, // for type=group
		calcOp: null // for type=calc
	};
	if (cdId === 'group') {
		col.type = 'label';
	}
	if (cd.groupable && grpValue !== undefined) {
		col.grpValue = grpValue;
		col.type = 'group';
		col.id = cd.id + '=' + grpValue;

	}
	if (cd.calculations && calcOp !== undefined) {
		col.calcOp = calcOp;
		col.type = 'calc';
		col.id = calcOp + '.' + cd.id;
	}
	return col;
};
ApplicantAnalytics.prototype.removeColumn = function (col) {
	var self = this;
	if (self.columnData[col]) {
		delete self.columnData[col];
	}
	for (var i = 0; i < self.columns.length; i++) {
		var col = self.columns[i];
		if (col.cdId === col) {
			self.columns.splice(i, 1);
			i--;
		}
	}

};
ApplicantAnalytics.prototype.addLink = function (label, click) {
	this.linkBox.append(' ');
	var setBtn = $(document.createElement('a'));
	setBtn.attr('href', '');
	setBtn.text(label);
	setBtn.click(function (e) {
		e.preventDefault();
		click();
	});
	this.linkBox.append(setBtn);
	return setBtn;
};

/**
 * Gets called once this ApplicantAnalytics is initialized
 */
ApplicantAnalytics.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	this.defineColumn('group', 'Gruppe', 'Gruppierung', 'str');
	this.defineColumn('count', 'Bewerber', 'Anzahl Bewerber in der Gruppe', 'int');
	this.defineColumn('age', 'Alter', 'Anzahl Bewerber mit dem Alter bzw. berechnetes Alter in der Gruppe', 'int', true, ['min', 'max', 'avg']);
	this.defineColumn('gender', 'Geschlecht', 'Anzahl Bewerber mit dem Geschlecht', 'str', true);
	this.defineColumn('country', 'Land', 'Anzahl Bewerber aus dem Land', 'str', true);
	this.defineColumn('admitted', 'Zulassung', 'Anzahl Bewerber aus mit dem Zulassungsstatus', 'yesno', true);
	this.defineColumn('hzb_type', 'HZB Gruppe', 'Anzahl Bewerber mit der HZB Gruppe', 'str', true);
	this.defineColumn('hzb_grade', 'HZB Note', null, 'grade', true, ['min', 'max', 'avg']);
	this.defineColumn('status', 'Status', null, 'status', true);
	this.defineColumn('start_semester', 'Start Semester', null, 'semester', true);
	this.defineColumn('stg', 'Studiengangsgruppe', null, 'str', true);

	this.settings.default.columns.push(this.getColumnObject('group'));
	this.settings.default.columns.push(this.getColumnObject('count'));
	this.settings.default.columns.push(this.getColumnObject('hzb_grade', undefined, 'avg'));
	this.settings.default.columns.push(this.getColumnObject('gender', 'W'));
	this.settings.default.columns.push(this.getColumnObject('gender', 'M'));
	this.settings.course.columns = this.settings.default.columns;
	this.settings.course_sem.columns = this.settings.default.columns;

	this.columns = this.settings.default.columns.slice();
	this.rows = this.settings.default.rows.slice();
	this.pagination.limit = this.settings.default.limit;
	this.displayPagination = this.settings.default.displayPagination;
	this.sortable = this.settings.default.sortable;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;


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

	this.addFilterForData({
		id: 'birth_date',
		label: 'Geburtsdatum',
		formatting: 'date'
	});
	this.addFilterForData({
		id: 'appl_date',
		label: 'Bewerbung am',
		formatting: 'date'
	});
	this.addFilterForData({
		id: 'adm_date',
		label: 'Zulassung am',
		formatting: 'date'
	});
	this.addFilterForData({
		id: 'degree_type',
		label: 'Abschluss',
		formatting: 'str'
	});
	this.addFilterForData({
		id: 'citship',
		label: 'Staatsangehörigkeit',
		formatting: 'str'
	});
	this.addFilterForData({
		id: 'eu',
		label: 'EU Bürger',
		formatting: 'yesno'
	});

	this.filter.sortFilters();

	self.loadSettings();

	self.draw();

	self.pagination.changed = function () {
		self.sortChanged();
		self.load();
	};
	self.pagination.onReset = function () {
		self.loadPresetSettings(self.settingId);
		self.filter.draw();
		self.load();
	};

	self.filter.filterChanged = function (op, f) {
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

ApplicantAnalytics.prototype.sortChanged = function () {
	if (this.clientSort) {
		this.sortTable();
	}
};

/**
 * Gets called every time the ApplicantAnalytics must be drawn completely
 */
ApplicantAnalytics.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.filterDOM.addClass('filterlist');
		this.parentDOM.append(this.filterDOM);
		this.filter.draw();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.parentDOM.append(this.linkBox);

		this.tableDOM.addClass('indentList tbl sortable');
		this.parentDOM.append(this.tableDOM);

		this.graphDOM.css('min-height', '400px');
		this.parentDOM.append(this.graphDOM);

		this.addLink('Einstellungen', function () {
			self.openSettingsDialog();
		});
		this.addLink('Gruppenauswahl', function () {
			self.openGroupDialog();
		});
		this.addLink('Spaltenauswahl', function () {
			self.openColumnDialog();
		});
		var getGraphLinkName = function () {
			return self.mode === 'graph' ? 'Tabelle anzeigen' : 'Diagramm anzeigen'
		};
		var graphLink = this.addLink(getGraphLinkName(), function () {
			if (self.mode === 'graph') {
				self.mode = 'table';
			} else {
				self.mode = 'graph';
			}
			graphLink.text(getGraphLinkName());
			self.draw();
		});

		this.drawn = true;
	}


	if (this.displayFilters) this.filterDOM.show();
	else this.filterDOM.hide();

	if (this.displayPagination) this.paginationDOM.show();
	else this.paginationDOM.hide();


	this.pagination.draw();

	if (this.mode === 'table') {
		this.graphDOM.hide();
		this.tableDOM.show();
		if (!this.data) {
			this.tableDOM.text('Keine Daten verfügbar');
			return;
		}
		this.drawTable();
	}
	if (this.mode === 'graph') {
		this.graphDOM.show();
		this.tableDOM.hide();
		if (!this.data) {
			this.graphDOM.text('Keine Daten verfügbar');
			return;
		}
		this.drawGraph();

	}


};
ApplicantAnalytics.prototype.drawGraph = function () {
	var self = this;
	this.graphDOM.empty();
	this.graph = new HBarChart(this.graphDOM);
	this.graph.firstLegend = true;
	this.graph.barMode = this.graphMode;

	this.entries = this.getEntries();
	console.log('entries', this.entries);

	for (var i = 0; i < this.entries.length; i++) {
		var entry = this.entries[i];
		var id = getBarLabel(entry);
		this.graph.addBar(id, id);

		for (var j = 0; j < this.columns.length; j++) {
			var col = this.columns[j];
			var cd = this.columnData[col.cdId];
			if(col.type === 'group') {
				var value = entry[col.id];
				var label = this.getColumnLabel(col);
				this.graph.addValue(id, label.data || label.innerText, value);
			}
		}
	}

	this.graph.draw();

	function getBarLabel(entry) {
		var text = [];
		for (var i = 0; i < self.rows.length; i++) {
			var cd = self.columnData[self.rows[i]];
			var value = entry.ident[i];
			if(value !== undefined) {
				text.push(getNumericValueOutput(value, cd.formatting));
			}
		}
		return text.join(', ');
	}

};
ApplicantAnalytics.prototype.drawTable = function () {
	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	drawTableHead.call(this, tr, this.tooltipPrefix);

	thead.find('th').click(function () {
		var col = self.columnData[this.colId];
		var sortField = col.sortBy ? col.sortBy : col.id;

		if (self.pagination.sort1 === sortField + ',1') {
			self.pagination.sort1 = sortField + ',-1';
		} else {
			self.pagination.sort1 = sortField + ',1';
		}

		if (self.pagination.sort2 === sortField + ',1' || self.pagination.sort2 === sortField + ',-1') {
			self.pagination.sort2 = null;
		}

		self.sortChanged();
		self.onHeaderClick();

	});


	var tbody = $(document.createElement('tbody'));
	this.tableDOM.append(tbody);

	this.entries = this.getEntries();
	console.log('entries', this.entries);

	for (var i = 0; i < this.entries.length; i++) {
		var entry = this.entries[i];

		tbody.append(this.drawEntry(entry));
	}

	adjustTableHeaders(this.tableDOM);
};
ApplicantAnalytics.prototype.getEntries = function () {
	var self = this;
	if (!self.data) {
		return [];
	}
	var entries = {};
	for (var i = 0; i < self.data.group_results.length; i++) {
		var d = self.data.group_results[i];
		var key = getEntryKey(d);
		ensureEntries(key, d);
	}

	var entriesArray = Object.keys(entries).map(function (keyStr) {
		var entry = entries[keyStr];

		for (var i = 0; i < self.columns.length; i++) {
			var col = self.columns[i];
			entry[col.id] = getValue(col, entry.results);
		}

		return entry;
	});
	entriesArray.sort(sortFunc);
	return entriesArray;

	function sortFunc(a, b) {
		for (var i = 0; i < self.rows.length; i++) {
			var valA = a.ident[i];
			var valB = b.ident[i];
			if (valA === undefined) valA = -Infinity;
			if (valB === undefined) valB = -Infinity;
			if (valA > valB || valB === -Infinity && valA !== -Infinity) return 1;
			if (valA < valB || valA === -Infinity && valB !== -Infinity) return -1;
		}
		return 0;
	}

	function getValue(col, results) {
		var value = null, count = 0;
		for (var i = 0; i < results.length; i++) {
			var d = results[i];
			if (col.type === 'direct' && d[col.cdId] !== undefined) {
				value = (value || 0) + d[col.cdId];
			}
			if (col.type === 'calc' && d[col.id] !== undefined) {
				if (col.calcOp === 'avg' || col.calcOp === 'sum') {
					value = (value || 0) + d[col.id];
					count++;
				}
				if (col.calcOp === 'min' && (value === null || d[col.id] < value)) {
					value = d[col.id];
				}
				if (col.calcOp === 'max' && (value === null || d[col.id] > value)) {
					value = d[col.id];
				}
			}
			if (col.type === 'group') {
				var grpValue = d._id[col.cdId];
				var cd = self.columnData[col.cdId];
				var cmpInfo = getCompareValueInfo(col.grpValue, cd.formatting);
				if (cmpInfo.operator === 'equal' && grpValue === cmpInfo.value
					|| cmpInfo.operator === 'lte' && grpValue <= cmpInfo.value
					|| cmpInfo.operator === 'gte' && grpValue >= cmpInfo.value
					|| cmpInfo.operator === 'between'
					&& grpValue >= cmpInfo.minValue
					&& grpValue <= cmpInfo.maxValue) {
					value = (value || 0) + d.count;
				}
			}
		}
		if (col.type === 'calc' && col.calcOp === 'avg' && count) {
			value = value / count;
		}
		return value;
	}

	function setColumns(o) {
		for (var i = 0; i < self.columns.length; i++) {
			var cd = self.columns[i];
			o[cd.id] = null;
		}
	}

	function getChildEntries(ident) {
		var childEntries = [];
		for (var i = 0; i < entriesArray.length; i++) {
			var entry = entriesArray[i];
			var matched = 0;
			for (var j = 0; j < ident.length && j < entry.ident.length; j++) {
				var idPart = ident[j];
				if (idPart === entry.ident[j]) {
					matched++;
				}
			}
			if (matched === ident.length && entry.ident.length === ident.length + 1) {
				childEntries.push(entry);
			}
		}
		return childEntries;
	}

	function toggleOpen() {
		var childEntries = getChildEntries(this.ident);
		for (var i = 0; i < childEntries.length; i++) {
			var entry = childEntries[i];
			if (this.open && entry.open) {
				entry.toggleOpen();
			}
			self.setEntryDisplay(entry.ident, !this.open);
		}
		this.open = !this.open;

	}

	function ensureEntries(key, d) {
		var lastKey = null;
		for (var i = 0; i < key.length; i++) {
			var entryKey = key.slice(0, key.length - i);
			var keyStr = ensureEntry(entryKey);
			entries[keyStr].results.push(d);
			if (i > 0) {
				entries[entryKey].open = self.openLevels >= entryKey.length;
				entries[entryKey].toggleOpen = toggleOpen;
			}
			lastKey = keyStr;
			if (!self.showGroupSummary) {
				break;
			}
		}
	}

	function ensureEntry(key) {
		var keyStr = key.join(',');
		if (!entries[keyStr]) {
			entries[keyStr] = {
				ident: key,
				count: 0,
				results: []
			};
			setColumns(entries[keyStr]);
		}
		return keyStr;
	}

	function getEntryKey(d) {
		var values = [];
		for (var i = 0; i < self.rows.length; i++) {
			var row = self.rows[i];
			values.push(d._id[row]);
		}
		return values;
	}
};
ApplicantAnalytics.prototype.setEntryDisplay = function (ident, open) {
	var keyStr = ident.join(',');
	this.tableDOM.find('tr[id]').each(function () {
		if (this.id === keyStr) {
			if (open) {
				$(this).show();
			} else {
				$(this).hide();
			}
		}
	});

};
ApplicantAnalytics.prototype.findParent = function (ident) {
	return this.entries.find(function (e) {
		var matched = 0;
		if (e.ident.length !== ident.length - 1) return false;
		for (var i = 0; i < ident.length - 1; i++) {
			if (ident[i] === e.ident[i]) matched++;
		}
		return matched === ident.length - 1;
	});
};
ApplicantAnalytics.prototype.drawEntry = function (entry) {
	var tr = $(document.createElement('tr'));
	tr.attr('id', entry.ident.join(','));

	if (entry.ident.length > 1) {
		var parentEntry = this.findParent(entry.ident);
		if (parentEntry && !parentEntry.open) {
			tr.hide();
		}
	}

	for (var i = 0; i < this.columns.length; i++) {
		var cd = this.columns[i];
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(entry, cd, td);
	}

	return tr;
};
ApplicantAnalytics.prototype.drawCellValue = function (entry, col, td) {
	var cd = this.columnData[col.cdId];
	if (col.id === 'group') {

		if (entry.open !== undefined) {
			var link = $('<a class="openable" href="javascript:"></a>');
			link.click(function () {
				if (entry.open) {
					link.removeClass('open');
				} else {
					link.addClass('open');
				}
				entry.toggleOpen();
			});
			td.append(link);
		}

		var level = 0, lastValue = null, rCd = null;
		for (var i = 0; i < this.rows.length; i++) {
			var row = this.rows[i];
			if (entry.ident[i] === undefined) continue;
			rCd = this.columnData[row];
			lastValue = getFormattedHTML(entry.ident[i], rCd.formatting);
			level++;
		}
		if (rCd) {
			td.attr('title', rCd.label);
		}
		td.addClass('level' + level);
		td.append(lastValue);

	} else if (cd.drawValue && cd.drawValue instanceof Function) {
		cd.drawValue(entry, col, td);

	} else {
		var value = entry[col.id];
		var formatting = cd.formatting;
		if (this.allowedTableFormats.indexOf(formatting) === -1) formatting = 'int';
		td.append(getFormattedHTML(value, formatting));
	}

};
ApplicantAnalytics.prototype.sortTable = function () {
	var self = this;
	var sorts = [], parts;
	if (self.pagination.sort1) {
		parts = self.pagination.sort1.split(',', 2);
		sorts.push({field: parts[0], direction: parseInt(parts[1])});
	}
	if (self.pagination.sort2) {
		parts = self.pagination.sort2.split(',', 2);
		sorts.push({field: parts[0], direction: parseInt(parts[1])});
	}
	if (!sorts.length) {
		return;
	}

	this.list.sort(sortFunction);

	this.draw();

	function sortFunction(a, b) {
		for (var i = 0; i < sorts.length; i++) {
			var s = sorts[i];
			var valueA = getByPath(s.field, a);
			var valueB = getByPath(s.field, b);
			if (valueA > valueB) return s.direction;
			if (valueA < valueB) return s.direction * -1;
		}
		return 0;
	}

};
ApplicantAnalytics.prototype.onHeaderClick = function () {
	this.load();
};
ApplicantAnalytics.prototype.load = function () {
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

	if (!self.definitions) {
		params.push('definitions=true');
	}

	var groups = [], calculations = [];
	self.columns.forEach(function (col) {
		if (col.type === 'group') {
			addToSet(groups, col.cdId);
		}
		if (col.type === 'calc') {
			addToSet(calculations, col.calcOp + '.' + col.cdId);
		}
	});
	self.rows.forEach(function (row) {
		addToSet(groups, row);
	});

	params.push('groups=' + encodeURIComponent(groups.join(',')));
	if (calculations.length) {
		params.push('calculations=' + encodeURIComponent(calculations.join(',')));
	}

	if (self.query && self.query.length) {
		params.push(self.query);
	}

	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {

		self.data = data;

		if (data.definitions) {
			if (self.settingId === 'course') {
				data.definitions.restricted.push('stg');
				data.definitions.restricted.push('stg_original');
			}
			if (self.settingId === 'course_sem') {
				data.definitions.restricted.push('stg');
				data.definitions.restricted.push('stg_original');
				data.definitions.restricted.push('start_semester');
				self.removeColumn('start_semester');
			}

		}

		self.tableDOM.removeClass('loading');

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
ApplicantAnalytics.prototype.loadGroupStatistics = function (callb) {
	var self = this;
	var url = '/api/GetApplicants';

	var params = [];

	var groups = [];
	Object.keys(self.columnData).forEach(function (id) {
		var cd = self.columnData[id];
		if (cd.groupable) {
			groups.push(cd.id);
		}
	});

	params.push('single_groups=' + encodeURIComponent(groups.join(',')));


	if (params.length) url += '?';
	url += params.join('&');

	$.ajax({
		url: url
	}).success(function (data) {

		if (data.group_results) {
			self.groupStats = {};
			for (var grp in data.group_results) {
				if (!data.group_results.hasOwnProperty(grp)) continue;
				var values = data.group_results[grp];
				self.groupStats[grp] = values.map(function (d) {
					return {
						value: d._id[grp],
						count: d.count
					};
				});
				sortByField(self.groupStats[grp], 'value');
			}
			console.log('groupStats', this.groupStats);
		}
		callb();

	}).fail(function (jqXHR) {
		callb();
	})
};
ApplicantAnalytics.prototype.getColumnLabel = function (col) {
	var cd = this.columnData[col.cdId];
	var label;
	if (col && col.type === 'calc') {
		if (col.calcOp === 'avg') {
			label = 'Ø ' + cd.label;
		}
		if (col.calcOp === 'max') {
			label = 'Max. ' + cd.label;
		}
		if (col.calcOp === 'min') {
			label = 'Min. ' + cd.label;
		}
		if (col.calcOp === 'sum') {
			label = 'Σ ' + cd.label;
		}
	} else if (col && col.type === 'group') {
		var cmpInfo = getCompareValueInfo(col.grpValue, cd.formatting);
		return document.createTextNode(cd.label + ' ' + cmpInfo.text);
	} else {
		label = cd.label;
	}
	return document.createTextNode(label);
};
ApplicantAnalytics.prototype.openColumnDialog = function () {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Spaltenauswahl');

	var loadingDummy = $('<div></div>').appendTo(dialogBox);

	$(document.createElement('p')).text(
		'Die ausgewählten Spalten können per Drag & Drop sortiert werden.').appendTo(dialogBox);

	function indexOfCol(id, arr) {
		if (!arr) {
			arr = self.columns;
		}
		return arr.findIndex(function (col) {
			return col.id === id;
		});
	}

	function drawRow(col) {
		var cd = self.columnData[col.cdId];
		if (cd.presets && cd.presets.indexOf(self.settingId) === -1) return null;

		var boxO = document.createElement('li');
		boxO.className = 'colrow';
		boxO.col = col;
		if(cd.titl) {
			boxO.title = cd.title;
		}

		var labelO = boxO.appendChild(document.createElement('label'));

		if (col.type === 'group' && col.grpValue === null) {
			labelO.appendChild(document.createTextNode(cd.label+' '));
			labelO.className = 'addBtn';
			var addLink = $('<a href="javascript:"></a>').text('Bedingte Spalte hinzufügen').appendTo(boxO);
			addLink.click(function (e) {
				e.preventDefault();

				self.openColumnValueDialog(col, function (grpValue) {
					console.log('grpValue', grpValue);
					var newCol = self.getColumnObject(col.cdId, grpValue);
					self.columns.push(newCol);
					boxO.after(drawRow(newCol));

				});
			});

		} else {
			var checkO = labelO.appendChild(document.createElement('input'));
			checkO.className = 'name';
			checkO.type = 'checkbox';

			checkO.checked = indexOfCol(col.id) !== -1;
			if (self.mandatoryColumns.indexOf(cd.id) !== -1) {
				checkO.disabled = true;
			}

			if (checkO.checked) {
				boxO.className += ' sortable';
				var orderBox = document.createElement('div');
				orderBox.className = 'orderbox';
				boxO.appendChild(orderBox);
			}



			if (col.type === 'group') {
				var editLink = $('<a href="javascript:"></a>').append(self.getColumnLabel(col)).appendTo(boxO);
				editLink.click(function (e) {
					e.preventDefault();

					self.openColumnValueDialog(col, function (grpValue) {
						console.log('grpValue', grpValue);
						col.grpValue = grpValue;
						boxO.replaceWith(drawRow(col));

					});
				});
			} else {
				labelO.appendChild(self.getColumnLabel(col));
			}

		}


		return boxO;
	}

	function renderColumnList() {
		console.log('columns', self.columns);
		console.log('columnData', self.columnData);

		var ul = $(document.createElement('ul'));
		ul.addClass('columnlist');
		var i, col;
		for (i = 0; i < self.columns.length; i++) {
			col = self.columnData[self.columns[i].cdId];
			ul.append(drawRow(self.columns[i]));
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
			var cd = self.columnData[colId];
			if (cd.calculations) {
				for (var k = 0; k < cd.calculations.length; k++) {
					var calcId = cd.calculations[k];
					col = self.getColumnObject(colId, undefined, calcId);
					if (indexOfCol(col.id) === -1) {
						ul.append(drawRow(col));
					}
				}
			}
			if (cd.groupable) {
				col = self.getColumnObject(colId, null, undefined);
				ul.append(drawRow(col));
			}
			if (!cd.calculations && !cd.groupable && indexOfCol(colId) === -1) {
				ul.append(drawRow(self.getColumnObject(colId, undefined, undefined)));
			}

		}

		dialogBox.append(ul);

		ul.sortable();
	}

	if (!self.groupStats) {
		loadingDummy.addClass('loading');
		self.loadGroupStatistics(function () {
			loadingDummy.removeClass('loading');
			renderColumnList();
		});
	} else {
		renderColumnList();
	}


	dialogBox.dialog({
		width: 500,
		maxHeight: 500,
		modal: true,
		buttons: {
			OK: function () {

				for (var i = 0; i < self.columns.length; i++) {
					self.columns.splice(i, 1);
					i--;
				}

				$(this).find('li').each(function () {
					var checkO = $('input', this)[0];
					if (checkO && checkO.checked)
						self.columns.push(this.col);
				});

				self.saveSettings();

				self.load();

				$(this).dialog("close");

			},
			'Abbrechen': function () {
				$(this).dialog("close");
			}
		}
	});

};

ApplicantAnalytics.prototype.openGroupDialog = function () {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Gruppenauswahl');

	$(document.createElement('p')).text(
		'Die ausgewählten Gruppen können per Drag & Drop sortiert werden.').appendTo(dialogBox);

	function drawRow(cd) {
		if (cd.presets && cd.presets.indexOf(self.settingId) === -1) return null;

		var boxO = document.createElement('li');
		boxO.className = 'colrow';
		boxO.colId = cd.id;

		var labelO = boxO.appendChild(document.createElement('label'));

		var checkO = labelO.appendChild(document.createElement('input'));
		checkO.className = 'name';
		checkO.type = 'checkbox';

		checkO.checked = self.rows.indexOf(cd.id) !== -1;

		if (checkO.checked) {
			boxO.className += ' sortable';
			var orderBox = document.createElement('div');
			orderBox.className = 'orderbox';
			boxO.appendChild(orderBox);
		}

		labelO.appendChild(document.createTextNode(cd.label));

		return boxO;
	}

	var ul = $(document.createElement('ul'));
	ul.addClass('columnlist');
	var i, col;
	for (i = 0; i < self.rows.length; i++) {
		col = self.columnData[self.rows[i]];
		ul.append(drawRow(col, self.columns[i]));
	}
	var columnsSorted = Object.keys(self.columnData).filter(function (id) {
		return self.columnData[id].groupable;
	});
	columnsSorted.sort(function (a, b) {
		var cola = self.columnData[a];
		var colb = self.columnData[b];
		if (cola.label < colb.label) return -1;
		if (cola.label > colb.label) return 1;
		return 0;
	});
	for (var j = 0; j < columnsSorted.length; j++) {
		var colId = columnsSorted[j];
		if (self.rows.indexOf(colId) === -1) {
			ul.append(drawRow(self.columnData[colId], null));
		}
	}

	dialogBox.append(ul);

	ul.sortable();

	dialogBox.dialog({
		width: 400,
		maxHeight: 500,
		modal: true,
		buttons: {
			OK: function () {

				for (var i = 0; i < self.rows.length; i++) {
					self.rows.splice(i, 1);
					i--;
				}

				$(this).find('li').each(function () {
					var checkO = $('input', this)[0];
					if (checkO.checked)
						self.rows.push(this.colId);
				});

				self.saveSettings();

				self.load();

				$(this).dialog("close");

			},
			'Abbrechen': function () {
				$(this).dialog("close");
			}
		}
	});

};
ApplicantAnalytics.prototype.openColumnValueDialog = function (col, callb) {
	var self = this;
	var cd = self.columnData[col.cdId];

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Bedingung für ' + cd.label);

	$(document.createElement('p')).text(
		'Bedingung für ' + cd.label).appendTo(dialogBox);

	var valueO;
	var possibleValues = self.groupStats[col.cdId];
	if(possibleValues) {
		possibleValues = possibleValues.map(function(d) {
			return d.value;
		});
	}
	var submitValue = function () {
		callb(valueO.getValue());
		dialogBox.dialog("close");
	};
	if(['int', 'grade', 'semester'].indexOf(cd.formatting) !== -1 || !possibleValues) {
		valueO = FilterList.prototype.drawValueSelector(col.grpValue, cd.formatting, submitValue);
	} else {
		valueO = FilterList.prototype.drawStringValueSelector(col.grpValue, possibleValues, cd.formatting, submitValue);
	}

	dialogBox.append(valueO);


	dialogBox.dialog({
		width: 400,
		maxHeight: 500,
		modal: true,
		buttons: {
			OK: submitValue,
			'Abbrechen': function () {
				$(this).dialog("close");
			}
		}
	});

};