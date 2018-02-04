// Copyright (c) 2018 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

function TagsManager(parentDOM) {
	this.parentDOM = parentDOM;

	this.type = parentDOM.attr('data-type'); // students, exams

	this.listDOM = $(document.createElement('div')).addClass('tagsManager');

	this.data = null; // Last loaded data

	this.categoryTree = [];

	this.drawn = false;


	TagsManager.prototype.init.call(this);
}

/**
 * Gets called once this TagsManager is initialized
 */
TagsManager.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};
/**
 * Gets called every time the TagsManager must be drawn completely
 */
TagsManager.prototype.draw = function () {
	var self = this;

	if (!this.drawn) {
		this.drawn = true;
		this.parentDOM.empty();

		$('<a href="" class="button"/>')
			.text('Tag erstellen')
			.appendTo(this.parentDOM)
			.click(function (e) {
				e.preventDefault();
				self.openTagDialog(null, null);
			});

		this.parentDOM.append(this.listDOM);

		this.listDOM = $(createDom('ul', 'columnlist')).appendTo(this.listDOM);
		this.listDOM.on('sortstop', function () {
			self.saveOrder();
		});

	}

	self.listDOM.empty();

	if (self.data && self.data.result.length) {
		for (var i = 0; i < self.data.result.length; i++) {
			var item = self.data.result[i];
			self.listDOM.append(self.drawTag(item));
		}
	}

	self.listDOM.sortable();

};
TagsManager.prototype.drawTag = function (tag) {
	var self = this;

	var catO = createDom('li', 'colrow tagitem');
	catO.tag = tag;

	var linkO = $(createDom('a', '', catO));
	linkO.text(tag.name);
	linkO.attr('href', 'javascript:');
	linkO.click(function (e) {
		e.preventDefault();
		self.openTagDialog(tag.name, tag);
	});

	var orderBox = document.createElement('div');
	orderBox.className = 'orderbox';
	catO.appendChild(orderBox);

	var statusBox = document.createElement('div');
	statusBox.className = 'status';
	catO.appendChild(statusBox);

	if (tag.active) {
		statusBox.title = 'Ist aktiv';
		statusBox.className += ' active';
	} else {
		statusBox.title = 'Ist deaktiviert';
	}

	$(statusBox).tooltip()
		.click(function (e) {
			tag.active = !tag.active;
			var data = Object.assign({}, tag);
			data.id = tag.name;
			self.action('edit_tag', data, $(catO));
			$(catO).replaceWith(self.drawTag(tag));
		});

	return catO;
};

TagsManager.prototype.openTagDialog = function (tag_id, tag) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', tag ? 'Tag bearbeiten' : 'Tag hinzufügen');

	var form = {};

	form.name = drawFormLine('text', 'Name');
	dialogBox.append(form.name);
	if (tag) {
		form.name.setValue(tag.name);
		form.name.input.disabled = true;
	}

	var status = $(document.createElement('p')).appendTo(dialogBox);

	var buttons = {};
	buttons['Speichern'] = function () {
		var data = {id: tag_id, active: true};
		for (var field in form) {
			data[field] = form[field].getValue();
		}
		form.name.setError(data.name.length < 2 ? 'Der Name ist zu kurz' : null);

		for (var field in form) {
			if (form[field].error) return;
		}

		console.log('data', data);
		var action = 'add_tag';
		if (tag) {
			data.id = tag_id;
			data.order = tag.order;
			status.text('Ändere ...');
			action = 'edit_tag';
		} else {
			status.text('Erstelle ...');
			if (self.data && self.data.result) {
				data.order = self.data.result.length + 1;
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
	if (tag) {
		buttons['Löschen'] = function () {

			status.text('Lösche ...');
			self.action('remove_tag', {id: tag_id}, status, function (data) {
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
		width: 500,
		buttons: buttons,
		modal: true
	});

};

TagsManager.prototype.saveOrder = function () {
	var self = this;
	var pos = 1;
	var updates = {};
	self.listDOM.find('li').each(function () {
		var elPos = pos++;
		if (this.tag && this.tag.order !== elPos) {
			this.tag.order = elPos;
			var data = Object.assign({}, this.tag);
			data.id = this.tag.name;
			self.action('edit_tag', data, $(this));
		}
	});
};

TagsManager.prototype.load = function () {
	var self = this;

	self.action('get_tags', {}, self.listDOM, function (data) {
		self.data = data;

		self.draw();

	});

};

TagsManager.prototype.action = function (action, data, parent, callb) {
	var self = this;
	var url = '/api/ManageTags';

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