// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function CourseDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.courseStg = parentDOM.attr('data-stg');
	this.courseInfo = null;

	this.fieldData = {};
	defineFD(this.fieldData, 'name', 'Name', '', 'str');
	defineFD(this.fieldData, 'count_students', 'Anzahl Studenten', '', 'int');
	defineFD(this.fieldData, 'success_perc', 'Erfolgreich in %', '', 'percent');
	defineFD(this.fieldData, 'exam_perc_resigned', '% Rücktritte', '', 'percent');

	this.data = null; // Last loaded data
	this.dataSem = null;
	this.metadata = null;

	CourseDetails.prototype.init.call(this);
}
/**
 * Gets called once this CourseDetails is initialized
 */
CourseDetails.prototype.init = function () {
	// Check for global context and filters
	var self = this;


	self.load();

};

CourseDetails.prototype.draw = function () {
	var self = this;
	if (!self.courseInfo) {
		self.parentDOM.text('Eine Studiengangsgruppe ' + self.courseStg + ' existiert nicht.');
		return;
	}

	self.parentDOM.find('[data-course]').each(function () {
		var el = $(this);
		var field = el.attr('data-course');
		self.drawValue(field, el);
	});

};


CourseDetails.prototype.drawValue = function (field, el) {
	var self = this;
	var fieldInfo = this.fieldData[field];

	if (field == 'semester_data') {
		self.drawSemesterDataTable(el);

	} else if (field == 'courses_data') {
		self.drawCoursesDataTable(el);

	} else if (field == 'risk_graph') {
		var ig = new InfoGraph(el);
		ig.form = 'distribution';
		ig.type = 'risk';
		ig.data = {};
		if (self.courseInfo.risk_data) {
			var step = CONFIG.coursedetails.graph_step;
			var sum = 0;
			for (var i = 0; i < 100; i += step) {
				var ident = i / 100;
				ig.data[ident] = 0;
				for (var val in self.courseInfo.risk_data.values) {
					var valNum = parseFloat(val);
					if (valNum > i && valNum <= i + step || i == 0 && valNum == 0) {
						ig.data[ident] += self.courseInfo.risk_data.values[val];
						sum += self.courseInfo.risk_data.values[val];
					}
				}
			}
			console.log('sum:', sum);
		}
		ig.draw();

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
	} else if(field == 'exam_perc_resigned' && self.data && self.data.hide_resigned) {
		el.remove();

	} else if (field == 'hide_resigned') {
		if(self.data && self.data.hide_resigned)
			el.remove();

	} else {
		var value = getByPath(field, self.courseInfo);
		el.empty();
		if (fieldInfo) {
			el.append(getFormattedHTML(value, fieldInfo.formatting));
		} else {
			el.append(getFormattedHTML(value, 'str'));
		}

	}

};

CourseDetails.prototype.drawCoursesDataTable = function (el) {
	function addCol(tr, value, format) {
		var td = tr.appendChild(document.createElement('td'));
		td.appendChild(getFormattedHTML(value, format));
	}

	var pos;
	var columns = (el.attr('data-columns') || '').split(',').map(function(v){
		return v.trim();
	});
	if (this.data && this.data.hide_resigned) {
		if ((pos = columns.indexOf('exam_perc_resigned:percent')) != -1)
			columns.splice(pos, 1);
		if ((pos = columns.indexOf('exam_count_resigned:int')) != -1)
			columns.splice(pos, 1);
	}
	console.log('columns',columns);

	for (var i = 0; i < this.data.list.length; i++) {
		var d = this.data.list[i];

		var tr = document.createElement('tr');
		for (var j = 0; j < columns.length; j++) {
			var col = columns[j].split(':');
			var format = col[1].trim();
			col = col[0].trim();
			if (col == 'count_studying') {
				addCol(tr, d['count_students'] - d['count_finished'], format);
			} else {
				addCol(tr, getByPath(col, d), format);
			}
		}

		el.append(tr);

	}

	adjustTableHeaders(el.parents('table'));

};

CourseDetails.prototype.setCourseInfo = function () {
	var self = this;
	if (!self.data || !self.data.list || !self.data.list.length)
		return;

	var e1 = self.data.list[0];
	self.courseInfo = {
		name: e1.name,
		degree_type: e1.degree_type,
		faculty: e1.faculty,
		ignore: e1.ignore,
		short_name: e1.short_name,
		count_failed: 0,
		count_finished: 0,
		count_students: 0,
		count_successful: 0,
		exams: 0,
		exam_count_finish: 0,
		exam_count_success: 0,
		exam_count_failed: 0,
		exam_count_applied: 0,
		exam_count_resigned: 0,
		exam_perc_resigned: 0,
		exams_per_student: 0,
		count_current: 0,
		success_perc: 0,
		risk_data: {values: {}}
	};
	for (var i = 0; i < self.data.list.length; i++) {
		var d = self.data.list[i];
		self.courseInfo.count_failed += d['count_failed'];
		self.courseInfo.count_finished += d['count_finished'];
		self.courseInfo.count_students += d['count_students'];
		self.courseInfo.count_successful += d['count_successful'];
		self.courseInfo.exams += d['exams'];
		self.courseInfo.exam_count_finish += d['exam_count_finish'];
		self.courseInfo.exam_count_success += d['exam_count_success'];
		self.courseInfo.exam_count_failed += d['exam_count_failed'];
		self.courseInfo.exam_count_applied += d['exam_count_applied'];
		self.courseInfo.exam_count_resigned += d['exam_count_resigned'];
		if (d.risk_data && d.risk_data.values) {
			for (var v in d.risk_data.values) {
				if (self.courseInfo.risk_data.values[v]) {
					self.courseInfo.risk_data.values[v] += d.risk_data.values[v];
				} else {
					self.courseInfo.risk_data.values[v] = d.risk_data.values[v];
				}
			}
		}
	}
	if (self.courseInfo.count_finished) {
		self.courseInfo.success_perc = self.courseInfo.count_successful / self.courseInfo.count_finished;
	}
	if (self.courseInfo.exams) {
		self.courseInfo.exam_perc_resigned = self.courseInfo.exam_count_resigned / self.courseInfo.exams;
	}
	if (self.courseInfo.count_students) {
		self.courseInfo.exams_per_student = self.courseInfo.exams / self.courseInfo.count_students;
	}
	self.courseInfo.count_current = self.courseInfo.count_students - self.courseInfo.count_finished;

};
CourseDetails.prototype.initMetadata = function (metadata) {
	var self = this;
	self.metadata = metadata;

};
CourseDetails.prototype.load = function () {
	var self = this;
	var url = '/api/GetCourses';

	var params = [];
	params.push('ignore=false');
	params.push('stg=' + encodeURIComponent(self.courseStg));

	params.push('start=0');
	params.push('limit=100');
	params.push('sort1=_id,1');
	if (!self.metadata) {
		params.push('metadata=true');
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

		self.initMetadata(data.metadata);

		self.setCourseInfo();
		self.draw();

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	});

};


