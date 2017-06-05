// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function DetailsTable(parentDOM, settingsPrefix) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settingsPrefix = settingsPrefix || 'details_';
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
	this.mandatoryColumns = [];

	this.tableDOM = $(document.createElement('table'));

	this.list = null; // Last loaded list
	this.metadata = null;

	this.drawn = false;

	this.openColumnDialog = openColumnDialog;
	this.loadPresetSettings = loadPresetSettings;
	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;

}
DetailsTable.prototype.defineColumn = function (id, label, title, formatting) {
	return this.columnData[id] = {
		id: id,
		label: label,
		title: title,
		formatting: formatting
	};
};
/**
 * Gets called once this DetailsTable is initialized
 */
DetailsTable.prototype.init = function () {
	// Check for global context and filters
	var self = this;
	this.columns = this.settings.default.columns.slice();
	this.pagination.limit = this.settings.default.limit;
	this.displayPagination = this.settings.default.displayPagination;
	this.sortable = this.settings.default.sortable;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sort2 = this.settings.default.sort2;

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
DetailsTable.prototype.sortChanged = function() {
	if(this.clientSort) {
		this.sortTable();
	}
};

/**
 * Gets called every time the DetailsTable must be drawn completely
 */
DetailsTable.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.paginationDOM.addClass('pagination');
		this.parentDOM.append(this.paginationDOM);

		this.tableDOM.addClass('studentList tbl sortable');
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


	if (!this.list) {
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

	for (var i = 0; i < this.list.length; i++) {
		var entry = this.list[i];

		tbody.append(this.drawEntry(entry));
	}

	adjustTableHeaders(this.tableDOM);


};
DetailsTable.prototype.drawEntry = function (entry) {
	var tr = $(document.createElement('tr'));

	for (var i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(entry, col, td);
	}

	return tr;
};
DetailsTable.prototype.drawCellValue = function (entry, col, td) {
	var value = getByPath(col.id, entry);

	if (col.drawValue && col.drawValue instanceof Function) {
		col.drawValue(entry, col, td);

	} else {
		td.append(getFormattedHTML(value, col.formatting));
	}

};
DetailsTable.prototype.sortTable = function () {
	var self = this;
	var sorts = [], parts;
	if(self.pagination.sort1) {
		parts = self.pagination.sort1.split(',', 2);
		sorts.push({field: parts[0], direction: parseInt(parts[1])});
	}
	if(self.pagination.sort2) {
		parts = self.pagination.sort2.split(',', 2);
		sorts.push({field: parts[0], direction: parseInt(parts[1])});
	}
	if(!sorts.length) {
		return;
	}

	this.list.sort(sortFunction);

	this.draw();

	function sortFunction(a, b) {
		for(var i = 0; i<sorts.length; i++) {
			var s = sorts[i];
			var valueA = getByPath(s.field, a);
			var valueB = getByPath(s.field, b);
			if(valueA > valueB) return s.direction;
			if(valueA < valueB) return s.direction * -1;
		}
		return 0;
	}

};
DetailsTable.prototype.onHeaderClick = function () {
	this.load();
};
DetailsTable.prototype.load = function () {
	this.saveSettings();
	// Overwrite to reload data
};