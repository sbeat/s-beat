// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function MarkedLists(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset') || 'default';
	this.settingsPrefix = 'markedlist_';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.settings = {
		'default': {
			limit: 20,
			sort1: 'name,1',
			filters: [],
			columns: ['name', 'count', 'owner'],
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
	this.pagination.limit = this.settings.default.limit;
	this.pagination.start = 0;
	this.pagination.secondaryDOM = this.pagination2DOM;

	this.pagination.sort1 = this.settings.default.sort1;
	this.pagination.sortOptions = {};

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);

	this.columnData = {
		'ident': {id: 'ident', label: 'List Ident', title: 'ID der Liste', formatting: 'str', sortBy: '_id', group: 'Liste'},
		'name': {id: 'name', label: 'Name', title: 'Name der Liste', formatting: 'str', group: 'Liste'},
		'count': {id: 'count', label: 'Anzahl Studenten', title: 'Anzahl der Studenten in der Liste', formatting: 'int', group: 'Liste'},
		'owner': {id: 'owner', label: 'Besitzer', title: 'Besitzer der Liste', formatting: 'str', group: 'Liste'},
		'created_by': {id: 'created_by', label: 'Erstellt von', title: 'Benutzer welcher die Liste erstellt hat', formatting: 'str', group: 'Liste'},
		'updated_by': {id: 'updated_by', label: 'Geändert von', title: 'Benutzer welcher die Liste zuletzt modifiziert hat', formatting: 'str', group: 'Liste'},
		'read_only': {id: 'read_only', label: 'Nur lesen', title: 'Kann nur der Besitzer die Liste ändern', formatting: 'yesno', group: 'Liste'}
	};
	this.columns = this.settings.default.columns;
	this.mandatoryColumns = ['name'];

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

	MarkedLists.prototype.init.call(this);
}
/**
 * Gets called once this MarkedLists is initialized
 */
MarkedLists.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	for (var colId in this.columnData) {
		var col = this.columnData[colId];
		this.filter.addAttributeFilter(col.id, col.label, col.group, col.formatting, col.formatting == 'int' ? 0 : '');

		if (col.sortBy) continue;
		this.pagination.sortOptions[col.id + ',1'] = col.label + ' aufsteigend';
		this.pagination.sortOptions[col.id + ',-1'] = col.label + ' absteigend';
	}

	this.pagination.onReset = function () {
		self.loadPresetSettings(self.settingId);
		self.load();
	};

	self.loadSettings();

	self.draw();

	this.pagination.changed = function (start) {
		self.load();
	};

	this.filter.filterChanged = function () {
		self.pagination.setStart(0);
		self.load();
	};

	$('[data-addMarkedListButton]').click(function (e) {
		e.preventDefault();
		self.drawAddListDialog();

	});


	self.load();

};

/**
 * Gets called every time the MarkedLists must be drawn completely
 */
MarkedLists.prototype.draw = function () {
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

	if (this.displayFilters) this.filterDOM.show();
	else this.filterDOM.hide();

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

	drawTableHead.call(this,tr,'tooltip_marked_');

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
		var exam = this.data.list[i];
		tbody.append(this.drawItem(exam));
	}


};
MarkedLists.prototype.drawItem = function (exam) {

	var tr = $(document.createElement('tr'));
	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(exam, col, td);
	}

	return tr

};
MarkedLists.prototype.drawCellValue = function (item, col, td) {
	var self = this;
	var value, fname = col.id.replace('CURRENT', self.data.current);
	fname = fname.replace('LAST', self.data.last);

	value = getByPath(fname, item);

	if (col.id == 'ident') {
		var idA = $(document.createElement('a'));
		idA.attr('href', 'markedlist.html?mlist=' + value);
		idA.text(value);
		td.append(idA);

	} else if (col.id == 'name') {
		var idA = $(document.createElement('a'));
		idA.attr('href', 'markedlist.html?mlist=' + item.ident);
		idA.text(value);
		td.append(idA);

	} else {
		td.append(getFormattedHTML(value, col.formatting));
	}


};

MarkedLists.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;
	self.filter.possibleValues = metadata;
};

MarkedLists.prototype.load = function () {
	var self = this;
	var url = '/api/GetMarkedList';

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
	if (!self.metadata) {
		params.push('metadata=true');
	}

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
	});

};

MarkedLists.prototype.drawMarkedListSettings = function (mlist,user_roles) {

	var self = this;

	if (!mlist) {
		return;
	}

	var dialogBox = $(document.createElement('div'));


	var label, p, itemLabel;
	p = $(document.createElement('p')).addClass('optionset').appendTo(dialogBox);
	$(document.createElement('label')).text('Name').appendTo(p);
	var name = $(document.createElement('input')).val(mlist.name).appendTo(p);

	p = $(document.createElement('p')).addClass('optionset').appendTo(dialogBox);
	$(document.createElement('label')).text('Wer darf diese Liste sehen?').appendTo(p);

	itemLabel = $(document.createElement('label')).text('Privat').appendTo(p);
	var isPrivate = $(document.createElement('input')).attr('type', 'checkbox').prependTo(itemLabel);

	if (mlist['owner'] != getUserName()) {
		itemLabel.hide();
	}


	var rolesP = $(document.createElement('p')).addClass('optionset').appendTo(dialogBox);
	var readyonlyP = $(document.createElement('p')).addClass('optionset').appendTo(dialogBox);
	$(document.createElement('label')).text('Freigabe für folgende Benutzerrollen:').appendTo(rolesP);

	if (!mlist['user_roles']) {
		isPrivate.attr('checked', true);
		rolesP.hide();
		readyonlyP.hide();
	}

	var roleChecks = {};

	isPrivate.click(function (e) {
		if (this.checked) {
			rolesP.hide();
			readyonlyP.hide();
		} else {
			rolesP.show();
			readyonlyP.show();
		}
	});


	for (var i = 0; i < user_roles.length; i++) {
		var role = user_roles[i];

		itemLabel = $(document.createElement('label')).text(role).appendTo(rolesP);
		roleChecks[role] = $(document.createElement('input')).attr('type', 'checkbox').val(role).prependTo(itemLabel);
		if (mlist['user_roles'] && mlist['user_roles'].indexOf(role) != -1) {
			roleChecks[role].attr('checked', true);
		}
		roleChecks[role].click(checkRole);

	}

	function checkRole(e) {
		if (!this.checked && this.value == getUserRole() && mlist['owner'] != getUserName()) {
			this.checked = true;
			alert('Die eigene Benutzerrolle kann nur vom Besitzer entfernt werden.');
		}
	}

	if (mlist['owner'] == getUserName()) {
		$(document.createElement('label')).text('Nur lesen').appendTo(readyonlyP);
		var roLabel = $(document.createElement('label')).text('Andere dürfen die Liste nur sehen und nicht verändern').appendTo(readyonlyP);
		var read_only = $(document.createElement('input')).attr('type', 'checkbox').prependTo(roLabel);
		if (mlist['read_only']) {
			read_only.attr('checked', true);
		}
	}

	dialogBox.getValues = function() {
		var data = {};
		data.name = name.val();
		data.user_roles = [];
		if (!isPrivate.is(':checked')) {
			for (var i = 0; i < user_roles.length; i++) {
				var role = user_roles[i];
				if (roleChecks[role].is(':checked')) {
					data.user_roles.push(role);
				}
			}
		}

		if (data.user_roles.length == 0) data.user_roles = null;
		else if (mlist['owner'] == getUserName()) {
			data.read_only = read_only.is(':checked') ? true : false;
		}
		return data;
	};

	return dialogBox;
};

MarkedLists.prototype.drawAddListDialog = function () {
	var self = this;

	var dialogBox = document.createElement('div');
	dialogBox.title = 'Neue Liste erstellen';


	var status = $(document.createElement('p')).appendTo(dialogBox);

	var dbox = self.drawMarkedListSettings({
		name:'',
		owner: getUserName(),
		read_only: false,
		user_roles: null,
		deleteable: true
	},self.data.user_roles);

	$(dialogBox).append(dbox);


	var buttons = {
		OK: function () {

			var data = dbox.getValues();

			var name = data.name;
			if (name.length < 3) {
				status.text('Der Name ist zu kurz');
				return;
			}
			if (!name.match(/[a-z0-9]/i)) {
				status.text('Der Name enthält keine sichbaren Zeichen');
				return;
			}

			status.addClass('loading');

			$.ajax({
				url: '/api/SaveMarkedList',
				type: 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify({name: name})
			}).success(function (data) {
				status.removeClass('loading');

				self.load();

				$(dialogBox).dialog("close");

			}).fail(function () {
				status.removeClass('loading');
				status.text('Laden der Daten ist fehlgeschlagen.');
			});

		},
		Cancel: function () {
			$(this).dialog("close");
		}
	};

	$(dialogBox).dialog({
		width: 400,
		modal: true,
		buttons: buttons
	});


};

