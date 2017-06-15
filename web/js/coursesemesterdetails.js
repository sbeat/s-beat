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
	defineFD(this.fieldData, 'exam_count.mean', 'Durchschnittliche Leistungen im Semester', '', 'float');

	this.data = null; // Last loaded data
	this.dataSem = null;
	this.metadata = null;

	this.coursedetails = null;

	this.semTable = null;

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

	if (field == 'semester_table') {
		self.createSemesterDataTable(el);

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

CourseSemesterDetails.prototype.createSemesterDataTable = function (el) {
	var self = this;

	this.semTable = new DetailsTable(el, 'coursesemdetailsemesters_');
	this.semTable.defineColumn('semester', 'Semester', null, 'int');
	this.semTable.defineColumn('students.count', 'Anzahl Studenten mit Leistungen', null, 'int');
	this.semTable.defineColumn('exams.count', 'Anzahl Leistungen', null, 'int');
	this.semTable.defineColumn('exams.mean', 'Ø Anzahl Leistungen pro Student', null, 'float');
	this.semTable.defineColumn('exams.successful', 'Bestandene Leistungen', null, 'int');
	this.semTable.defineColumn('exams.failed', 'Nicht Bestandene Leistungen', null, 'int');
	this.semTable.defineColumn('exams.failed_perc', '% Nicht bestandener Leistungen', null, 'percent');
	this.semTable.defineColumn('exams.min', 'Minimale Anzahl Leistungen', null, 'int');
	this.semTable.defineColumn('exams.max', 'Maximale Anzahl Leistungen', null, 'int');
	this.semTable.defineColumn('bonus_data.mean', 'Ø '+CONFIG.cp_label, null, 'float');
	this.semTable.defineColumn('bonus_total_data.mean', 'Ø '+CONFIG.cp_label+' Total', null, 'float');
	this.semTable.defineColumn('bonus_total_data.min', 'Minimale '+CONFIG.cp_label+' Total', null, 'int');
	this.semTable.defineColumn('bonus_total_data.max', 'Maximale '+CONFIG.cp_label+' Total', null, 'int');
	this.semTable.defineColumn('students.failed_perc', '% Studenten mit nicht bestandenen Leistungen', null, 'percent');
	if (self.data && self.data.hide_resigned) {
		this.semTable.defineColumn('exams.resigned', 'Rücktritte', null, 'int');
		this.semTable.defineColumn('exams.resign_perc', 'Rücktritte in %', null, 'percent');
	}
	this.semTable.defineColumn('grade_data.mean', 'Ø Note', null, 'grade');

	this.semTable.settings['default'].columns = [
		'semester', 'students.count', 'exams.count', 'exams.mean', 'bonus_data.mean', 'students.failed_perc',
		'exams.failed_perc', 'grade_data.mean'
	];
	this.semTable.settings['default'].displayPagination = true;
	this.semTable.settings['default'].sort1 = 'semester,1';
	this.semTable.pagination.displayStats = false;
	this.semTable.clientSort = true;

	this.semTable.list = [];

	var semesters = Object.keys(this.dataSem.semester_data);

	for (var i = 0; i < semesters.length; i++) {
		var semNr = 'sem_' + (i + 1);
		var d = this.dataSem.semester_data[semNr];
		d.semester = (i+1);
		this.semTable.list.push(d);
	}

	this.semTable.sortTable();
	this.semTable.init();

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


