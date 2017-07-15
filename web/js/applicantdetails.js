// Copyright (c) 2017 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function ApplicantDetails(parentDOM) {
	this.parentDOM = parentDOM;
	this.applicantId = parseInt(parentDOM.attr('data-id'));
	this.applicant = null;
	this.course_semester = null; //TODO: check if needed

	this.fieldData = {
	};

	this.data = null; // Last loaded data
	//this.pathData = null; // Last loaded path data
	this.markedData = null;
	this.markedListData = null;
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

ApplicantDetails.prototype.drawMarkedListInfo = function (el) {
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
		if (typeof(d.comments[self.applicantId]) != 'undefined') {
			item.attr('title', d.comments[self.applicantId].text);
		}
		item.tooltip();

	}


};


ApplicantDetails.prototype.drawMarkedListDialog = function (baseElement) {
	var self = this;

	var dialog = $(document.createElement('div'));
	dialog.addClass('markinfo');
	dialog.attr('title', 'Vormerkungen bearbeiten');


	var status = $(document.createElement('p')).text('Lade Vormerkungslisten ...').appendTo(dialog);
	status.addClass('loading');

	var addform = $(document.createElement('div')).addClass('markedadd').appendTo(dialog);
	$(document.createElement('span')).text('Bewerber/in hinzufügen zur Liste: ').appendTo(addform);
	var select = $(document.createElement('select')).hide().appendTo(addform);

	select.change(function () {
		var ident = select.val();
		for (var i = 0; i < mlists.data.list.length; i++) {
			var d = mlists.data.list[i];
			if (d.ident == ident) {
				d.list.push(self.applicantId);
				setChanges(d.ident, 'add_idents', self.applicantId);
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
			var isin_a = a.list.indexOf(self.applicantId) != -1;
			var isin_b = b.list.indexOf(self.applicantId) != -1;

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

		if (d.list.indexOf(self.applicantId) != -1) {
			if (d['is_writable']) {
				btn.addClass('isin');
				btn.text('Entfernen');
			}
			var comment = $(document.createElement('textarea')).addClass('commentbox').appendTo(entry);
			if (!d['is_writable']) {
				comment.attr('readonly', true);
			}
			if (d.comments[self.applicantId]) {
				var ci = d.comments[self.applicantId];
				comment.val(ci.text);
				var info = $(document.createElement('div')).addClass('markedinfo').appendTo(entry);
				if (ci && ci.date && ci.by) {
					info.text('Von ' + ci.by + ' am ' + getDateTimeText(new Date(parseInt(ci.date * 1000))));
				}
			}
			comment.change(function () {
				if (d.comments[self.applicantId]) {
					d.comments[self.applicantId].text = comment.val();
				} else {
					d.comments[self.applicantId] = {text: comment.val()};
				}
				setChanges(d.ident, 'comments', d.comments[self.applicantId].text);
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

				var p = d.list.indexOf(self.applicantId);
				if (p != -1) {
					d.list.splice(p, 1);
					setChanges(d.ident, 'remove_idents', self.applicantId);
				} else {
					d.list.push(self.applicantId);
					setChanges(d.ident, 'add_idents', self.applicantId);
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
				data['comments'][self.applicantId] = changes[list_ident]['comments'];
			}
			if (typeof(changes[list_ident]['add_idents']) != 'undefined') {
				data['add_idents'] = [self.applicantId];
			}
			if (typeof(changes[list_ident]['remove_idents']) != 'undefined') {
				data['remove_idents'] = [self.applicantId];
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

ApplicantDetails.prototype.initDefinitions = function (definitions) {
	var self = this;
	self.definitions = definitions;
	$("[data-lights=lights_0]").text(self.definitions.lights[0] * 100);
	$("[data-lights=lights_1]").text(self.definitions.lights[1] * 100);
	$("[data-lights=lights_2]").text(self.definitions.lights[2] * 100);

};
ApplicantDetails.prototype.findQuery = function (q) {
	for (var qId in this.definitions['queries']) {
		var query = this.definitions['queries'][qId];
		if (query.q == q) return query;
	}
	return null;
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
