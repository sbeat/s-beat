// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

/**
 * Student analytics table
 * Depends on studentlist
 * @constructor
 */
function StudentAnalytics(parentDOM, noInit) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.query = this.parentDOM.attr('data-query') || '';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = 'sanalytics_';
	this.tooltipPrefix = 'tooltip_';
	this.settings = {
		'default': {
			limit: 0,
			sort1: 'group,1',
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
			rows: ['end_semester'],
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
			rows: ['end_semester'],
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

	this.graphLevel = Infinity;

	this.definitions = null;

	this.linkBox = $(document.createElement('div'));

	this.tableDOM = $(document.createElement('table'));
	this.tbodyDOM = null;

	this.graphDOM = $(document.createElement('div'));
	this.graph = null;

	this.graphMode = 'relative';

	this.data = null; // Last loaded list
	this.metadata = null;

	this.groupStats = null;

	this.drawn = false;

	this.entries = null;

	this.allowedTableFormats = ['grade', 'percent', 'float', 'int'];

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);

	this.listSettings = new ListSettings(this, 'list');

	this.filter.multiFilters = {
		exam_count: ['exam_count', 'exam_count_success', 'exam_count_applied']
	};

	this.settingsFields = ['graphMode', 'rows'];

	this.tableLinks = $(document.createElement('div')).addClass('table_links');
	this.diagramLinks = $(document.createElement('div')).addClass('table_links');

	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;

	if (!noInit) {
		StudentAnalytics.prototype.init.call(this);
	}
}

StudentAnalytics.prototype.defineColumn = function (id, label, title, formatting, groupable, calculations, category) {
	return this.columnData[id] = {
		id: id,
		label: label,
		title: title,
		formatting: formatting,
		groupable: groupable,
		calculations: calculations,
		category: category
	};
};

StudentAnalytics.prototype.getColumnObject = function (cdId, grpValue, calcOp) {
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
StudentAnalytics.prototype.removeColumn = function (col) {
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
StudentAnalytics.prototype.addLink = function (label, click, to) {
	if (!to) to = this.linkBox;
	to.append(' ');
	var setBtn = $(document.createElement('a'));
	setBtn.attr('href', '');
	setBtn.text(label);
	setBtn.click(function (e) {
		e.preventDefault();
		click.call(setBtn);
	});
	to.append(setBtn);
	return setBtn;
};

/**
 * Gets called once this StudentAnalytics is initialized
 */
StudentAnalytics.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	this.defineColumn('group', 'Gruppe', 'Gruppierung', 'str', undefined, undefined, 'Allgemein');
	this.defineColumn('count', 'Studenten', 'Anzahl Studenten in der Gruppe', 'int', undefined, undefined, 'Allgemein');
	// this.defineColumn('age', 'Alter', 'Anzahl Studenten mit dem Alter bzw. berechnetes Alter in der Gruppe', 'int', true, ['min', 'max', 'avg']);
	// this.defineColumn('bonus_total', CONFIG.cp_label, null, 'int', true, ['min', 'max', 'avg']);
	// this.defineColumn('exam_count', 'Leistungen', null, 'int', true, ['min', 'max', 'avg']);
	this.defineColumn('gender', 'Geschlecht', 'Anzahl Studenten mit dem Geschlecht', 'str', true, undefined, 'Student');
	this.defineColumn('hzb_type', 'HZB Gruppe', 'Anzahl Studenten mit der HZB Gruppe', 'str', true, undefined, 'Student.HZB');
	this.defineColumn('hzb_grade', 'HZB Note', null, 'grade', true, ['min', 'max', 'avg'], 'Student.HZB');
	// this.defineColumn('hzb_imm_time', 'Monate seit HZB', null, 'int', true, ['min', 'max', 'avg']);
	this.defineColumn('status', 'Status', null, 'status', true, undefined, 'Student');
	// this.defineColumn('semesters', 'Studiumssemester', 'Länge des Studiums der Studenten mit Examatrikulation', 'int', true, ['min', 'max', 'avg']);
	// this.defineColumn('cnt_delayed_exams', 'Rücktritte', null, 'int', false, ['min', 'max', 'avg']);
	// this.defineColumn('study_time_real', 'Semester mit Leistungen', null, 'int', true, ['min', 'max', 'avg']);
	this.defineColumn('start_semester', 'Start Semester', null, 'semester', true, undefined, 'Student.Studium');
	this.defineColumn('end_semester', 'End Semester', null, 'semester', true, undefined, 'Student.Studium');

	this.defineColumn('final_grade', 'Abschlussnote', null, 'grade', true, ['min', 'max', 'avg']);
	// this.defineColumn('grade_basic_studies', 'Note Grundstudium', null, 'grade', true, ['min', 'max', 'avg']);
	// this.defineColumn('grade_main_studies', 'Note Hauptstudium', null, 'grade', true, ['min', 'max', 'avg']);
	// this.defineColumn('grade_current', 'Note aktuell', null, 'grade', true, ['min', 'max', 'avg']);
	// this.defineColumn('semester_data.sem_1.grade', 'Note im 1. Semester', null, 'grade', true, ['min', 'max', 'avg']);
	// this.defineColumn('semester_data.sem_2.grade', 'Note im 2. Semester', null, 'grade', true, ['min', 'max', 'avg']);
	// this.defineColumn('semester_data.sem_3.grade', 'Note im 3. Semester', null, 'grade', true, ['min', 'max', 'avg']);

	this.settings.default.columns.push(this.getColumnObject('group'));
	this.settings.default.columns.push(this.getColumnObject('count'));
	this.settings.default.columns.push(this.getColumnObject('hzb_grade', undefined, 'avg'));
	this.settings.default.columns.push(this.getColumnObject('gender', 'W'));
	this.settings.default.columns.push(this.getColumnObject('gender', 'M'));

	this.settings.course.columns.push(this.getColumnObject('group'));
	this.settings.course.columns.push(this.getColumnObject('count'));
	this.settings.course.columns.push(this.getColumnObject('final_grade', undefined, 'avg'));

	this.settings.course_sem.columns.push(this.getColumnObject('group'));
	this.settings.course_sem.columns.push(this.getColumnObject('count'));

	this.columns = this.settings.default.columns.slice();
	this.rows = this.settings.default.rows.slice();
	this.pagination.limit = this.settings.default.limit;
	this.displayPagination = this.settings.default.displayPagination;
	this.sortable = this.settings.default.sortable;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;

	for (var i = 0; i < this.columns.length; i++) {
		var col = this.columns[i];
		var label = this.getColumnLabel(col).textContent;
		this.pagination.sortOptions[col.id + ',1'] = label + ' aufsteigend';
		this.pagination.sortOptions[col.id + ',-1'] = label + ' absteigend';
	}

	self.pagination.changed = function () {
		self.sortChanged();
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


	self.initialLoad();

};

StudentAnalytics.prototype.initialLoad = function () {
	var self = this;
	var serverSettingId = self.parentDOM.attr('data-ssid');

	var asyncParent = this.parentDOM.parents('[data-asyncload=1]');
	if(asyncParent.size() && serverSettingId) {
		asyncParent[0].toggle();
		loadWithSsid();
	} else if (asyncParent.size()) {
		asyncParent.one('show', function () {
			loadWithSsid();
		});

	} else {
		loadWithSsid();
	}

	function loadWithSsid() {
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
	}
};

StudentAnalytics.prototype.sortChanged = function () {
	this.draw();
	this.saveSettings();
};

/**
 * Gets called every time the StudentAnalytics must be drawn completely
 */
StudentAnalytics.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.filterDOM.addClass('filterlist');
		this.parentDOM.append(this.filterDOM);
		this.filter.draw();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.parentDOM.append(this.linkBox);

		this.parentDOM.append(this.tableLinks);
		this.parentDOM.append(this.diagramLinks);
		this.diagramLinks.hide();

		this.tableDOM.addClass('indentList tbl sortable');
		this.parentDOM.append(this.tableDOM);

		this.graphDOM.css('min-height', '400px');
		this.parentDOM.append(this.graphDOM);

		this.listSettings.linkDOM = this.addLink('Einstellungen', function () {
			// self.openSettingsDialog();
			self.listSettings.openMenu();
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

		this.addLink('Alle Gruppen aufklappen', function () {
			self.openCloseAll(true);
		}, this.tableLinks);
		this.addLink('Alle Gruppen einklappen', function () {
			self.openCloseAll(false);
		}, this.tableLinks);
		this.addLink('Herunterladen', function () {
			self.download();
		}, this.tableLinks);

		this.addLink('Gruppen Ebene erhöhen', function () {
			if (self.graphLevel === Infinity) {
				self.graphLevel = 1;
			} else {
				self.graphLevel++;
				if (self.graphLevel > self.rows.length) {
					self.graphLevel = 1;
				}
			}
			self.draw();
		}, this.diagramLinks);
		this.addLink('Alle Gruppen anzeigen', function () {
			self.graphLevel = Infinity;
			self.draw();
		}, this.diagramLinks);

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
		this.tableLinks.show();
		this.diagramLinks.hide();
		if (!this.data) {
			this.tableDOM.text('Keine Daten verfügbar');
			return;
		}
		this.drawTable();
	}
	if (this.mode === 'graph') {
		this.graphDOM.show();
		this.tableDOM.hide();
		this.tableLinks.hide();
		this.diagramLinks.show();
		if (!this.data) {
			this.graphDOM.text('Keine Daten verfügbar');
			return;
		}
		this.drawGraph();

	}


};
StudentAnalytics.prototype.drawGraph = function () {
	var self = this;
	this.graphDOM.empty();
	this.graph = new HBarChart(this.graphDOM);
	this.graph.firstLegend = true;
	this.graph.barMode = this.graphMode;

	this.entries = getEntries([]);

	for (var i = 0; i < this.entries.length; i++) {
		var entry = this.entries[i];
		var id = this.getBarLabel(entry);
		this.graph.addBar(id, id);

		for (var j = 0; j < this.columns.length; j++) {
			var col = this.columns[j];
			if (col.type === 'group') {
				var value = entry[col.id];
				var label = this.getColumnLabel(col);
				this.graph.addValue(id, label.data || label.innerText, value);
			}
		}
	}

	this.graph.draw();

	function getEntries(path, allEntries) {
		if (!allEntries) allEntries = [];
		var entries = self.getEntriesTreeLevel(path);
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			if (entry.ident.length < self.rows.length && entry.ident.length < self.graphLevel) {
				if (self.graphLevel === Infinity) {
					allEntries.push(entry);
				}
				getEntries(entry.ident, allEntries);
			} else {
				allEntries.push(entry);
			}
		}
		return allEntries;
	}

};
StudentAnalytics.prototype.getBarLabel = function (entry) {
	var self = this;
	var text = [];
	for (var i = 0; i < self.rows.length; i++) {
		var cd = self.columnData[self.rows[i]];
		var value = entry.ident[i];
		if (value !== undefined) {
			text.push(getNumericValueOutput(value, cd.formatting));
		}
	}
	return text.join(', ');
};
StudentAnalytics.prototype.download = function () {
	var self = this;
	var rows = [];
	var cellDivider = ';';
	var lineDivider = '\r\n';

	var header = [];
	self.columns.forEach(function (col) {
		var cd = self.columnData[col.cdId];
		if (!cd) return;

		if (col.cdId === 'group') {
			for (var i = 0; i < self.rows.length; i++) {
				var gcd = self.columnData[self.rows[i]];
				header.push(gcd.label);
			}
		} else if (self.getColumnLabel) {
			var text = self.getColumnLabel(col);
			if (text.innerText !== undefined) {
				header.push(text.innerText);
			} else if (text.textContent) {
				header.push(text.textContent);
			} else {
				header.push(col.cdId);
			}
		} else {
			header.push(cd.label);
		}
	});
	rows.push(header.join(cellDivider) + lineDivider);

	var entries = getEntries();

	entries.forEach(function (entry) {
		var row = [];
		self.columns.forEach(function (col) {
			if (col.cdId === 'group') {
				drawGroupCells(row, entry);
			} else {
				drawCells(row, entry, col);
			}
		});
		rows.push(row.join(cellDivider) + lineDivider);
	});

	downloadFile(rows, 'text/csv;charset=UTF-8', 'sbeat_analytics.csv');

	function getEntries(path, allEntries) {
		if (!allEntries) allEntries = [];
		var entries = self.getEntriesTreeLevel(path);
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			if (entry.ident.length < self.rows.length) {
				getEntries(entry.ident, allEntries);
			} else {
				allEntries.push(entry);
			}
		}
		return allEntries;
	}

	function formatNumber(value) {
		if (!isNaN(value)) {
			return String(value).replace('.', ',');
		}
		if (value === '-') {
			return '0';
		}
		return value;
	}

	function drawGroupCells(row, entry) {
		for (var i = 0; i < self.rows.length; i++) {
			var gcd = self.columnData[self.rows[i]];
			var value = entry.ident[i];
			if (value !== undefined) {
				row.push(formatNumber(getNumericValueOutput(value, gcd.formatting)));
			} else {
				row.push('-');
			}
		}
	}

	function drawCells(row, entry, col) {
		var cd = self.columnData[col.cdId];
		if (!cd) return;
		if (cd.drawValue && cd.drawValue instanceof Function) {
			cd.drawValue(entry, col, td);

		} else {
			var value = entry[col.id];
			var formatting = cd.formatting;
			if (self.allowedTableFormats.indexOf(formatting) === -1 || col.type === 'group') formatting = 'int';
			var text = getFormattedHTML(value, formatting);
			if (text.innerText !== undefined) {
				row.push(formatNumber(text.innerText));
			} else if (text.textContent) {
				row.push(formatNumber(text.textContent));
			} else {
				row.push(0);
			}
		}
	}


};
StudentAnalytics.prototype.drawTable = function () {
	var self = this;
	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	drawTableHead.call(this, tr, this.tooltipPrefix);

	thead.find('th').click(function () {
		var col = self.columnData[this.colId];
		var sortField = col.sortBy ? col.sortBy : this.col.id;

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


	var tbody = this.tbodyDOM = document.createElement('tbody');
	this.tableDOM.append(tbody);

	console.log('columns', this.columns);

	this.drawEntries([], tbody);

	adjustTableHeaders(this.tableDOM);
};

StudentAnalytics.prototype.sortEntries = function (entries) {
	var self = this;
	var sort1 = getSortInfo(self.pagination.sort1);
	var sort2 = getSortInfo(self.pagination.sort2);

	entries.sort(sortEntries);

	function sortEntries(a, b) {
		if (sort1.field) {
			var valA = a[sort1.field];
			var valB = b[sort1.field];
			if (valA === null) valA = -Infinity;
			if (valB === null) valB = -Infinity;
			if (valA > valB || valB === -Infinity && valA !== -Infinity) return sort1.direction;
			if (valA < valB || valA === -Infinity && valB !== -Infinity) return sort1.direction * -1;
		}

		if (sort2.field) {
			valA = a[sort2.field];
			valB = b[sort2.field];
			if (valA === null) valA = -Infinity;
			if (valB === null) valB = -Infinity;
			if (valA > valB || valB === -Infinity && valA !== -Infinity) return sort2.direction;
			if (valA < valB || valA === -Infinity && valB !== -Infinity) return sort2.direction * -1;
		}

		return 0;
	}

	function getSortInfo(sortStr) {
		var info = {field: null, direction: 1};
		if (!sortStr) {
			return info;
		}
		var parts = sortStr.split(',', 2);
		if (parts[0]) info.field = parts[0];
		if (parts[1] === '-1') info.direction = -1;
		return info;
	}
};

StudentAnalytics.prototype.getEntriesTreeLevel = function (path) {
	var self = this;
	if (!self.data) {
		return [];
	}
	if (!path) {
		path = [];
	} else {
		path = path.slice();
	}

	var results = self.data.group_results;
	var entries = {};
	for (var i = 0; i < results.length; i++) {
		var d = results[i];
		var entryPath = getEntryPath(d);
		if (!isInPath(entryPath)) continue;
		var entryIdPath = entryPath.slice(0, path.length + 1);
		var entryId = entryPath[path.length];
		var entry = entries[entryId];
		if (!entry) {
			entries[entryId] = entry = createEntry(entryIdPath);
		}
		addValueToEntry(entry, d);
	}

	var entriesArray = Object.keys(entries).map(function (entryId) {
		return entries[entryId];
	});

	finishValuesOfEntries(entriesArray);

	self.sortEntries(entriesArray);

	return entriesArray;


	function getEntryPath(d) {
		var values = [];
		for (var i = 0; i < self.rows.length; i++) {
			var row = self.rows[i];
			values.push(d._id[row]);
		}
		return values;
	}

	function isInPath(entryPath) {
		for (var i = 0; i < path.length && i < entryPath.length; i++) {
			if (entryPath[i] !== path[i]) return false;
		}
		return true;
	}

	function createEntry(entryIdPath) {
		var entry = {
			ident: entryIdPath,
			group: null,
			count: 0,
			open: entryIdPath.length === self.rows.length ? undefined : false
		};
		for (var i = 0; i < self.columns.length; i++) {
			var col = self.columns[i];
			entry[col.id] = null;
		}
		entry.group = entryIdPath.join(',');
		return entry;
	}

	function addValueToEntry(entry, d) {
		for (var i = 0; i < self.columns.length; i++) {
			addValueToEntryByCol(self.columns[i], entry, d);
		}
	}

	function finishValuesOfEntries(entries) {
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			for (var j = 0; j < self.columns.length; j++) {
				finishValueOfEntryByCol(self.columns[j], entry);
			}
		}
	}

	function addValueToEntryByCol(col, entry, d) {
		var value = entry[col.id];
		if (col.type === 'direct' && d[col.cdId] !== undefined) {
			value = (value || 0) + d[col.cdId];
		}
		if (col.type === 'calc' && d[col.id] !== undefined) {
			if (col.calcOp === 'sum') {
				if (d[col.id] !== null) {
					value = (value || 0) + d[col.id];
				}
			}
			if (col.calcOp === 'avg') {
				var count = d['count.' + col.cdId];
				if (d[col.id] !== null && count) {
					value = (value || 0) + d[col.id] * count;
					entry['_avgCount_' + col.id] = (entry['_avgCount_' + col.id] || 0) + count;
				}
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
			var cmpInfo = getCompareValueInfo(col.grpValue, cd.formatting, true);
			if (cmpInfo.operator === 'equal' && grpValue === cmpInfo.value
				|| cmpInfo.operator === 'lte' && grpValue <= cmpInfo.value
				|| cmpInfo.operator === 'gte' && grpValue >= cmpInfo.value
				|| cmpInfo.operator === 'between'
				&& grpValue >= cmpInfo.minValue
				&& grpValue <= cmpInfo.maxValue) {
				value = (value || 0) + d.count;
			}
		}
		entry[col.id] = value;
	}

	function finishValueOfEntryByCol(col, entry) {
		var value = entry[col.id], count = entry['_avgCount_' + col.id];
		if (col.type === 'calc' && col.calcOp === 'avg' && count) {
			entry[col.id] = value / count;
			delete entry['_avgCount_' + col.id];
		}
	}

};

StudentAnalytics.prototype.openCloseAll = function (open) {
	if (!this.tbodyDOM) return;
	for (var i = 0; i < this.tbodyDOM.childNodes.length; i++) {
		var tr = this.tbodyDOM.childNodes[i];
		if (open && tr.openAll) {
			tr.openAll();
		} else if (!open && tr.closeAll) {
			tr.closeAll();
		}
	}

};
StudentAnalytics.prototype.drawEntries = function (path, parent, afterEl) {
	var entriesTree = this.getEntriesTreeLevel(path);

	var fragment = document.createDocumentFragment();

	for (var i = 0; i < entriesTree.length; i++) {
		var entry = entriesTree[i];
		fragment.append(this.drawEntry(entry));
	}

	if (afterEl) {
		parent.insertBefore(fragment, afterEl.nextSibling);
	} else {
		parent.appendChild(fragment);
	}

	return entriesTree;
};
StudentAnalytics.prototype.removeEntries = function (group, parent) {
	var idStart = group + ',';
	for (var i = 0; i < parent.childNodes.length; i++) {
		var node = parent.childNodes[i];
		if (node.id && node.id.indexOf(idStart) === 0) {
			parent.removeChild(node);
			i--;
		}
	}
};
StudentAnalytics.prototype.drawEntry = function (entry) {
	var self = this;
	var tr = document.createElement('tr');
	tr.id = entry.group;

	if (entry.open !== undefined) {
		entry.toggleOpen = function () {
			entry.open = !entry.open;
			if (entry.open) {
				self.drawEntries(entry.ident, tr.parentNode, tr);
			} else {
				self.removeEntries(entry.group, tr.parentNode);
			}
		};
		tr.openAll = function () {
			if (!entry.open) {
				entry.open = true;
				var entries = self.drawEntries(entry.ident, tr.parentNode, tr);
				for (var i = 0; i < entries.length; i++) {
					var subEntry = entries[i];
					if (subEntry.toggleOpen) {
						subEntry.toggleOpen();
					}
				}
			}
		};
		tr.closeAll = function () {
			if (entry.open) {
				entry.toggleOpen();
			}
		}
	}

	for (var i = 0; i < self.columns.length; i++) {
		var cd = self.columns[i];
		var td = document.createElement('td');
		self.drawCellValue(entry, cd, td);
		tr.appendChild(td);
	}

	return tr;
};

StudentAnalytics.prototype.drawCellValue = function (entry, col, td) {
	var cd = this.columnData[col.cdId];
	if (!cd) {
		return;
	}
	if (col.id === 'group') {

		if (entry.open !== undefined) {
			var link = $('<a class="openable" href="javascript:"></a>');
			entry.toggleOpenWithView = function () {
				if (entry.open) {
					link.removeClass('open');
				} else {
					link.addClass('open');
				}
				entry.toggleOpen();
			};
			link.click(function (e) {
				e.preventDefault();
				entry.toggleOpenWithView();
			});
			td.appendChild(link[0]);
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
			td.title = rCd.label;
		}
		td.classList.add('level' + level);
		if (lastValue) {
			td.appendChild(lastValue);
		}

	} else if (cd.drawValue && cd.drawValue instanceof Function) {
		cd.drawValue(entry, col, td);

	} else {
		var value = entry[col.id];
		var formatting = cd.formatting;
		if (this.allowedTableFormats.indexOf(formatting) === -1 || col.type === 'group') formatting = 'int';
		td.formattedAs = value + ' ' + formatting;
		td.appendChild(getFormattedHTML(value, formatting));
	}

};
StudentAnalytics.prototype.onHeaderClick = function () {

};
StudentAnalytics.prototype.initColumns = function () {
	var self = this;
	var query;
	for (var qId in self.definitions['queries']) {
		query = self.definitions['queries'][qId];
		if (self.definitions.restricted.indexOf(query.q) !== -1) continue;
		if (['int', 'grade', 'percent'].indexOf(query['formatting']) !== -1) {
			self.defineColumn(query.q, query.name, query.name, query.formatting, query['formatting'] !== 'percent', ['min', 'max', 'avg'], query.category);
		}
	}
};
StudentAnalytics.prototype.load = function () {
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
			StudentList.prototype.initDefinitions.call(self, data.definitions);
			self.definitions.restricted.forEach(function(field) {
				self.removeColumn(field);
			});
			self.initColumns();

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
StudentAnalytics.prototype.loadGroupStatistics = function (callb) {
	var self = this;
	var url = '/api/GetStudents';

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
StudentAnalytics.prototype.getColumnLabel = function (col) {
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
StudentAnalytics.prototype.openColumnDialog = function () {
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
		if (cd.titl) {
			boxO.title = cd.title;
		}

		var labelO = boxO.appendChild(document.createElement('label'));

		if (col.type === 'group' && col.grpValue === null) {
			labelO.appendChild(document.createTextNode(cd.label + ' '));
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

		var categories = getColumnsByCategory();
		var categroyKeys = Object.keys(categories);
		categroyKeys.sort();

		for (var l = 0; l < categroyKeys.length; l++) {
			var catKey = categroyKeys[l];
			if (catKey === 'ignore') continue;
			var columns = categories[catKey];
			var path = catKey.split('.');

			ul.append($('<li></li>').addClass('cat_title').text(path.join(' » ')));


			for (var j = 0; j < columns.length; j++) {
				var cd = columns[j];
				var colId = cd.id;
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

		}


		dialogBox.append(ul);

		ul.sortable();
	}

	function getColumnsByCategory() {
		var result = {};
		Object.keys(self.columnData).forEach(function (colId) {
			var col = self.columnData[colId];
			var cat = col.category || 'Sonstige';
			if (!result[cat]) result[cat] = [];
			result[cat].push(col);
		});
		Object.keys(result).forEach(function (cat) {
			sortByField(result[cat], 'label', 1);
		});
		return result;
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
					if (checkO && checkO.checked && this.col)
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

StudentAnalytics.prototype.openGroupDialog = function () {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Gruppenauswahl');

	$(document.createElement('p')).text(
		'Die ausgewählten Gruppen können per Drag & Drop sortiert werden.').appendTo(dialogBox);
	$(document.createElement('p')).text(
		'Es können maximal 3 Gruppen gewählt werden.').appendTo(dialogBox);

	function drawRow(cd) {
		if (!cd || cd.presets && cd.presets.indexOf(self.settingId) === -1) return null;

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
					if (checkO.checked && self.rows.length < 3)
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
StudentAnalytics.prototype.openColumnValueDialog = function (col, callb) {
	var self = this;
	var cd = self.columnData[col.cdId];

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Bedingung für ' + cd.label);

	$(document.createElement('p')).text(
		'Bedingung für ' + cd.label).appendTo(dialogBox);

	var valueO;
	var possibleValues = self.groupStats[col.cdId];
	if (possibleValues) {
		possibleValues = possibleValues.map(function (d) {
			return d.value;
		});
	}
	var submitValue = function () {
		callb(valueO.getValue());
		dialogBox.dialog("close");
	};
	if (['int', 'grade', 'semester'].indexOf(cd.formatting) !== -1 || !possibleValues) {
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