// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function ExamDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.examInfoId = parentDOM.attr('data-id');
	this.examInfo = null;

	this.fieldData = {};
	defineFD(this.fieldData, 'bonus', CONFIG.cp_label, CONFIG.cp_label + ' für die Prüfungsleistung', 'int');
	defineFD(this.fieldData, 'count_applied', 'Angemeldet', '', 'int');
	defineFD(this.fieldData, 'count_exams', 'Anzahl', '', 'int');
	defineFD(this.fieldData, 'count_failed', 'Nicht bestanden', '', 'int');
	defineFD(this.fieldData, 'count_successful', 'Bestanden', '', 'int');
	defineFD(this.fieldData, 'count_applied', 'Angemeldet', '', 'int');
	defineFD(this.fieldData, 'count_resigned', 'Rücktritte', '', 'int');
	defineFD(this.fieldData, 'success_perc', '% Bestanden', '', 'percent');
	defineFD(this.fieldData, 'grades.min', 'Beste Note', '', 'grade');
	defineFD(this.fieldData, 'grades.mean', 'Ø Note', '', 'grade');
	defineFD(this.fieldData, 'grades_nb.mean', 'Ø Note inkl. NB, EN', '', 'grade');
	defineFD(this.fieldData, 'resign_perc', '% Rücktritte', '', 'percent');

	this.data = null; // Last loaded data

	ExamDetails.prototype.init.call(this);
}
/**
 * Gets called once this ExamDetails is initialized
 */
ExamDetails.prototype.init = function () {
	// Check for global context and filters
	var self = this;


	self.load();

};

ExamDetails.prototype.draw = function () {
	var self = this;
	if (!self.examInfo) {
		self.parentDOM.text('Eine Prüfungsleistung mit der ID ' + self.examInfoId + ' wurde nicht gefunden.');
		return;
	}

	self.parentDOM.find('[data-exam]').each(function () {
		var el = $(this);
		var field = el.attr('data-exam');
		self.drawValue(field, el);
	});

};

ExamDetails.prototype.drawValue = function (field, el) {
	var self = this;
	var fieldInfo = this.fieldData[field];

	if (field == 'semester_data') {
		self.drawSemesterDataTable(el);

	} else if (field == 'exam_associated') {

		if (self.examInfo.type=='PL' && self.examInfo.pv_id != null){

			//Create table row

			$('<td></td>').text('Dazugehörige PV').appendTo(el);
			var td = $('<td></td>').appendTo(el);

			$('<a></a>')
				.appendTo(td)
				.attr('href','examdetails.html?exam_info_id='+self.examInfo.pv_id)
				.text(self.examInfo.pv_id);


		}
		else if(self.examInfo.type=='PV' && self.examInfo.pl_id != null){

			//Create table row

			$('<td></td>').text('Dazugehörige PL').appendTo(el);
			var td = $('<td></td>').appendTo(el);

			$('<a></a>')
				.appendTo(td)
				.attr('href','examdetails.html?exam_info_id='+self.examInfo.pl_id)
				.text(self.examInfo.pl_id);


		}
		else {
			el.hide();
		}

	} else if (field == 'has_grade_graph') {
		if (self.examInfo.has_grade) {
			el.show();
		} else {
			el.hide();
		}

	} else if (field == 'no_grade_graph') {
		if (self.examInfo.has_grade) {
			el.hide();
		} else {
			el.show();
		}

	} else if (field == 'success_graph') {

		var ig = new InfoGraph(el);
		ig.form = 'distributionTime'
		ig.type = 'label';
		ig.data = {};
		if (!self.examInfo.has_grade) {
			for (var semester_id in self.examInfo.semester_data) {
				ig.data[semester_id] = {'Bestanden': self.examInfo.semester_data[semester_id].successful,
					'Nicht bestanden': self.examInfo.semester_data[semester_id].failed};
			}
			ig.draw();

		}

	} else if (field == 'formlist') {
		var form_data = self.examInfo.form_data;
		var result = [];
		if (form_data) {
			for (var form in form_data) {
				var value = form_data[form].exams;

				result.push(form + " (" + value + ")");
			}
		}
		el.text(result.join(', '));

	} else if (field == 'grades') {
		var ig = new InfoGraph(el);
		ig.form = 'distributionTime';
		ig.type = 'grade';
		ig.data = {};
		if (self.examInfo.grades) {
			for (var semester_id in self.examInfo.semester_data) {
				if (self.examInfo.semester_data[semester_id].grades) {
					ig.data[semester_id] = self.examInfo.semester_data[semester_id].grades.values;
				}
			}

		}
		ig.draw();

	} else if (field == 'grades_nb') {
		var ig = new InfoGraph(el);
		ig.form = 'distributionTime';
		ig.type = 'grade';
		ig.data = {};
		if (self.examInfo.grades_nb) {
			for (var semester_id in self.examInfo.semester_data) {
				if (self.examInfo.semester_data[semester_id].grades_nb) {
					ig.data[semester_id] = self.examInfo.semester_data[semester_id].grades_nb.values;
				}
			}

		}
		ig.draw();

	} else {
		var value = getByPath(field, self.examInfo);
		el.empty();
		if (fieldInfo) {
			el.append(getFormattedHTML(value, fieldInfo.formatting));
		} else {
			el.append(getFormattedHTML(value, 'str'));
		}

	}

}
;

ExamDetails.prototype.findRiskQueries = function () {
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

ExamDetails.prototype.drawSemesterDataTable = function (el) {
	function addCol(tr, value, format, risk_query) {
		var td = tr.appendChild(document.createElement('td'));
		td.appendChild(getFormattedHTML(value, format));
	}

	var columns = (el.attr('data-columns') || '').split(',');

	var semesterIds = Object.keys(this.examInfo['semester_data']);
	semesterIds.sort();

	for (var i = 0; i < semesterIds.length; i++) {
		var semester_id = semesterIds[i];
		var sem = this.examInfo['semester_data'][semester_id];

		var tr = document.createElement('tr');
		for (var j = 0; j < columns.length; j++) {
			var col = columns[j].split(':');
			var format = col[1].trim();
			col = col[0].trim();
			if (col == 'id') {
				addCol(tr, semester_id, format);
			} else if (semester_id == this.data.current && (col == "grades.mean" ||
				col == "success_perc")) {
				addCol(tr, null, format);
			} else {
				addCol(tr, getByPath(col, sem), format);
			}

		}

		el.append(tr);

	}
	//durchschnittliche Note und Besntden in %

	adjustTableHeaders(el.parents('table'));

};

ExamDetails.prototype.load = function () {
	var self = this;
	var url = '/api/GetExamInfos';

	var params = [];
	params.push('exam_info_id=' + this.examInfoId);
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
		if (data.list && data.list.length) {
			self.examInfo = data.list[0];
		}
		self.draw();

		//self.loadPaths()

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};

