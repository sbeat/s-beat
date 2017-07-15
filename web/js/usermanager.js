// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function UserManager(parentDOM) {
	this.parentDOM = parentDOM;

	this.type = parentDOM.attr('data-type'); // students, exams

	this.usersDOM = $(document.createElement('div'));
	this.rightsDOM = $(document.createElement('table'));
	this.addDOM = $(document.createElement('div'));

	this.data = null; // Last loaded data

	this.drawn = false;

	this.rightsDesc = {
		'admin_access': 'Kann den Bereich "Administration" verwenden',
		'personal_data': 'Kann persönliche Daten der Studenten sehen',
		'identification_data': 'Kann identifizierende Daten der Studenten sehen',
		'applicant_data': 'Kann Bewerberdaten sehen'/*,
		'courses_access': 'Kann den Bereich "Studiengänge" verwenden',
		'students_access': 'Kann den Bereich "Studenten" verwenden',
		'exams_access': 'Kann den Bereich "Prüfungsleistungen" verwenden'*/
	};

	UserManager.prototype.init.call(this);
}
/**
 * Gets called once this UserManager is initialized
 */
UserManager.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};
/**
 * Gets called every time the UserManager must be drawn completely
 */
UserManager.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.usersDOM.addClass('userlist');
		this.parentDOM.append(this.usersDOM);

		this.addDOM.addClass('adduser');
		this.parentDOM.append(this.addDOM);

		var btn = $(document.createElement('a'));
		btn.attr('href', '');
		btn.text('Benutzer hinzufügen');
		btn.addClass('button');
		btn.click(function (e) {
			e.preventDefault();
			var uname = prompt('Nutzername:');
			if (uname) {
				self.drawUserDialog(uname, {'role': null, 'stg_list': null});
			}

		});
		this.addDOM.append(btn);


		var logbtn = $(document.createElement('a'));
		logbtn.attr('href', '');
		logbtn.text('Benutzer Log anzeigen');
		logbtn.click(function (e) {
			e.preventDefault();
			self.drawUserLogDialog();

		});
		this.parentDOM.append(logbtn);

		$('<h2 />').text('Benutzerrechte').appendTo(this.parentDOM);
		this.rightsDOM.addClass('tbl spaced');
		this.parentDOM.append(this.rightsDOM);

		this.drawn = true;
	}


	if (!this.data || !this.data['users']) {
		this.usersDOM.text('Keine Daten verfügbar');
		return;
	}

	var list = [];
	var username;
	for (username in this.data['users']) {
		list.push(username);
	}
	list.sort();

	this.usersDOM.empty();
	for (var i = 0; i < list.length; i++) {
		var username = list[i];
		this.usersDOM.append(self.drawUser(username, this.data['users'][username]));
	}

	this.drawRightsTable();

};
UserManager.prototype.drawRightsTable = function () {
	this.rightsDOM.empty();
	if(!this.data) return;

	var thead = $('<thead />').appendTo(this.rightsDOM);
	var tr = $('<tr />').appendTo(thead);
	var td = $('<th />').appendTo(tr);

	var i, role;
	var roles = Object.keys(this.data['roles']);
	roles.sort();
	for (i = 0; i < roles.length; i++) {
		role = roles[i];
		td = $('<th />').text(role).appendTo(tr);
	}

	var tbody = $('<thead />').appendTo(this.rightsDOM);
	for (var j = 0; j < this.data['rights'].length; j++) {
		var right = this.data['rights'][j];
		tr = $('<tr />').appendTo(tbody);
		td = $('<td />').appendTo(tr);
		//$('<b/>').text(right).appendTo(td);
		$('<div/>').text(this.rightsDesc[right]||right).appendTo(td);

		for (i = 0; i < roles.length; i++) {
			role = roles[i];
			var role_rights = this.data['roles'][role];
			td = $('<td />').appendTo(tr);
			$('<span/>').addClass(role_rights.indexOf(right)!=-1?'tickicon':'crossicon').appendTo(td);
		}
	}



};
UserManager.prototype.drawUser = function (name, info) {
	var self = this;
	var userO = document.createElement('div');
	userO.className = 'useritem';
	userO.infoData = info;


	var nameO = userO.appendChild(document.createElement('div'));
	nameO.className = 'name';

	var roleO = userO.appendChild(document.createElement('div'));
	roleO.className = 'role';

	var stglistO = userO.appendChild(document.createElement('div'));
	stglistO.className = 'stglist';

	$(nameO).text(name);
	$(roleO).text(info['role']);
	$(stglistO).text('Studiengangsgruppen: ' + (info['stg_list'] ? info['stg_list'].join(', ') : 'Alle'));

	if(getUserName()!=name) {
		var optO = nameO.appendChild(document.createElement('div'));
		optO.className = 'opt';
		$(optO).click(function (e) {
			self.drawUserDialog(name, info);
		});
	}

	return userO;
};

UserManager.prototype.drawUserDialog = function (name, info) {
	var self = this;
	var dialog = $(document.createElement('div'));

	var roleBox = document.createElement('p');
	dialog.append(roleBox);

	var label, p;
	p = document.createElement('p');
	p.className = 'optionset';
	dialog.append(p);
	label = document.createElement('label');
	p.appendChild(label);
	label.appendChild(document.createTextNode('Rolle'));
	var roles = {};
	for (var role in self.data['roles']) {
		roles[role] = role;
	}

	var roleSelect = drawSelect(roles, info['role']);
	p.appendChild(roleSelect);


	function drawRow(stg) {

		var boxO = document.createElement('li');
		boxO.className = 'colrow';
		boxO.stg = stg;

		var checkO = boxO.appendChild(document.createElement('input'));
		checkO.className = 'name';
		checkO.type = 'checkbox';
		checkO.stg = stg;

		//courses are per default not checked that in case of a study dean, it is not necessary to uncheck all ohter courses with no permissions
		checkO.checked = info['stg_list'] != null && info['stg_list'].indexOf(stg) != -1;

		boxO.appendChild(document.createTextNode(stg));

		return boxO;
	}

	p = document.createElement('div');
	dialog.append(p);
	label = document.createElement('label');
	p.appendChild(label);
	label.appendChild(document.createTextNode('Studiengangsgruppen'));


	var ul = $(document.createElement('ul'));
	ul.addClass('columnlist mh');
	var i, col;
	for (i = 0; i < self.data['stg_list'].length; i++) {
		ul.append(drawRow(self.data['stg_list'][i]));
	}
	$(p).append(ul);


	var buttons = {};
	buttons['Speichern'] = function () {
		var count = 0;
		var stg_list = [];
		ul.find('input').each(function () {
			count++;
			if (this.checked && this.stg) {
				stg_list.push(this.stg);
			}
		});

		var role = roleSelect.value;

		var data = {'user': name, 'role': role, 'stg_list': stg_list};
		if (stg_list.length == count || stg_list.length == 0) {
			data.stg_list = null;
		}

		self.saveUser(data);

		$(this).dialog("close");
	};
	buttons['Abbrechen'] = function () {
		$(this).dialog("close");
	};
	if (info['role']) {
		buttons['Löschen'] = function () {
			if(getUserName()==name) {
				alert('Sie können sich selbst nicht löschen.');
				return;
			}

			if (confirm('Möchten Sie den Benutzer ' + name + ' wirklich löschen?')) {
				info['remove'] = true;
				self.saveUser({'user': name, 'role': null});
			}
			$(this).dialog("close");
		};
	}

	dialog.dialog({
		title: name + ' Einstellungen',
		width: 400,
		modal: true,
		buttons: buttons
	})

};

UserManager.prototype.saveUser = function (data) {
	var self = this;

	self.usersDOM.addClass('loading');

	var url = '/api/SaveUser';
	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify(data)
	}).success(function (data) {
		self.usersDOM.removeClass('loading');

		self.load();

	}).fail(function () {
		self.usersDOM.removeClass('loading');
		self.usersDOM.text('Speichern der Daten ist fehlgeschlagen.');
	});


};

UserManager.prototype.load = function () {
	var self = this;
	var url = '/api/GetUsers';

	var params = [];

	if (params.length) url += '?';
	url += params.join('&');

	self.usersDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.usersDOM.removeClass('loading');

		self.data = data;

		self.draw();

	}).fail(function () {
		self.usersDOM.removeClass('loading');
		self.usersDOM.text('Laden der Daten ist fehlgeschlagen.');
	});

};



UserManager.prototype.drawUserLogDialog = function (name) {
	var self = this;
	var dialog = $(document.createElement('div'));
	var main = $(document.createElement('div')).appendTo(dialog);
	new UserLogList(main);


	dialog.dialog({
		title: 'Benutzer Log',
		width: 600,
		modal: true
	})

};



function UserLogList(parentDOM) {
	this.parentDOM = parentDOM;

	this.settingId = this.parentDOM.attr('data-preset')||'default';
	this.settings = {
		'default': {
			limit: 20,
			sort1: 'date,-1',
			filters: [],
			columns: ['date', 'user', 'action', 'info'],
			displayFilters: true,
			displayPagination: true,
			sortable: true
		}
	};

	this.user = parseInt(parentDOM.attr('data-user'));

	this.displayFilters = true;
	this.displayPagination = true;
	this.sortable = true;

	this.paginationDOM = $(document.createElement('div'));
	this.pagination2DOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.limit = 20;
	this.pagination.start = 0;
	this.pagination.secondaryDOM = this.pagination2DOM;

	this.pagination.sort1 = 'date,-1';
	this.pagination.sort2 = null;
	this.pagination.sortOptions = {};

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);

	this.columnData = {
		'ident': {id: 'ident', label: 'Ident', title: 'Ident des Logeintrags', formatting: 'str'},
		'date': {id: 'date', label: 'Datum', title: 'Datum', formatting: 'datetime'},
		'action': {id: 'action', label: 'Aktion', title: 'Aktionscode', formatting: 'str'},
		'user': {id: 'user', label: 'Benutzer', title: 'Benutzer', formatting: 'str'},
		'info': {id: 'info', label: 'Info', title: 'Weitere Informationen', formatting: 'str', noSort:true}
	};
	this.columns = ['date', 'user', 'action', 'info'];
	this.mandatoryColumns = [];

	this.tableDOM = $(document.createElement('table'));

	this.data = null; // Last loaded data
	this.metadata = null;

	this.drawn = false;

	this.openColumnDialog = openColumnDialog;

	UserLogList.prototype.init.call(this);
}
/**
 * Gets called once this UserLogList is initialized
 */
UserLogList.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	for (var colId in this.columnData) {
		var col = this.columnData[colId];
		if(colId!='info' && colId!='ident') {
			this.filter.addAttributeFilter(col.id, col.label, 'Log', col.formatting, col.formatting == 'int' ? 0 : '');
		}

		if (col.sortBy || col.noSort) continue;
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

	this.filter.filterChanged = function () {
		self.pagination.setStart(0);
		self.load();
	};


	self.load();

};
UserLogList.prototype.loadPresetSettings = function (id) {
	var settings = this.settings[this.settingId]||this.settings['default'];
	if(typeof(settings.limit)!='undefined')
		this.pagination.limit = settings.limit;

	if(typeof(settings.sort1)!='undefined')
		this.pagination.sort1 = settings.sort1;

	if(typeof(settings.sort2)!='undefined')
		this.pagination.sort2 = settings.sort2;

	if(typeof(settings.columns)!='undefined')
		this.filter.filters = settings.filters;

	if(typeof(settings.columns)!='undefined')
		this.columns = settings.columns;

	if(typeof(settings.displayFilters)!='undefined')
		this.displayFilters = settings.displayFilters;

	if(typeof(settings.sortable)!='undefined')
		this.sortable = settings.displayPagination;

	if(typeof(settings.displayPagination)!='undefined')
		this.displayPagination = settings.displayPagination;

	if(typeof(settings.sortable)!='undefined')
		this.sortable = settings.sortable;

	if(typeof(settings.displayStats)!='undefined')
		this.displayStats = settings.displayStats;

};
UserLogList.prototype.loadSettings = function () {
	var settings = loadStorage('userlog_' + this.settingId);
	this.loadPresetSettings(this.settingId);
	if (!settings) {
		return;
	}
	if (settings.filters) {
		this.filter.filters = settings.filters;
	}
	if (settings.limit) {
		this.pagination.limit = settings.limit;
	}
	if (settings.sort1) {
		this.pagination.sort1 = settings.sort1;
	}
	if (settings.columns) {
		this.columns = settings.columns.slice();
	}

};
UserLogList.prototype.saveSettings = function () {
	var settings = loadStorage('userlog_' + this.settingId, {});
	settings.filters = this.filter.filters;
	settings.limit = this.pagination.limit;
	settings.sort1 = this.pagination.sort1;
	settings.columns = this.columns;

	saveStorage('userlog_' + this.settingId, settings);
};
UserLogList.prototype.removeSettings = function () {
	removeStorage('userlog_' + this.settingId);
};
/**
 * Gets called every time the UserLogList must be drawn completely
 */
UserLogList.prototype.draw = function () {
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

		this.drawn = true;
	}

	if(this.displayFilters) this.filterDOM.show();
	else this.filterDOM.hide();

	if(this.displayPagination) this.paginationDOM.show();
	else this.paginationDOM.hide();

	this.pagination.draw();

	if (!this.data) {
		this.tableDOM.text('Keine Daten verfügbar');
		return;
	}
	if (!this.data.list.length) {
		this.tableDOM.text('Keine Einträge gefunden.');
		return;
	}



	var sBtn = $(document.createElement('a'));
	this.pagination.parentDOM.find('.pageInfo').append(' ').append(sBtn);
	sBtn.attr('href', '');
	sBtn.text('Spaltenauswahl');
	sBtn.click(function (e) {
		e.preventDefault();
		self.openColumnDialog();
	});

	this.tableDOM.empty();

	var thead = $(document.createElement('thead'));
	this.tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		var th = $(document.createElement('th'));
		th[0].colId = col.id;
		tr.append(th);


		var thlabel = $(document.createElement('span'));
		th.append(thlabel);
		thlabel.text(col.label);
		thlabel.attr('title', col.title);
		var extended_tooltip = $('#tooltip_userlog_'+col.id);
		if(extended_tooltip.size()) {
			thlabel.tooltip({content:extended_tooltip.html()});
		} else {
			thlabel.tooltip();
		}


		var sortField = col.sortBy ? col.sortBy : col.id;
		if (self.pagination.sort1 == sortField + ',1') th.addClass('asc');
		if (self.pagination.sort1 == sortField + ',-1') th.addClass('desc');
		if (self.pagination.sort2 == sortField + ',1') th.addClass('asc2');
		if (self.pagination.sort2 == sortField + ',-1') th.addClass('desc2');

	}

	if(self.sortable) {
		thead.find('th').click(function (e) {
			var col = self.columnData[this.colId];
			if(col.noSort) return;
			var sortField = col.sortBy ? col.sortBy : col.id;

			if (self.pagination.sort1 == sortField + ',1') {
				self.pagination.sort1 = sortField + ',-1';
			} else {
				self.pagination.sort1 = sortField + ',1';
			}

			self.load();

		});
	}


	var tbody = $(document.createElement('tbody'));
	this.tableDOM.append(tbody);



	for (i = 0; i < this.data.list.length; i++) {
		var item = this.data.list[i];
		tbody.append(this.drawItem(item));
	}

};
UserLogList.prototype.drawItem = function (item) {

	var tr = $(document.createElement('tr'));

	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columnData[this.columns[i]];
		var td = $(document.createElement('td'));
		tr.append(td);
		this.drawCellValue(item, col, td);
	}

	return tr

};
UserLogList.prototype.drawCellValue = function (item, col, td) {
	var self = this;
	var value = getByPath(col.id, item);


	if (col.id == 'info') {
		if(typeof(value)=='object' && value) {
			td.text(JSON.stringify(value, null, '\t'));
		}

	} else if (col.id == 'date') {
		td.text(getDateTimeText(new Date(value*1000)));

	} else {
		td.append(getFormattedHTML(value, col.formatting));

	}

};

UserLogList.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;
	self.filter.possibleValues = metadata;
};

UserLogList.prototype.load = function () {
	var self = this;
	var url = '/api/GetUserLog';

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
