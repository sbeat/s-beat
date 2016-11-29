// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function PathList(parentDOM) {
	this.parentDOM = parentDOM;

	this.studentId = parseInt(parentDOM.attr('data-id'));
	this.settingId = this.studentId ? 'student' : 'default';
	this.settingsPrefix = 'pathlist_';
	this.settingsRev = 1; // changing this forces a reset of settings for all users
	this.paginationDOM = $(document.createElement('div'));
	this.pagination2DOM = $(document.createElement('div'));
	this.pagination = new Pagination(this.paginationDOM);
	this.pagination.limit = 20;
	this.pagination.secondaryDOM = this.pagination2DOM;

	this.displayMode = 'listpaths'; // listpaths, listelements

	this.pagination.sort1 = 'value,-1';
	this.pagination.sortOptions = {
		'value,1': 'Wahrscheinlichkeit aufsteigend',
		'value,-1': 'Wahrscheinlichkeit absteigend',
		//'weighted_value,1':'Gewichtete Wahrscheinlichkeit aufsteigend',
		//'weighted_value,-1':'Gewichtete Wahrscheinlichkeit absteigend',
		'count,1': 'Studenten in Pfad aufsteigend',
		'count,-1': 'Studenten in Pfad absteigend',
		'matched,1': 'Passende Studenten in Pfad aufsteigend',
		'matched,-1': 'Passende Studenten in Pfad absteigend',
		'support,1': 'Support aufsteigend',
		'support,-1': 'Support absteigend'
	};

	this.filterDOM = $(document.createElement('div'));
	this.filter = new FilterList(this.filterDOM);
	this.filter.addAttributeFilter('matched', 'Anzahl passend', 'Path', 'int', 0);
	this.filter.addAttributeFilter('count', 'Anzahl im Filter', 'Path', 'int', 0);
	this.filter.addAttributeFilter('value', 'Wahrscheinlichkeit', 'Path', 'percent', 0.0);
	this.filter.addAttributeFilter('support', 'Support', 'Path', 'percent', 0.0);
	this.filter.addAttributeFilter('filter_dim', 'Filter Dimension', 'Path', 'int', 0);
	this.filter.addAttributeFilter('group', 'Gruppe', 'Path', 'str', 'all');


	this.pathsContainer = $(document.createElement('div'));
	this.elementsContainer = $(document.createElement('div'));

	this.elementsConfig = {
		columnData: {
			'condition': {id: 'condition', label: 'Bedingung', title: 'Bedingung', formatting: 'str', sortBy: null},
			'count': {id: 'count', label: 'Anzahl Pfade', title: 'Anzahl der Pfade', formatting: 'int'},
			'value_mean': {
				id: 'value_mean',
				label: 'Ø Konfidenz',
				title: 'Ø Abbruchwahrscheinlichkeit der Pfade',
				formatting: 'percent'
			},
			'support_mean': {
				id: 'support_mean',
				label: 'Ø Support',
				title: 'Ø Support der Pfade',
				formatting: 'percent'
			}
		},
		columns: ['condition', 'count', 'value_mean', 'support_mean'],
		sort1: 'value_mean,-1'
	};

	this.listDOM = $(document.createElement('div'));

	this.data = null; // Last loaded data
	this.definitions = null;

	this.drawn = false;

	this.loadSettings = loadSettings;
	this.saveSettings = saveSettings;
	this.removeSettings = removeSettings;
	this.openSettingsDialog = openSettingsDialog;

	PathList.prototype.init.call(this);
}
/**
 * Gets called once this PathList is initialized
 */
PathList.prototype.init = function () {
	// Check for global context and filters
	var self = this;
	self.loadSettings();

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
 * Gets called every time the PathList must be drawn completely
 */
PathList.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {

		this.parentDOM.empty();
		this.parentDOM.append(this.pathsContainer);
		this.parentDOM.append(this.elementsContainer);

		this.filterDOM.addClass('filterlist');
		this.pathsContainer.append(this.filterDOM);
		this.filter.draw();

		this.paginationDOM.addClass('pagination');
		this.pathsContainer.append(this.paginationDOM);

		this.listDOM.addClass('pathList');
		this.pathsContainer.append(this.listDOM);

		this.pagination2DOM.addClass('pagination');
		this.pathsContainer.append(this.pagination2DOM);

		this.pagination.addLink('Einstellungen', function () {
			self.openSettingsDialog();
		});

		if(this.settingId == 'student') {
			this.pagination.addLink('Pfad Statistik', function () {
				self.displayMode = 'listelements';
				self.draw();
			});
		}


		this.drawn = true;
	}

	if (this.displayMode == 'listpaths') {
		this.pathsContainer.show();
		this.elementsContainer.hide();
		if (!this.data) {
			this.listDOM.text('Keine Daten verfügbar');
			return;
		}


		this.pagination.draw();

		this.listDOM.empty();
		for (var i = 0; i < this.data.list.length; i++) {
			var path = this.data.list[i];
			this.listDOM.append(this.drawPath(path));
		}

		this.listDOM.find('.pe').click(function (e) {
			if (this.filterItem) {
				location.href = 'students.html?preset=pathbased&setFilterByIds=' + this.filterItem.id;
			}
		});
	}
	if (this.displayMode == 'listelements') {
		this.pathsContainer.hide();
		this.elementsContainer.show();

		if (!self.data.element_stats) {
			this.elementsContainer.text('Keine Daten verfügbar');
			return;
		}

		var element_ids = Object.keys(self.data.element_stats);
		var elements = [];
		element_ids.forEach(function (eid) {
			var stats = self.data.element_stats[eid];
			var el = self.definitions.path_elements[eid];
			if (!el || !stats) return;
			var query = self.definitions.queries[el.query_id];
			stats.condition = el.condition;
			stats.query = query;
			elements.push(stats);
		});

		this.drawElementsTable(elements);

	}


};
PathList.prototype.drawElementsTable = function (elements) {
	var self = this;

	var sort1_field = self.elementsConfig.sort1.split(',')[0], sort2_field;
	var sort1_dir = parseInt(self.elementsConfig.sort1.split(',')[1]), sort2_dir;

	if(self.elementsConfig.sort2) {
		sort2_field = self.elementsConfig.sort2.split(',')[0];
		sort2_dir = parseInt(self.elementsConfig.sort2.split(',')[1]);
	}

	elements.sort(function (a, b) {
		if (a[sort1_field] < b[sort1_field]) return sort1_dir * -1;
		if (a[sort1_field] > b[sort1_field]) return sort1_dir;
		if (sort2_field && a[sort2_field] < b[sort2_field]) return sort2_dir * -1;
		if (sort2_field && a[sort2_field] > b[sort2_field]) return sort2_dir;
		return 0;
	});

	this.elementsContainer.empty();
	var switchDisplayButton = $(document.createElement('a')).appendTo(this.elementsContainer);
	switchDisplayButton.attr('href', '');
	switchDisplayButton.text('Pfade anzeigen');
	switchDisplayButton.click(function (e) {
		e.preventDefault();
		self.displayMode = 'listpaths';
		self.draw();
	});


	var tableDOM = $(document.createElement('table')).appendTo(this.elementsContainer).addClass('tbl sortable');

	var thead = $(document.createElement('thead'));
	tableDOM.append(thead);
	var tr = $(document.createElement('tr'));
	thead.append(tr);

	drawTableHead.call(self.elementsConfig, tr, null);


	thead.find('th').click(function (e) {
		var col = self.elementsConfig.columnData[this.colId];
		if(col.sortBy === null) return;
		var sortField = col.sortBy ? col.sortBy : col.id;

		if (self.elementsConfig.sort1 == sortField + ',1') {
			self.elementsConfig.sort1 = sortField + ',-1';
		} else {
			self.elementsConfig.sort1 = sortField + ',1';
		}
		if (self.elementsConfig.sort2 == sortField + ',1' || self.elementsConfig.sort2 == sortField + ',-1') {
			self.elementsConfig.sort2 = null;
		}

		self.drawElementsTable(elements);

	});

	var tbody = $(document.createElement('tbody'));
	tableDOM.append(tbody);

	for (i = 0; i < elements.length; i++) {
		var el = elements[i];
		tbody.append(self.drawElementsEntry(el));
	}

	adjustTableHeaders(tableDOM);

};
PathList.prototype.drawElementsEntry = function (el) {
	var tr = $(document.createElement('tr'));

	var i;
	for (i = 0; i < this.elementsConfig.columns.length; i++) {
		var col = this.elementsConfig.columnData[this.elementsConfig.columns[i]];
		if (!col) continue;
		var td = $(document.createElement('td'));
		tr.append(td);
		var value = getByPath(col.id, el);
		if(col.id=='condition') {
			var s = getConditionText(el.condition, el.query.formatting);
			td.text(el.query.name+' '+s);
		} else {
			td.append(getFormattedHTML(value, col.formatting));
		}
	}

	return tr
};

PathList.prototype.getDependsFromPath = function (path) {
	var i, elId;
	var depends = [];
	for (i = 0; i < path.filter_elements.length; i++) {
		elId = path.filter_elements[i];
		var pe = this.definitions['path_elements'][elId];
		var query = this.definitions['queries'][pe['query_id']];
		if (query.depends && query.depends.length) {
			for (var j = 0; j < query.depends.length; j++) {
				var depElId = query.depends[j];
				if (depends.indexOf(depElId) == -1) {
					depends.push(depElId);
				}
			}
		}
	}
	return depends;
};
PathList.prototype.drawPath = function (path) {

	var pathBox = document.createElement('div');
	pathBox.className = 'path';

	var counters = pathBox.appendChild(document.createElement('div'));
	counters.className = 'counters';

	var filterElements = pathBox.appendChild(document.createElement('div'));
	filterElements.className = 'filter';

	var successElements = pathBox.appendChild(document.createElement('div'));
	successElements.className = 'success';

	var mainC = counters.appendChild(document.createElement('div'));
	mainC.className = 'mainc';
	//mainC.innerHTML = '<b>'+(path.value * 100).toFixed(1) + '%</b> ('+(path.weighted_value*100).toFixed(1)+'%)';
	var value = path.value;
	if (path.scaled_value !== null) {
		value = path.scaled_value;
	}

	mainC.innerHTML = '<b>' + (value * 100).toFixed(1) + '%</b> (' + (path.support * 100).toFixed(1) + '%)';
	mainC.title = 'Konfidenz (Support)';
	$(mainC).tooltip();

	var subC = counters.appendChild(document.createElement('span'));
	var group = path.group == 'all' ? '' : '(' + path.group + ')';
	subC.appendChild(document.createTextNode(path.matched + ' / ' + path.count + ' / ' + path.total_count + ' ' + group));
	subC.title = 'Anzahl passende Studenten für gesamten Pfad ' +
		'/ Anzahl auf Bedingung passende Studenten ' +
		'/ Anzahl aller beachteten Studenten (Gruppenbezeichnung)';
	$(subC).tooltip();


	var i, elId, depends = this.getDependsFromPath(path);
	for (i = 0; i < path.filter_elements.length; i++) {
		elId = path.filter_elements[i];
		filterElements.appendChild(this.drawPathElement(elId, depends))
	}
	for (i = 0; i < path.elements.length; i++) {
		elId = path.elements[i];
		successElements.appendChild(this.drawPathElement(elId, depends))
	}

	return pathBox

};
PathList.prototype.drawPathElement = function (elId, depends) {
	var pe = this.definitions['path_elements'][elId];
	var query = this.definitions['queries'][pe['query_id']];

	var peBox = document.createElement('div');
	peBox.className = 'pe';
	if (depends.indexOf(elId) != -1) {
		peBox.className += " dependee";
	}
	if (query.depends && query.depends.length) {
		peBox.className += " depender";
	}

	var qBox = document.createElement('div');
	peBox.appendChild(qBox);
	qBox.className = 'query';
	qBox.appendChild(document.createTextNode(query.name));

	var cBox = document.createElement('div');
	peBox.appendChild(cBox);
	cBox.className = 'cond';
	var s = getConditionText(pe.condition, query.formatting);
	cBox.appendChild(document.createTextNode(s));
	if (pe.condition.compare_value == false) {
		peBox.className += " false";
	}

	peBox.title = query.name + ' ' + s;
	$(peBox).tooltip();

	peBox.filterItem = {
		id: elId,
		type: 'filterElement',
		query: query,
		condition: pe.condition
	};
	/*$(peBox).draggable({
	 helper:'clone'
	 });*/

	return peBox;
};

PathList.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;
	self.filter.possibleValues = metadata;
};
PathList.prototype.load = function () {
	var self = this;
	var url = '/api/GetPaths';

	self.saveSettings();

	var params = [];
	var filterQueries = this.filter.getQueries(true);
	for (var name in filterQueries) {
		params.push(name + '=' + encodeURIComponent(filterQueries[name]));
	}

	if (self.studentId) {
		params.push('student_id=' + encodeURIComponent(self.studentId));
	}

	params.push('start=' + self.pagination.start);
	params.push('limit=' + self.pagination.limit);
	params.push('sort1=' + self.pagination.sort1);
	if (self.pagination.sort2)
		params.push('sort2=' + self.pagination.sort2);
	if (!self.definitions) {
		params.push('definitions=true');
	}
	if(isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.listDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.listDOM.removeClass('loading');

		self.data = data;
		if (data.definitions) {
			self.definitions = data.definitions;
			if (data.metadata) {
				self.initMetadata(data.metadata);
			}

			for (var peId in self.definitions['path_elements']) {
				var pe = self.definitions['path_elements'][peId];
				var query = self.definitions['queries'][pe['query_id']];
				self.filter.addElementFilter(peId, query, pe.condition);
			}
			self.filter.sortFilters();

		}

		self.pagination.update(data);

		self.draw();

	}).fail(function () {
		self.listDOM.removeClass('loading');
		self.listDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};



