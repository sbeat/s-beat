// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

/**
 * Applicant analytics table
 * Depends on applicantlist and studentanalytics
 * @constructor
 */
function ApplicantAnalytics(parentDOM) {
	StudentAnalytics.call(this, parentDOM, true);

	this.settingsPrefix = 'aanalytics_';

	this.valueStats = {};

	this.addFilterForData = ApplicantList.prototype.addFilterForData;
	this.loadValuesOfColumn = ApplicantList.prototype.loadValuesOfColumn;

	ApplicantAnalytics.prototype.init.call(this);
}

ApplicantAnalytics.prototype = Object.create(StudentAnalytics.prototype);


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
	this.defineColumn('student', 'Ist Student', 'Anzahl Studenten', 'yesno', true);
	this.defineColumn('hzb_type', 'HZB Gruppe', 'Anzahl Bewerber mit der HZB Gruppe', 'str', true);
	this.defineColumn('hzb_grade', 'HZB Note', null, 'grade', true, ['min', 'max', 'avg']);
	this.defineColumn('start_semester', 'Start Semester', null, 'semester', true);
	this.defineColumn('stg', 'Studiengangsgruppe', null, 'str', true);

	var noFilter = ['count', 'group'];

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

		if(noFilter.indexOf(col.id) === -1) {
			this.addFilterForData(col);
		}

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
