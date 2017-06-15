// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function StudentAnalytics(parentDOM, settingsPrefix) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = settingsPrefix || 'sanalytics_';
	this.tooltipPrefix = settingsPrefix || 'tooltip_';
	this.settings = {
		'default': {
			limit: 100,
			sort1: null,
			sort2: null,
			filters: [],
			columns: [],
			displayPagination: false,
			sortable: false
		}
	};

	this.paginationDOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.limit = this.settings.default.limit;
	this.displayPagination = false;
	this.sortable = true;
	this.clientSort = false;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;
	this.pagination.sortOptions = {};

	this.columnData = {};
	this.columns = [];
	this.rows = [];
	this.mandatoryColumns = [];

	this.tableDOM = $(document.createElement('table'));

	this.data = null; // Last loaded list
	this.metadata = null;

	this.drawn = false;

	this.entries = null;

	this.showGroupSummary = true;
	this.openLevels = 0;

	this.openColumnDialog = openColumnDialog;
	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;

	StudentAnalytics.prototype.init.call(this);
}
StudentAnalytics.prototype.defineColumn = function (id, label, title, formatting, groupable, calculations) {
	return this.columnData[id] = {
		id: id,
		label: label,
		title: title,
		formatting: formatting,
		groupable: groupable,
		calculations: calculations
	};
};

StudentAnalytics.prototype.addColumn = function (id, type, grpValue, calcOp) {
	var col = {
		id: id,
		cdId: id, // ref to the columnData
		type: type || 'direct', // direct, group, calc
		grpValue: grpValue || null, // for type=group
		calcOp: calcOp || null // for type=calc
	};
	if (type === 'group') {
		col.id = id + '=' + grpValue;
	}
	if (type === 'calc') {
		col.id = calcOp + '.' + id;
	}
	this.columns.push(col);
	return col;
};

StudentAnalytics.prototype.addRow = function (id) {
	this.rows.push(id);
	return id;
};

/**
 * Gets called once this StudentAnalytics is initialized
 */
StudentAnalytics.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	this.defineColumn('name', 'Name', null, 'str');
	this.defineColumn('count', 'Studenten', null, 'int');
	this.defineColumn('age', 'Alter', null, 'int', true, ['min', 'max', 'avg']);
	this.defineColumn('gender', 'Geschlecht', null, 'str', true);
	this.defineColumn('hzb_type', 'HZB Gruppe', null, 'str', true);
	this.defineColumn('hzb_grade', 'HZB Note', null, 'grade', true, ['min', 'max', 'avg']);
	this.defineColumn('status', 'Status', null, 'status', true);
	this.defineColumn('semesters', 'Semester', null, 'int', true, ['min', 'max', 'avg']);
	this.defineColumn('start_semester', 'Start Semester', null, 'semester', true);

	this.columns = this.settings.default.columns.slice();
	this.pagination.limit = this.settings.default.limit;
	this.displayPagination = this.settings.default.displayPagination;
	this.sortable = this.settings.default.sortable;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;

	this.addColumn('name', 'label');
	this.addColumn('count', 'direct');
	this.addColumn('hzb_grade', 'calc', null, 'avg');
	this.addColumn('gender', 'group', 'W');
	this.addColumn('gender', 'group', 'M');

	this.addRow('start_semester');
	this.addRow('hzb_type');

	for (var colId in this.columnData) {
		var col = this.columnData[colId];
		var sf = col.id;
		if (col.sortBy) {
			sf = col.sortBy;
		}
		this.pagination.sortOptions[sf + ',1'] = col.label + ' aufsteigend';
		this.pagination.sortOptions[sf + ',-1'] = col.label + ' absteigend';
	}

	//self.loadSettings();

	self.draw();

	this.pagination.changed = function () {
		self.sortChanged();
		self.load();
	};
	this.pagination.onReset = function () {
		self.loadPresetSettings(self.settingId);
		self.load();
	};

	self.load();

};
StudentAnalytics.prototype.sortChanged = function () {
	if (this.clientSort) {
		this.sortTable();
	}
};

/**
 * Gets called every time the StudentAnalytics must be drawn completely
 */
StudentAnalytics.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.tableDOM.addClass('indentList tbl sortable');
		this.parentDOM.append(this.tableDOM);

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
StudentAnalytics.prototype.getEntries = function () {
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
			var cd = self.columns[i];
			entry[cd.id] = getValue(cd, entry.results);
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

	function getValue(cd, results) {
		var value = null, count = 0;
		for (var i = 0; i < results.length; i++) {
			var d = results[i];
			if (cd.type === 'direct' && d[cd.cdId] !== undefined) {
				value = (value || 0) + d[cd.cdId];
			}
			if (cd.type === 'calc' && d[cd.id] !== undefined) {
				if (cd.calcOp === 'avg' || cd.calcOp === 'sum') {
					value = (value || 0) + d[cd.id];
					count++;
				}
				if (cd.calcOp === 'min' && (value === null || d[cd.id] < value)) {
					value = d[cd.id];
				}
				if (cd.calcOp === 'max' && (value === null || d[cd.id] > value)) {
					value = d[cd.id];
				}
			}
			if (cd.type === 'group') {
				var grpValue = d._id[cd.cdId];
				if (grpValue === cd.grpValue) {
					value = (value || 0) + d.count;
				}
			}
		}
		if (cd.type === 'calc' && cd.calcOp === 'avg' && count) {
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
				if(idPart === entry.ident[j]) {
					matched++;
				}
			}
			if(matched === ident.length && entry.ident.length === ident.length + 1) {
				childEntries.push(entry);
			}
		}
		return childEntries;
	}

	function toggleOpen() {
		var childEntries = getChildEntries(this.ident);
		for (var i = 0; i < childEntries.length; i++) {
			var entry = childEntries[i];
			if(this.open && entry.open) {
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
StudentAnalytics.prototype.setEntryDisplay = function (ident, open) {
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
StudentAnalytics.prototype.findParent = function (ident) {
	return this.entries.find(function(e) {
		var matched = 0;
		if(e.ident.length !== ident.length - 1) return false;
		for (var i = 0; i < ident.length - 1; i++) {
			if(ident[i] === e.ident[i]) matched++;
		}
		return matched === ident.length - 1;
	});
};
StudentAnalytics.prototype.drawEntry = function (entry) {
	var tr = $(document.createElement('tr'));
	tr.attr('id', entry.ident.join(','));

	if(entry.ident.length > 1) {
		var parentEntry = this.findParent(entry.ident);
		if(parentEntry && !parentEntry.open) {
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
StudentAnalytics.prototype.drawCellValue = function (entry, cd, td) {
	var col = this.columnData[cd.cdId];
	if (cd.id === 'name') {
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

		var level = 0, lastValue = null;
		for (var i = 0; i < this.rows.length; i++) {
			var row = this.rows[i];
			if (entry.ident[i] === undefined) continue;
			var rCol = this.columnData[row];
			lastValue = getFormattedHTML(entry.ident[i], rCol.formatting);
			level++;
		}
		td.addClass('level' + level);
		td.append(lastValue);

	} else if (col.drawValue && col.drawValue instanceof Function) {
		col.drawValue(entry, cd, td);

	} else {
		var value = entry[cd.id];
		td.append(getFormattedHTML(value, col.formatting));
	}

};
StudentAnalytics.prototype.sortTable = function () {
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
StudentAnalytics.prototype.onHeaderClick = function () {
	this.load();
};
StudentAnalytics.prototype.load = function () {
	var self = this;
	var url = '/api/GetStudents';

	self.saveSettings();

	var params = [];

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if (self.pagination.sort2)
		params.push('sort2=' + self.pagination.sort2);

	if (isTempActive()) params.push('temp=true');

	var groups = [], calculations = [];
	self.columns.forEach(function (col) {
		console.log('check col', col);
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


	if (params.length) url += '?';
	url += params.join('&');

	self.tableDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {

		self.data = data;

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