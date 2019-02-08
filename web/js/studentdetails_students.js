// Copyright (c) 2019 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function StudentDetailsStudents(parentDOM) {
	StudentDetails.call(this, parentDOM, true);

	StudentDetails.prototype.init.call(this);
}

StudentDetailsStudents.prototype = Object.create(StudentDetails.prototype);

StudentDetailsStudents.prototype.load = function () {
	var self = this;
	var url = '/students_view/api/get_current_students_data';

	var params = [];
	params.push('course_semester=true');
	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.parentDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.parentDOM.removeClass('loading');

		self.data = data;

		if (data.course_semester) {
			self.course_semester = data.course_semester;
		}
		if (data.student) {
			self.student = data.student;
		}
		if (data.definitions) {
			self.initDefinitions(data.definitions);
		}
		self.draw();

		window.loadedData = data;
		if(window.dataListeners) {
			window.dataListeners.forEach(function(listener) {
				listener(data);
			});
		}

		//self.loadPaths()

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};
