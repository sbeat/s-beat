// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function ApplicantDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.applicantId = parentDOM.attr('data-id');
	this.applicant = null;

	this.fieldData = {};
	defineFD(this.fieldData, 'admitted', 'Zugelassen', '', 'bool');
	defineFD(this.fieldData, 'student', 'Ist student', '', 'bool');
	defineFD(this.fieldData, 'age', 'Alter', '', 'int');
	defineFD(this.fieldData, 'appl_date', 'Bewerbungdatum', '', 'date');
	defineFD(this.fieldData, 'birth_date', 'Geburtsdatum', '', 'date');
	defineFD(this.fieldData, 'gender', 'Geschlecht', '', 'gender');
	defineFD(this.fieldData, 'hzb_date', 'HZB Datum', '', 'date');
	defineFD(this.fieldData, 'hzb_grade', 'HZB Note', '', 'grade');
	defineFD(this.fieldData, 'start_semester', 'Startsemester', '', 'semester');
	defineFD(this.fieldData, 'adm_date', 'Zulassungsdatum', '', 'date');

	this.data = null; // Last loaded data
	this.definitions = null;

	ApplicantDetails.prototype.init.call(this);
}

/**
 * Gets called once this ApplicantDetails is initialized
 */
ApplicantDetails.prototype.init = function () {
	// Check for global context and filters
	var self = this;


	self.load();

};

ApplicantDetails.prototype.draw = function () {
	var self = this;
	if (!self.applicant) {
		self.parentDOM.text('Ein Bewerber mit der ID ' + self.applicantId + ' wurde nicht gefunden.');
		return;
	}

	self.parentDOM.find('[data-applicant]').each(function () {
		var el = $(this);
		var field = el.attr('data-applicant');
		self.drawValue(field, el);
	});

};

ApplicantDetails.prototype.drawValue = function (field, el) {
	var self = this;
	var value;
	var fieldInfo = this.fieldData[field];

	if (field == 'stg') {

		// Link to courses detail list
		var a = $(document.createElement('a'));
		a.attr('href', 'coursedetails.html?stg=' + encodeURIComponent(self.applicant.stg));
		a.text(self.applicant.stg);
		el.append(a);

	} else if (field == 'student') {

		if(self.applicant.student_ident) {
			// Link to student detail page
			$(document.createElement('a'))
				.attr('href', 'student_detail.html?id=' + encodeURIComponent(self.applicant.student_ident))
				.text(self.applicant.student_ident)
				.appendTo(el);
		} else {
			el.text('Kein Datensatz vorhanden');
		}


	} else if (field == 'admissionstatus') {
		if (self.applicant.admitted) {
			el.text('Zugelassen');
		} else {
			el.text('(Noch) nicht zugelassen');
		}

	} else if (field == 'hzb_appl_time') {
		value = getByPath(field, self.applicant);
		el.text(getMonthsText(value) + " nach HZB");


	} else if (field == 'identification_link') {
		el.click(function (e) {
			e.preventDefault();
			$('#identification_data').show();
			$(this).hide();
		});

	} else if (field.match(/^display\.(.+)/)) {
		if (self.isHiddenField(RegExp.$1)) {
			el.hide();
		}

	} else {
		value = getByPath(field, self.applicant);
		el.empty();
		if (fieldInfo) {
			el.append(getFormattedHTML(value, fieldInfo.formatting));
		} else {
			el.append(getFormattedHTML(value, 'str'));
		}

	}


	if (field == 'hzb_grade') {

		var hzb_value = getByPath(field, self.applicant);
		console.log(hzb_value);
		if (hzb_value == 990) {
			el.append(" (Es liegt keine HZB Note vor.)");
		}
	}

};

ApplicantDetails.prototype.isHiddenField = function (field) {
	var self = this;
	return self.data && self.data.hide_applicant_fields
		&& self.data.hide_applicant_fields.indexOf(field) !== -1;
};

ApplicantDetails.prototype.load = function () {
	var self = this;
	var url = '/api/GetApplicants';

	var params = [];
	params.push('ident=' + encodeURIComponent(this.applicantId));

	if (isTempActive()) params.push('temp=true');

	if (params.length) url += '?';
	url += params.join('&');

	self.parentDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.parentDOM.removeClass('loading');

		self.data = data;
		if (data.list[0]) {
			self.applicant = data.list[0];
		}
		self.draw();

		//self.loadPaths()

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};
