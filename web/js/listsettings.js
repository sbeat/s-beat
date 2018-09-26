// Copyright (c) 2018 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses

/**
 * Provides handling of setting storage and loading for lists
 * @param parent
 * @constructor
 */
function ListSettings(parent, type) {
	this.parent = parent;
	this.linkDOM = null;
	this.settingsType = type;

	ListSettings.prototype.init.call(this);
}

ListSettings.prototype.init = function () {
	var self = this;
};
ListSettings.prototype.openMenu = function () {
	var self = this;
	var menuDOM = $('<ul></ul>');

	$('<a href="javascript:"></a>')
		.text('Bearbeiten')
		.click(function (e) {
			openSettingsDialog.call(self.parent);
			menuDOM.remove();
		})
		.appendTo($('<li></li>').appendTo(menuDOM));

	$('<a href="javascript:"></a>')
		.text('Speichern als')
		.click(function (e) {
			self.openSaveDialog();
			menuDOM.remove();
		})
		.appendTo($('<li></li>').appendTo(menuDOM));


	menuDOM.menu();

	menuDOM.addClass('filterMenu');
	var offset = self.linkDOM.offset();

	offset.top += self.linkDOM.outerHeight();
	menuDOM.css({'top': offset.top + 'px', 'left': offset.left + 'px'});

	menuDOM.click(function (e) {
		e.stopPropagation();
	});
	var win = $(window);

	$(document.body).append(menuDOM);

	function clickOutside() {
		menuDOM.remove();
	}

	setTimeout(function () {
		win.one('click', clickOutside);
	}, 10);

	this.loadSaved(menuDOM);

};

ListSettings.prototype.openSaveDialog = function () {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Einstellungen speichern');

	var p, label;

	p = $(document.createElement('p')).text(
		'Die aktuellen Einstellungen und die Filterauswahl können unter einem Namen gespeichert werden.  ').appendTo(dialogBox);

	var settingIdSelect = null, settingName = null;

	getSortedListSettings(self.settingsType, self.parent.settingsPrefix, function (list) {
		var selection = [];
		selection.push({label: 'Nicht speichern', value: ''});
		selection.push({label: 'Neue Einstellung', value: 'new'});
		if (list) {
			for (var i = 0; i < list.length; i++) {
				var setting = list[i];
				selection.push({label: setting.name, value: setting.id});
			}
		}

		p = document.createElement('p');
		p.className = 'optionset';
		dialogBox.append(p);
		label = document.createElement('label');
		p.appendChild(label);
		label.appendChild(document.createTextNode('Speichern als'));
		settingIdSelect = drawSelect(selection, '');
		p.appendChild(settingIdSelect);
		var idseljQ = $(settingIdSelect);
		idseljQ.change(function () {
			var val = idseljQ.val();
			if (val && val !== 'new') {
				settingName.value = idseljQ.find(':selected').text();
			}
			if (val || val === 'new') {
				saveNameBox.show();
			} else {
				saveNameBox.hide();
			}

		});

		p = document.createElement('p');
		p.className = 'optionset';
		var saveNameBox = $(p);
		dialogBox.append(p);
		label = document.createElement('label');
		p.appendChild(label);
		label.appendChild(document.createTextNode('Name'));
		settingName = document.createElement('input');
		settingName.type = 'text';
		settingName.maxLength = 40;
		p.appendChild(settingName);

		saveNameBox.hide();
	});

	var buttons = {
		Speichern: function () {

			var idseljQ = $(settingIdSelect);
			var settingId = idseljQ.val();
			if (settingId) {
				if (settingId === 'new') {
					settingId = self.parent.settingsPrefix + '<new>';
				}

				if (!settingName.value.length) {
					settingName.className = (settingName.className || '') + ' error';
					return;
				}

				dialogBox.addClass('loading');
				self.parent.saveSettings(settingId, settingName.value, function (data) {
					dialogBox.removeClass('loading');
					if (data && data.status === 'ok') {
						dialogBox.dialog("close");

					} else if (data && data.error === 'already_exists' && data.id) {
						loadServerSettings(self.settingsType, function (settings) {
							if (settings && settings[data.id]) {
								$(document.createElement('p')).addClass('error').text(
									'Existiert bereits mit dem Namen: ' + settings[data.id].name + '').appendTo(dialogBox);
							} else {
								$(document.createElement('p')).addClass('error').text(
									'Existiert bereits.').appendTo(dialogBox);
							}

						});

					} else {
						$(document.createElement('p')).addClass('error').text(
							'Error: ' + (data ? data.error : 'Verbindungsproblem')).appendTo(dialogBox);
					}

				}, self.settingsType);


			} else {
				dialogBox.dialog("close");
			}


		},
		Abbrechen: function () {
			$(this).dialog("close");
		}
	};

	dialogBox.dialog({
		width: 400,
		modal: true,
		buttons: buttons
	});


};

ListSettings.prototype.loadSaved = function (menuDOM) {
	var self = this;

	var baseHref = location.href.replace(/ssid=[^&]+/, '');
	if (baseHref.indexOf('?') === -1) baseHref += '?';

	var loading = $('<li class="loading"></li>')
		.addClass('ui-menu-header ui-menu-item')
		.text('Loading')
		.appendTo(menuDOM);


	getSortedListSettings(self.settingsType, self.parent.settingsPrefix, function (data) {
		loading.remove();
		if (data.length) {
			$('<li></li>')
				.addClass('ui-menu-header ui-menu-item')
				.text('Gespeicherte Einstellungen:')
				.appendTo(menuDOM);
		}

		data.forEach(function (entry) {
			var entryDom = $('<li class="ui-menu-item"></li>').appendTo(menuDOM);
			$('<a href="javascript:"></a>')
				.attr('href', baseHref + '&ssid=' + entry.id)
				.text(entry.name)
				.click(function (e) {
					// self.parent.loadSettings(entry);
					// self.parent.filter.draw();
					// self.parent.draw();
					// self.parent.load();
					// menuDOM.remove();
				})
				.appendTo(entryDom);

			$('<a href="javascript:"></a>')
				.addClass('deleteBtn')
				.click(function (e) {
					if (confirm('Die Einstellung ' + entry.name + ' löschen?')) {
						deleteServerSetting(self.settingsType, entry.id);
						entryDom.remove();
					}
				})
				.appendTo(entryDom);
		});

	});

};