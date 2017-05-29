// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function CourseSemesterDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.courseStg = parentDOM.attr('data-stg');
	this.courseSem = parentDOM.attr('data-sem');
	this.courseInfo = null;

	this.fieldData = {};
	defineFD(this.fieldData, 'students.count', 'Anzahl Studenten', '', 'int');
	defineFD(this.fieldData, 'students.failed', 'Anzahl Studenten', '', 'int');
	defineFD(this.fieldData, 'students.count', 'Anzahl Studenten', '', 'int');
	defineFD(this.fieldData, 'students.successful', 'Anzahl Studenten', '', 'int');
	defineFD(this.fieldData, 'students.success_perc', 'Anteil', '', 'percent');
	defineFD(this.fieldData, 'students.failed', 'Anzahl Studenten', '', 'int');
	defineFD(this.fieldData, 'students.failed_perc', 'Anteil', '', 'percent');
	defineFD(this.fieldData, 'students.female_perc', 'Anteil', '', 'percent');
	defineFD(this.fieldData, 'students.male_perc', 'Anteil', '', 'percent');
	defineFD(this.fieldData, 'exams.success_perc', 'Anteil', '', 'percent');
	defineFD(this.fieldData, 'exams.failed_perc', 'Anteil', '', 'percent');
	defineFD(this.fieldData, 'age_data.mean', 'Durchschnittsalter', '', 'float');
	defineFD(this.fieldData, 'hzb_grade_data.mean', 'Durchschnittliche HZB Note', '', 'grade');
	defineFD(this.fieldData, 'hzb_grade_data.min', 'Beste HZB Note', '', 'grade');
	defineFD(this.fieldData, 'hzb_grade_data.max', 'Schlechteste HZB Note', '', 'grade');

	this.data = null; // Last loaded data
	this.dataSem = null;
	this.metadata = null;

	this.coursedetails = null;

	CourseSemesterDetails.prototype.init.call(this);
}
/**
 * Gets called once this CourseSemesterDetails is initialized
 */
CourseSemesterDetails.prototype.init = function () {
	// Check for global context and filters
	var self = this;
	this.coursedetails = new CourseDetails(this.parentDOM);

	self.load();

};

CourseSemesterDetails.prototype.draw = function () {
	var self = this;
	if (!self.courseSem) {
		self.parentDOM.text('Eine Kohorte ' + self.courseStg + '  ' + self.courseSem + ' existiert nicht.');
		return;
	}

	self.parentDOM.find('[data-detail]').each(function () {
		var el = $(this);
		var field = el.attr('data-detail');
		self.drawValue(field, el);
	});

};


CourseSemesterDetails.prototype.drawValue = function (field, el) {
	var self = this;
	var fieldInfo = this.fieldData[field];

	if (field == 'semester_data') {
		self.drawSemesterDataTable(el);

	} else if (field == 'exam_perc_resigned' && self.data && self.data.hide_resigned) {
		el.remove();

	} else if (field == 'hide_resigned') {
		if (self.data && self.data.hide_resigned)
			el.remove();

	} else if (field == 'semester') {
		el.empty();
		el.append(getFormattedHTML(self.courseSem, 'semester'));

	} else {
		var value = getByPath(field, self.dataSem);
		el.empty();
		if (fieldInfo) {
			el.append(getFormattedHTML(value, fieldInfo.formatting));
		} else {
			el.append(getFormattedHTML(value, 'str'));
		}

	}

};

CourseSemesterDetails.prototype.drawSemesterDataTable = function (el) {
	var self = this;

	function addCol(tr, value, format) {
		var td = tr.appendChild(document.createElement('td'));
		td.appendChild(getFormattedHTML(value, format));
	}

	var pos;
	var columns = (el.attr('data-columns') || '').split(',').map(function (v) {
		return v.trim();
	});
	if (this.data && this.data.hide_resigned) {
		if ((pos = columns.indexOf('exam_perc_resigned:percent')) != -1)
			columns.splice(pos, 1);
		if ((pos = columns.indexOf('exam_count_resigned:int')) != -1)
			columns.splice(pos, 1);
	}
	console.log('columns', columns);

	var semesters = Object.keys(this.dataSem.semester_data);

	for (var i = 0; i < semesters.length; i++) {
		var semNr = 'sem_' + (i + 1);
		var d = this.dataSem.semester_data[semNr];

		var tr = document.createElement('tr');
		for (var j = 0; j < columns.length; j++) {
			var col = columns[j].split(':');
			var format = col[1].trim();
			col = col[0].trim();
			if (col == 'semester') {
				addCol(tr, (i + 1), format);
			} else {
				addCol(tr, getByPath(col, d), format);
			}
		}

		el.append(tr);

	}

	adjustTableHeaders(el.parents('table'));

};

CourseSemesterDetails.prototype.load = function () {
	var self = this;
	var url = '/api/GetCourseSemesterInfos';

	var params = [];
	params.push('ident=' + self.courseStg + '_' + self.courseSem);

	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.parentDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.parentDOM.removeClass('loading');

		self.data = data;
		self.dataSem = data.list[0];
		console.log('dataSem', self.dataSem);

		self.draw();

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	});

};


