// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function ApplicantDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.applicantId = parseInt(parentDOM.attr('data-id'));
	this.applicant = null;

	this.fieldData = {};
	defineFD(this.fieldData, 'students.count', 'Anzahl Studenten', '', 'int');

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
	var query = self.findQuery(field);
	var fieldInfo = this.fieldData[field];
	if (self.definitions.restricted.indexOf(field) != -1) {
		el.text('***');
		return;
	}

	if (field == 'stg') {

		//Link to courses detail list
		var a = $(document.createElement('a'));
		a.attr('href', 'coursedetails.html?stg=' + self.applicant.stg);
		a.text(self.applicant.stg);
		el.append(a);

	} else if (field == 'markedlists') {
		self.drawMarkedListInfo(el);


	} else if (field == 'admissionstatus') {
		if (applicant.admitted) {
			td.text('Zugelassen');
		} else {
			td.text('(Noch) nicht zugelassen');
		}

	} else if (field == 'tooltip') {
		var contentSelector = el.attr('data-tooltip-content');
		var contentElement = contentSelector?$(contentSelector):el.find('div');
		var hoverelement = el.find('a').first();
		hoverelement.attr('title', '');
		hoverelement.tooltip({
			content: contentElement.html(),
			open: function () {
				console.log('open');
			}
		});

	} else if (field == 'hzb_appl_time') {
		value = getByPath(field, self.applicant);
		el.text(getMonthsText(value) + " nach HZB");


	} else if(field == 'identification_link') {
		el.click(function(e){
			e.preventDefault();
			$('#identification_data').show();
			$(this).hide();
		});

	} else {
		value = getByPath(field, self.applicant);
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

		var hzb_value = getByPath(field, self.applicant);
		console.log(hzb_value);
		if (hzb_value == 990) {
			el.append(" (Es liegt keine HZB Note vor.)");
		}
	}

};

ApplicantDetails.prototype.initDefinitions = function (definitions) {
	var self = this;
	self.definitions = definitions;

};


ApplicantDetails.prototype.load = function () {
	var self = this;
	var url = '/api/GetApplicantInfo';

	var params = [];
	params.push('ident=' + this.applicantId);
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
		if (data.applicant) {
			self.applicant = data.applicant;
		}
		self.draw();

		//self.loadPaths()

	}).fail(function () {
		self.parentDOM.removeClass('loading');
		self.parentDOM.text('Laden der Daten ist fehlgeschlagen.');
	})

};


ApplicantDetails.prototype.loadMarkedLists = function (el) {
	var self = this;
	var url = '/api/GetMarkedList?list=' + this.applicantId;

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
