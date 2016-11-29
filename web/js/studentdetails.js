// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function StudentDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.studentId = parseInt(parentDOM.attr('data-id'));
	this.student = null;
	this.course_semester = null;

	this.fieldData = {
		'risk_all.median_scaled': {
			id: 'risk_all.median_scaled',
			label: 'Misserfolg',
			title: 'Misserfolgswahrscheinlichkeit',
			formatting: 'percent'
		},
		'risk_stg.median_scaled': {
			id: 'risk_stg.median_scaled',
			label: 'Misserfolg',
			title: 'Misserfolgswahrscheinlichkeit',
			formatting: 'percent'
		}
	};

	this.data = null; // Last loaded data
	this.pathData = null; // Last loaded path data
	this.markedData = null;
	this.markedListData = null;
	this.definitions = null;

	StudentDetails.prototype.init.call(this);
}
/**
 * Gets called once this StudentDetails is initialized
 */
StudentDetails.prototype.init = function () {
	// Check for global context and filters
	var self = this;


	self.load();

};

StudentDetails.prototype.draw = function () {
	var self = this;
	if (!self.student) {
		self.parentDOM.text('Ein Student mit der ID ' + self.studentId + ' wurde nicht gefunden.');
		return;
	}

	self.parentDOM.find('[data-student]').each(function () {
		var el = $(this);
		var field = el.attr('data-student');
		self.drawValue(field, el);
	});

};

StudentDetails.prototype.drawValue = function (field, el) {
	var self = this;
	var value;
	var query = self.findQuery(field);
	var fieldInfo = this.fieldData[field];
	var role = getUserRole();
	if (self.definitions.restricted.indexOf(field) != -1) {
		el.text('***');
		return;
	}

	if (field == 'semester_data') {
		self.drawSemesterDataTable(el);

	} else if (field == 'lastDate') {
		if (self.definitions.lastDate)
			el.text(getDateText(new Date(self.definitions.lastDate * 1000)));
		else
			el.text('unbekannt');
	} else if (field == 'stg') {

		//Link to courses detail list
		var a = $(document.createElement('a'));
		a.attr('href', 'coursedetails.html?stg=' + self.student.stg);
		a.text(self.student.stg);
		el.append(a);

	} else if (field == 'markedlists') {
		self.drawMarkedListInfo(el);

	} else if (field == 'risk_graph') {
		var ig = new InfoGraph(el);
		ig.form = 'distribution';
		ig.type = 'risk';
		ig.data = {};
		if (self.student.risk) {
			var step = CONFIG.studentdetails.graph_step;
			for (var i = 0; i < 100; i += step) {
				var ident = i / 100;
				ig.data[ident] = 0;
				for (var j = 0; j < self.student.risk.values.length; j++) {
					var val = self.student.risk.values[j] * 100;
					if (val > i && val <= i + step || i == 0 && val == 0) {
						ig.data[ident]++;
					}
				}
			}
		}
		ig.draw();

	} else if (field == 'finishstatus') {
		if (self.student.finished) {
			if (self.student.success) {
				el.text('Erfolgreich');
			} else if (self.student.aborted) {
				el.text('Abgebrochen');
			} else {
				el.text('Abgeschlossen');
			}

		} else {
			el.text('Studiert');
		}

	} else if (field == 'tooltip') {
		var hoverelement = el.find('a').first();
		hoverelement.attr('title', '');
		hoverelement.tooltip({
			content: el.find('div').html(),
			open: function () {
				console.log('open');
			}
		});

	} else if (field == 'hzb_imm_time') {
		value = getByPath(field, self.student);
		el.text(getMonthsText(value) + " nach HZB");

	} else if (field == 'risk.median_scaled' && !self.definitions.risk_value_allowed) {
		el.text('***');
	} else if (field == 'display_risk_all_value') {
		if (!self.definitions.risk_value_allowed || !self.student.risk_all) {
			el.hide();
		}
	} else if (field == 'display_risk_stg_value') {
		if (!self.definitions.risk_value_allowed || !self.student.risk_stg) {
			el.hide();
		}
	} else if (field == 'display_risk_all') {
		if (!self.student.risk_all) {
			el.hide();
		}
	} else if (field == 'display_risk_stg') {
		if (!self.student.risk_stg) {
			el.hide();
		}
	} else if (field == 'risk_all') {
		if (!self.student.risk_all || self.student.risk_all.median === null) {
			el.text('-');
		} else {
			value = self.student.risk_all.median_scaled;
			el.append(drawRiskLights(value, self.definitions.lights));
		}

	} else if (field == 'risk_stg') {
		if (!self.student.risk_stg || self.student.risk_stg.median === null) {
			el.text('-');
		} else {
			value = self.student.risk_stg.median_scaled;
			el.append(drawRiskLights(value, self.definitions.lights));
		}

	} else if (field == 'exam_count_applied') {
		value = getByPath(field, self.student);
		if (self.student.current_semester) {
			el.text(value);
		}
		else {
			el.text('0');
		}
	} else if(field == 'identification_link') {
		el.click(function(e){
			e.preventDefault();
			$('#identification_data').show();
			$(this).hide();
		});

	} else if (field == 'hide_resigned' && self.definitions && self.definitions.hide_resigned) {
		el.remove();

	} else if (field == 'hide_resigned') {
		return;

	} else {
		value = getByPath(field, self.student);
		el.empty();
		if (query) {
			el.append(getFormattedHTML(value, query.formatting));
		} else if (fieldInfo) {
			el.append(getFormattedHTML(value, fieldInfo.formatting));
		} else {
			el.append(getFormattedHTML(value, 'str'));
		}

	}


	if (field == 'hzb_grade') {

		var hzb_value = getByPath(field, self.student);
		console.log(hzb_value);
		if (hzb_value == 990) {
			el.append(" (Es liegt keine HZB Note vor.)");
		}
	}

};

StudentDetails.prototype.findRiskQueries = function () {
	var self = this;
	var ret = {elements: [], in_filter_elements: []};
	for (var peId in self.definitions['path_elements']) {
		if (self.definitions['path_elements'][peId]['condition'].name == 'failed') {
			ret.elements.push(peId);
			break;
		}
	}

	self.parentDOM.find('[data-path-risk]').each(function () {
		var el = $(this);
		var field = el.attr('data-path-risk');
		var queryId = null;
		for (var qId in self.definitions['queries']) {
			if (self.definitions['queries'][qId].q == field) {
				queryId = qId;
				break;
			}
		}
		if (!queryId) return;

		for (var peId in self.definitions['path_elements']) {
			if (self.definitions['path_elements'][peId]['query_id'] == queryId) {
				ret.in_filter_elements.push(peId);
			}
		}

	});

	return ret;
};

StudentDetails.prototype.drawRisks = function () {
	var self = this;

	self.parentDOM.find('[data-path-risk]').each(function () {
		var el = $(this);
		el.empty();
		var field = el.attr('data-path-risk');
		var pd = self.pathData[field];
		//console.log('pd '+field,pd);
		if (pd && pd.length) {
			var valuesum = 0;
			for (var i = 0; i < pd.length; i++) {
				var pe = pd[i];
				valuesum += pe.value;
			}
			var avgvalue = valuesum / pd.length;

			var succscale = $(document.createElement('div'));
			succscale.addClass('succscale');
			succscale.addClass('p' + Math.floor(avgvalue * 10) * 10);
			succscale.attr('title', 'Erfolgswahrscheinlichkeit ' + getNumericValueOutput(avgvalue, 'percent') + '%');
			succscale.tooltip();
			el.append(succscale);
		}


	});

};

StudentDetails.prototype.drawSemesterDataTable = function (el) {
	var self = this;
	function addCol(tr, value, format, cmpInfo) {
		var td = tr.appendChild(document.createElement('td'));
		td.appendChild(getFormattedHTML(value, format));

		if (cmpInfo && self.definitions.compare_averages) {
			td.className = 'darr';
			if (typeof(value) == 'number' && value < cmpInfo.cmpValue) {
				td.className = 'darr ' + (cmpInfo.lowerBetter ? 'downgreen' : 'downred');
			} else if (typeof(value) == 'number' && value > cmpInfo.cmpValue) {
				td.className = 'darr ' + (cmpInfo.lowerBetter ? 'upred' : 'upgreen');
			}
			td.title = 'Ø '+ getNumericValueOutput(cmpInfo.cmpValue, format);
			$(td).tooltip();
		}

		return td;
	}



	for (var sem_nr = 1; this.student['semester_data']['sem_' + sem_nr]; sem_nr++) {
		var sem = this.student['semester_data']['sem_' + sem_nr];
		var courseInfo = this.course_semester['semester_data']['sem_' + sem_nr];

		var average_success = courseInfo['exams']['successful']/courseInfo['students']['count'];
		var average_failed = courseInfo['exams']['failed'] / courseInfo['students']['count'];
		var average_delayed = courseInfo['exams']['delayed'] / courseInfo['students']['count'];

		var tr = document.createElement('tr');
		addCol(tr, sem_nr, 'int');
		addCol(tr, sem['semester_id'], 'semester');
		addCol(tr, sem['bonus'], 'int', {cmpValue: courseInfo['bonus_data']['mean']});
		addCol(tr, sem['bonus_total'], 'int', {cmpValue: courseInfo['bonus_total_data']['mean']});
		addCol(tr, sem['grade'], 'grade', {cmpValue: courseInfo['grade_data']['mean'], lowerBetter:true});
		addCol(tr, sem['count'], 'int', {cmpValue: courseInfo['exams']['mean']});
		addCol(tr, sem['successful'], 'int', {cmpValue: average_success});
		addCol(tr, sem['failed'], 'int', {cmpValue: average_failed, lowerBetter: true});

		if(!self.definitions || !self.definitions.hide_resigned)
			addCol(tr, sem['delayed'], 'int', {cmpValue: average_delayed, lowerBetter: true});

		el.append(tr);
	}

};


StudentDetails.prototype.drawMarkedListInfo = function (el) {
	var self = this;
	if (!self.markedListData) {
		self.loadMarkedLists(el);
		return;
	}

	el.empty();

	var addbtn = $(document.createElement('a'))
		.addClass('modbtn')
		.attr('href', '')
		.text('Vormerkungen bearbeiten')
		.click(function (e) {
			e.preventDefault();
			self.drawMarkedListDialog(el);
		})
		.appendTo(el);

	for (var i = 0; i < self.markedListData.list.length; i++) {
		var d = self.markedListData.list[i];

		var item = $(document.createElement('a')).addClass('item').appendTo(el);
		item.attr('href', 'markedlist.html?mlist=' + d.ident);
		item.text(d.name);
		if (typeof(d.comments[self.studentId]) != 'undefined') {
			item.attr('title', d.comments[self.studentId].text);
		}
		item.tooltip();

	}


};


StudentDetails.prototype.drawMarkedListDialog = function (baseElement) {
	var self = this;

	var dialog = $(document.createElement('div'));
	dialog.addClass('markinfo');
	dialog.attr('title', 'Vormerkungen bearbeiten');


	var status = $(document.createElement('p')).text('Lade Vormerkungslisten ...').appendTo(dialog);
	status.addClass('loading');

	var addform = $(document.createElement('div')).addClass('markedadd').appendTo(dialog);
	$(document.createElement('span')).text('Student/in hinzufügen zur Liste: ').appendTo(addform);
	var select = $(document.createElement('select')).hide().appendTo(addform);

	select.change(function () {
		var ident = select.val();
		for (var i = 0; i < mlists.data.list.length; i++) {
			var d = mlists.data.list[i];
			if (d.ident == ident) {
				d.list.push(self.studentId);
				setChanges(d.ident, 'add_idents', self.studentId);
				drawList(mlists.data.list);
			}
		}

	});

	$(document.createElement('a'))
		.text('Neue Vormerkungsliste anlegen')
		.attr('href', '')
		.appendTo(addform)
		.click(function (e) {
			e.preventDefault();

			mlists.drawAddListDialog();

		});

	var box = $(document.createElement('div')).addClass('markedlist').appendTo(dialog);

	status.addClass('loading');
	var mlists = new MarkedLists($(document.createElement('div')));
	mlists.draw = function () {
		status.removeClass('loading');
		status.text('');

		drawList(mlists.data.list);
	};
	$.ajax({
		url: '/api/GetMarkedList?limit=1000'
	}).success(function (data) {
		status.removeClass('loading');
		status.text('');

		drawList(data.list);


	}).fail(function () {
		status.removeClass('loading');
		status.text('Laden der Daten ist fehlgeschlagen.');
	});

	var changes = {};

	function setChanges(ident, type, value) {
		if (!changes[ident]) changes[ident] = {};
		changes[ident][type] = value;
		if (type == 'add_idents' && changes[ident]['remove_idents']) {
			delete changes[ident]['remove_idents'];
		}
		if (type == 'remove_idents' && changes[ident]['add_idents']) {
			delete changes[ident]['add_idents'];
		}
	}

	function drawList(list) {
		select.empty();
		$(document.createElement('option')).text('- Auswählen -').val('').appendTo(select);

		box.empty();

		list.sort(function (a, b) {
			var isin_a = a.list.indexOf(self.studentId) != -1;
			var isin_b = b.list.indexOf(self.studentId) != -1;

			if (isin_a && !isin_b) return -1;
			if (!isin_a && isin_b) return 1;
			if (a.name < b.name) return -1;
			if (a.name > b.name) return 1;
			return 0;
		});

		for (var i = 0; i < list.length; i++) {
			var entry = list[i];
			box.append(drawListEntry(entry));
		}

		if (select.find('option').size() == 1) {
			select.hide();
		} else {
			select.show();
		}
	}

	function drawListEntry(d) {
		var entry = $(document.createElement('div')).addClass('entry');

		var name = $(document.createElement('div')).addClass('name').appendTo(entry);
		name.text(d.name);

		if (d['is_writable']) {
			var btn = $(document.createElement('a')).addClass('btn').appendTo(entry);
			btn.attr('href', '');
		}

		if (d.list.indexOf(self.studentId) != -1) {
			if (d['is_writable']) {
				btn.addClass('isin');
				btn.text('Entfernen');
			}
			var comment = $(document.createElement('textarea')).addClass('commentbox').appendTo(entry);
			if (!d['is_writable']) {
				comment.attr('readonly', true);
			}
			if (d.comments[self.studentId]) {
				var ci = d.comments[self.studentId];
				comment.val(ci.text);
				var info = $(document.createElement('div')).addClass('markedinfo').appendTo(entry);
				if (ci && ci.date && ci.by) {
					info.text('Von ' + ci.by + ' am ' + getDateTimeText(new Date(parseInt(ci.date * 1000))));
				}
			}
			comment.change(function () {
				if (d.comments[self.studentId]) {
					d.comments[self.studentId].text = comment.val();
				} else {
					d.comments[self.studentId] = {text: comment.val()};
				}
				setChanges(d.ident, 'comments', d.comments[self.studentId].text);
			});

		} else if (d['is_writable']) {
			btn.addClass('notin');
			btn.text('Hinzufügen');
			$(document.createElement('option')).text(d.name).val(d.ident).appendTo(select);
			return null;
		}

		if (d['is_writable']) {
			btn.click(function (e) {
				e.preventDefault();

				var p = d.list.indexOf(self.studentId);
				if (p != -1) {
					d.list.splice(p, 1);
					setChanges(d.ident, 'remove_idents', self.studentId);
				} else {
					d.list.push(self.studentId);
					setChanges(d.ident, 'add_idents', self.studentId);
				}

				drawList(mlists.data.list);

			});
		}


		return entry;
	}

	var buttons = {};
	buttons['Speichern'] = function () {

		var list_idents = Object.keys(changes);
		var index = 0;
		if (list_idents.length) {
			saveNextList();
		} else {
			dialog.dialog("close");
		}

		function saveNextList() {
			if (index == list_idents.length) {
				self.loadMarkedLists(baseElement);
				dialog.dialog("close");
				return;
			}
			var list_ident = list_idents[index++];
			status.addClass('loading');
			status.text('Speichere Vormerkungen ...');

			var data = {};
			if (typeof(changes[list_ident]['comments']) != 'undefined') {
				data['comments'] = {};
				data['comments'][self.studentId] = changes[list_ident]['comments'];
			}
			if (typeof(changes[list_ident]['add_idents']) != 'undefined') {
				data['add_idents'] = [self.studentId];
			}
			if (typeof(changes[list_ident]['remove_idents']) != 'undefined') {
				data['remove_idents'] = [self.studentId];
			}

			$.ajax({
				url: '/api/SaveMarkedList?ident=' + list_ident,
				type: 'POST',
				contentType: 'application/json; charset=utf-8',
				data: JSON.stringify(data)
			}).success(function (data) {
				status.removeClass('loading');

				saveNextList();

			}).fail(function () {
				status.removeClass('loading');
				status.text('Speichern der Daten ist fehlgeschlagen.');
			});

		}

	};

	buttons['Abbrechen'] = function () {

		$(this).dialog("close");
	};


	dialog.dialog({
		width: 400,
		maxHeight: 500,
		modal: true,
		buttons: buttons
	});


};

StudentDetails.prototype.initDefinitions = function (definitions) {
	var self = this;
	self.definitions = definitions;
	$("[data-lights=lights_0]").text(self.definitions.lights[0] * 100);
	$("[data-lights=lights_1]").text(self.definitions.lights[1] * 100);
	$("[data-lights=lights_2]").text(self.definitions.lights[2] * 100);

};
StudentDetails.prototype.findQuery = function (q) {
	for (var qId in this.definitions['queries']) {
		var query = this.definitions['queries'][qId];
		if (query.q == q) return query;
	}
	return null;
};

StudentDetails.prototype.load = function () {
	var self = this;
	var url = '/api/GetStudentInfo';

	var params = [];
	params.push('ident=' + this.studentId);
	params.push('course_semester=true');
	if (!self.definitions) {
		params.push('definitions=true');
	}

	if(isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.parentDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.parentDOM.removeClass('loading');

		self.data = data;
		if (data.definitions) {
			self.initDefinitions(data.definitions);
		}
		if(data.course_semester) {
			self.course_semester = data.course_semester;
		}
		if (data.student) {
			self.student = data.student;
		}
		self.draw();

		//self.loadPaths()

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};


StudentDetails.prototype.loadMarkedLists = function (el) {
	var self = this;
	var url = '/api/GetMarkedList?list=' + this.studentId;

	el.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		el.removeClass('loading');

		self.markedListData = data;

		self.drawMarkedListInfo(el);

	}).fail(function () {
		el.removeClass('loading');
		el.text('Laden der Daten ist fehlgeschlagen.');
	})

};

StudentDetails.prototype.loadPaths = function () {
	var self = this;
	var url = '/api/GetPaths';

	var params = [];
	params.push('student_id=' + this.studentId);
	params.push('limit=1000');
	var filterQueries = this.findRiskQueries();
	for (var name in filterQueries) {
		params.push(name + '=' + encodeURIComponent(filterQueries[name]));
	}

	if(isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	//self.parentDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		//self.parentDOM.removeClass('loading');

		self.pathData = {};

		if (data.list && data.list.length) {
			// self.definitions.queries[qid]
			for (var i = 0; i < data.list.length; i++) {
				var path = data.list[i];

				var pe_succ = self.definitions.path_elements[path.elements[0]];
				var name_succ = pe_succ.condition.name;

				var pe = self.definitions.path_elements[path.filter_elements[0]];
				var query = self.definitions.queries[pe.query_id];

				if (!self.pathData[query.q]) self.pathData[query.q] = [];
				self.pathData[query.q].push(path);

			}
			//console.log('pathData',self.pathData);

		}
		self.drawRisks();

	}).fail(function () {
		//self.parentDOM.removeClass('loading');
		//self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};
