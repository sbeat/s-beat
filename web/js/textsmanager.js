// Copyright (c) 2018 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function TextsManager(parentDOM) {
	this.parentDOM = parentDOM;

	this.listDOM = $(document.createElement('div')).addClass('TextsManager');

	this.texts = [];

	this.drawn = false;

	this.definitions = null;

	this.filterDOM = $(document.createElement('div')).addClass('filterlist');
	this.filter = new FilterList(this.filterDOM);

	this.positionOptions = [
		{value: 'left', label: 'Links'},
		{value: 'top', label: 'Oben'},
		{value: 'bottom', label: 'Unten'}
	];


	TextsManager.prototype.init.call(this);
}

/**
 * Gets called once this TextsManager is initialized
 */
TextsManager.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};
/**
 * Gets called every time the TextsManager must be drawn completely
 */
TextsManager.prototype.draw = function () {
	var self = this;

	if (!this.drawn) {
		this.drawn = true;
		this.parentDOM.empty();

		// this.parentDOM.append(this.filterDOM);

		$('<a href="" class="button"/>')
			.text('Text erstellen')
			.appendTo(this.parentDOM)
			.click(function (e) {
				e.preventDefault();
				self.openTextDialog(null, null);
			});

		this.parentDOM.append(this.listDOM);

		this.listDOM = $(createDom('ul', 'columnlist')).appendTo(this.listDOM);

	}

	self.listDOM.empty();

	if (self.texts && self.texts.length) {
		for (var i = 0; i < self.texts.length; i++) {
			var item = self.texts[i];
			self.listDOM.append(self.drawTextEntry(item));
		}
	}

};
TextsManager.prototype.drawTextEntry = function (text) {
	var self = this;

	var catO = createDom('li', 'colrow textitem');
	catO.textItem = text;

	var linkO = $(createDom('a', '', catO));
	linkO.text(text.ident);
	linkO.attr('href', 'javascript:');
	linkO.click(function (e) {
		e.preventDefault();
		self.openTextDialog(text.ident, text);
	});

	var statusBox = document.createElement('div');
	statusBox.className = 'itemStatus';
	catO.appendChild(statusBox);

	if (text.enabled) {
		statusBox.title = 'Ist aktiv';
		statusBox.className += ' active';
	} else {
		statusBox.title = 'Ist deaktiviert';
	}

	$(statusBox).tooltip()
		.click(function (e) {
			text.enabled = !text.enabled;
			self.action('edit_text', text, $(catO));
			$(catO).replaceWith(self.drawTextEntry(text));
		});

	var filterBox = document.createElement('div');
	filterBox.className = 'filters';
	catO.appendChild(filterBox);

	if (text.filters) {
		for (var i = 0; i < text.filters.length; i++) {
			var filter = text.filters[i];
			filterBox.append(self.filter.drawFilter(filter, true)[0]);
		}
	}

	var textBox = document.createElement('div');
	textBox.className = 'ql-editor textBox';
	textBox.innerHTML = text.text;
	catO.appendChild(textBox);

	return catO;
};

TextsManager.prototype.openTextDialog = function (ident, text) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', text ? 'Text bearbeiten' : 'Text hinzufügen');

	var filterDOM = $(document.createElement('div')).addClass('filterlist');
	var filter = new FilterList(filterDOM);
	filter.available = self.filter.available.slice();

	var form = {};

	filterDOM.appendTo(dialogBox);
	filter.filters = [];

	form.ident = drawFormLine('text', 'ID');
	dialogBox.append(form.ident);

	form.position = drawFormLine('select', 'Position');
	form.position.setOptions(this.positionOptions);
	dialogBox.append(form.position);

	form.enabled = drawFormLine('checkbox', 'Aktiv');
	dialogBox.append(form.enabled);

	form.order = drawFormLine('number', 'Ordnungsnummer');
	dialogBox.append(form.order);

	form.text = document.createElement('div');
	dialogBox.append(form.text);

	var toolbarOptions = [
		['bold', 'italic', 'underline'],
		[{'list': 'ordered'}, {'list': 'bullet'}],
		[{'indent': '-1'}, {'indent': '+1'}],
		[{'size': []}],  // custom dropdown
		[{'header': [2, 3, 4, false]}],
		[{'color': []}],
		[{'align': []}],
		['clean']
	];

	form.text.quill = new Quill(form.text, {
		theme: 'snow',
		modules: {
			toolbar: toolbarOptions
		}
	});

	form.text.getValue = function () {
		return this.quill.root.innerHTML;
	};
	form.text.setValue = function (v) {
		this.quill.root.innerHTML = v;
	};

	form.filters = {};
	form.filters.getValue = function () {
		return filter.filters;
	};
	form.filters.setValue = function (v) {
		filter.filters = v;
	};


	if (text) {
		form.ident.setValue(text.ident);
		form.ident.input.disabled = true;
		form.position.setValue(text.position);
		form.enabled.setValue(text.enabled);
		form.order.setValue(text.order);
		form.text.setValue(text.text);
		form.filters.setValue(text.filters);
	} else {
		form.position.setValue('left');
		form.enabled.setValue(true);
		form.order.setValue(0);
	}

	filter.draw();

	var status = $(document.createElement('p')).appendTo(dialogBox);

	var buttons = {};
	buttons['Speichern'] = function () {
		var data = {};
		for (var field in form) {
			data[field] = form[field].getValue();
		}
		form.ident.setError(data.ident.length < 2 ? 'Die ID ist zu kurz' : null);

		for (var field in form) {
			if (form[field].error) return;
		}

		console.log('data', data);
		var action = 'add_text';
		if (text) {
			data.ident = ident;
			status.text('Ändere ...');
			action = 'edit_text';
		} else {
			status.text('Erstelle ...');
			if (self.texts && self.texts) {
				data.order = self.texts.length + 1;
			}
		}

		self.action(action, data, status, function (data) {
			if (data && data.error) {
				status.text('Fehler: ' + data.error);
			} else {
				dialogBox.dialog("close");
				self.load();
			}

		});

	};
	if (text) {
		buttons['Löschen'] = function () {

			status.text('Lösche ...');
			self.action('remove_text', {ident: ident}, status, function (data) {
				if (data && data.error) {
					status.text('Fehler: ' + data.error);
				} else {
					dialogBox.dialog("close");
					self.load();
				}

			});

		};
	}

	buttons['Abbrechen'] = function () {
		$(this).dialog("close");
	};


	dialogBox.dialog({
		width: 700,
		buttons: buttons,
		modal: true
	});

};

TextsManager.prototype.initDefinitions = function (definitions) {
	var self = this;
	self.definitions = definitions;

	var query;
	var usedQueries = [];

	for (var peId in self.definitions['path_elements']) {
		var pe = self.definitions['path_elements'][peId];
		query = self.definitions['queries'][pe['query_id']];
		if (self.definitions.restricted.indexOf(query.q) != -1) continue;

		self.filter.addElementFilter(peId, query, pe.condition);
		if (usedQueries.indexOf(pe['query_id'].toString()) == -1) {
			usedQueries.push(pe['query_id'].toString());
		}
	}
	for (var qId in self.definitions['queries']) {
		query = self.definitions['queries'][qId];
		if (self.definitions.restricted.indexOf(query.q) != -1) continue;
		if (usedQueries.indexOf(qId) == -1) {
			self.filter.addAttributeFilter(query.q, query.name, query.category, query['formatting'], null);
		} else if (['int', 'grade', 'percent'].indexOf(query['formatting']) != -1) {
			var catg = query.category.split('.');
			catg.push(query.name);
			var f = self.filter.addAttributeFilter(query.q, query.name, catg, query['formatting'], null);
			f.displayName = 'Benutzerdefiniert';
		}
	}

	// self.filter.draw();
	self.filter.sortFilters();


};

TextsManager.prototype.load = function () {
	var self = this;

	self.action('get_texts', {}, self.listDOM, function (data) {
		self.texts = data.texts;

		self.initDefinitions(data.definitions);

		self.draw();

	});

};

TextsManager.prototype.action = function (action, data, parent, callb) {
	var self = this;
	var url = '/api/ManageDisplayTexts';

	if (data) {
		data.action = action;
	} else {
		data = {action: action};
	}


	parent.addClass('loading');

	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify(data)
	}).success(function (data) {
		parent.removeClass('loading');

		if (callb) {
			callb(data);
		}

	}).fail(function () {
		parent.removeClass('loading');
		parent.text('Laden der Daten ist fehlgeschlagen.');
	});

};
