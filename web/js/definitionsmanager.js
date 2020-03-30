// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function DefinitionsManager(parentDOM) {
	this.parentDOM = parentDOM;

	this.type = parentDOM.attr('data-type'); // students, exams

	this.browserDOM = $(document.createElement('div')).addClass('definitionsBrowser');

	this.data = null; // Last loaded data
	this.statsData = null;

	this.drawn = false;

	this.categoryTree = [];

	this.formattings = {
		//'auto': 'Automatisch',
		'str': 'String',
		'int': 'Integer',
		'gender': 'Geschlecht',
		'grade': 'Note',
		'date': 'Datum',
		'stg': 'Studiengang',
		'semester': 'Semester',
		'yesno': 'Ja/Nein',
		'percent': 'Prozentsatz'
	};

	this.comparators = {
		string: ['equal'],
		number: ['equal', 'lower', 'lower_equal', 'greater', 'greater_equal', 'between'],
		bool: ['is']
	};

	DefinitionsManager.prototype.init.call(this);
}
/**
 * Gets called once this DefinitionsManager is initialized
 */
DefinitionsManager.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};
/**
 * Gets called every time the DefinitionsManager must be drawn completely
 */
DefinitionsManager.prototype.draw = function () {
	var self = this;

	if (!this.drawn) {
		this.drawn = true;
		this.parentDOM.empty();

		$('<a href="" class="button"/>')
			.text('Datenfeld hinzufügen')
			.appendTo(this.parentDOM)
			.click(function (e) {
				e.preventDefault();
				self.openQueryDialog(null, null);
			});

		$('<a href="" class="button"/>')
			.text('Statistiken berechnen')
			.appendTo(this.parentDOM)
			.click(function (e) {
				e.preventDefault();
				self.action('get_definition_stats', {}, self.browserDOM, function (data) {
					if (data && data['path_element_stats']) {
						self.statsData = data;
						self.draw();
					}

				});
			});

		this.parentDOM.append(this.browserDOM);

	}

	self.browserDOM.empty();
	var categories = self.getCategoriesTreeList();
	for (var i = 0; i < categories.length; i++) {
		var item = categories[i];
		self.browserDOM.append(self.drawCategory(item.value));
	}

};
DefinitionsManager.prototype.drawCategory = function (category) {
	var self = this;
	var path = category.split('.');

	var catO = createDom('div', 'bcategory');
	var nameO = createDom('div', 'name', catO);
	nameO.appendChild(document.createTextNode(path.join(' » ')));

	var query_ids = Object.keys(self.data['queries']);
	query_ids.sort(function (a, b) {
		var q_a = self.data['queries'][a];
		var q_b = self.data['queries'][b];
		if (q_a.name < q_b.name) return -1;
		if (q_a.name > q_b.name) return 1;
		return 0;
	});

	for (var i = 0; i < query_ids.length; i++) {
		var query_id = query_ids[i];
		var query = self.data['queries'][query_id];
		if (query.category != category) continue;

		catO.appendChild(self.drawQuery(path, query_id, query));
	}


	return catO;
};

DefinitionsManager.prototype.drawQuery = function (path, query_id, query) {
	var self = this;
	var queryO = createDom('div', 'bquery');

	function drawKV(field, label, value) {
		var item = createDom('div', 'kv', queryO);
		var labelO = createDom('span', 'label', item);
		labelO.appendChild(document.createTextNode(label + ': '));

		var valueO = createDom('span', 'value', item);
		valueO.appendChild(document.createTextNode(value));
		return item;
	}

	var nameO = createDom('a', 'name kv', queryO);
	nameO.appendChild(document.createTextNode(query.name));
	nameO.href = '';
	$(nameO).click(function (e) {
		e.preventDefault();
		self.openQueryDialog(query_id, query);
	});

	drawKV('query', 'Query', query.q);
	drawKV('formatting', 'Formatierung', self.formattings[query.formatting]);
	drawKV('ignore', 'Ignorieren', query.ignore ? 'Ja' : 'Nein');

	var infoO = createDom('div', 'info', queryO);
	if (query.depends) {
		for (var i = 0; i < query.depends.length; i++) {
			var pe_id = query.depends[i];
			var pe = self.data['path_elements'][pe_id];
			if(pe) {
				var pe_query = self.data['queries'][pe.query_id];
				var text = getConditionText(pe.condition, pe_query['formatting']);
				createDom('span', '', infoO).appendChild(document.createTextNode(pe_query.name + ': ' + text + ' '));
			} else {
				createDom('span', '', infoO).appendChild(document.createTextNode('Unbekannte Abhängigkeit '));
			}

		}
	}

	if (query.auto_generate) {
		var infoCondO = createDom('div', 'bcond', queryO);
		infoCondO.appendChild(document.createTextNode('Die Bedingungen werden bei einem Datenupdate automatisch auf Basis der Studentendaten generiert.'));
	}

	var pe_ids = self.getSortedPathElements(query_id);
	for (var i = 0; i < pe_ids.length; i++) {
		var pe_id = pe_ids[i];
		var pe = self.data['path_elements'][pe_id];
		if (pe.query_id != query_id) continue;
		queryO.appendChild(self.drawCondition(query_id, query, pe_id, pe));
	}

	if (pe_ids.length == 0 && !query.auto_generate || query.ignore) {
		queryO.className += ' ignore';
	}

	if (!query.auto_generate) {
		var addCondO = createDom('div', 'bcond', queryO);
		var addCond = createDom('a', 'kv', addCondO);
		addCond.appendChild(document.createTextNode('» Bedingung hinzufügen'));
		addCond.href = '';
		$(addCond).click(function (e) {
			e.preventDefault();
			self.openConditionDialog(query_id, query, null, null);
		});
	}


	return queryO;
};

DefinitionsManager.prototype.drawCondition = function (query_id, query, pe_id, pe) {
	var self = this;

	var text = getConditionText(pe.condition, query['formatting']);

	var condO = createDom('div', 'bcond');

	if(query.auto_generate) {
		var name = createDom('span', 'kv', condO);
		name.appendChild(document.createTextNode(text));
	} else {
		var link = createDom('a', 'kv', condO);
		link.appendChild(document.createTextNode(text));
		link.href = '';
		$(link).click(function (e) {
			e.preventDefault();
			self.openConditionDialog(query_id, query, pe_id, pe);
		});
	}



	var item = createDom('div', 'kv', condO);
	var labelO = createDom('span', 'label', item);
	labelO.appendChild(document.createTextNode('Level: '));

	var valueO = createDom('span', 'value', item);
	valueO.appendChild(document.createTextNode(pe.condition.order));

	if (self.statsData && self.statsData['path_element_stats'] && self.statsData['path_element_stats'][pe_id]) {
		var stats = self.statsData['path_element_stats'][pe_id];

		item = createDom('div', 'kv', condO);
		labelO = createDom('span', 'label', item);
		labelO.appendChild(document.createTextNode('Studenten: '));

		valueO = createDom('span', 'value', item);
		valueO.appendChild(document.createTextNode(stats.count));
	}


	return condO;
};

DefinitionsManager.prototype.getCategoriesTreeList = function (withQueries, withConditions) {
	var self = this;
	var list = []; // {value:,label:}

	self.sortCategoryTree();
	function addConditionsList(path, query_id, query, list) {
		for (var pe_id in self.data['path_elements']) {
			var pe = self.data['path_elements'][pe_id];
			if (pe.query_id != query_id) continue;
			list.push({
				value: pe_id,
				label: query.name + ' : ' + getConditionText(pe.condition, query['formatting'])
				//label: path.join(' » ') + ' : ' + query.name + ' : ' + getConditionText(pe.condition, query['formatting'])
			});
		}
	}

	function addQueriesList(path, list) {
		for (var query_id in self.data['queries']) {
			var query = self.data['queries'][query_id];
			if (query.category != path.join('.')) continue;
			if (withConditions) {
				addConditionsList(path, query_id, query, list);
			} else {
				list.push({value: query_id, label: path.join(' » ') + ' : ' + query.name});
			}
		}
	}

	function getTreeList(tree, path, list) {
		for (var i = 0; i < tree.length; i++) {
			var item = tree[i];
			path.push(item.id);
			if (withQueries) {
				addQueriesList(path, list);
			} else {
				list.push({value: path.join('.'), label: path.join(' » ')});
			}
			getTreeList(item.items, path, list);
			path.pop();
		}
	}

	getTreeList(self.categoryTree, [], list);

	return list;
};

DefinitionsManager.prototype.openQueryDialog = function (query_id, query) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', query ? 'Datenfeld bearbeiten' : 'Datenfeld hinzufügen');

	var form = {};

	form.name = drawFormLine('text', 'Name');
	dialogBox.append(form.name);
	if (query) {
		form.name.setValue(query.name);
	}

	form.category = drawFormLine('select', 'Kategorie');
	dialogBox.append(form.category);
	form.category.setOptions(self.getCategoriesTreeList(), query ? query.category : null, 'Keine Kategorie');
	$(form.category.valueO).append(' ');

	$('<a href="" />')
		.text('Neue Kategorie')
		.appendTo(form.category.valueO)
		.click(function (e) {
			e.preventDefault();
			var name = prompt('Name der neuen Kategorie, welche unter der ausgewählten eingefügt wird.');
			if (name) {
				var path = form.category.getValue().split('.');
				path.push(name);
				self.addPathToCategoryTree(path);
				form.category.setOptions(self.getCategoriesTreeList(), path.join('.'), 'Keine Kategorie');
			}

		});

	form.q = drawFormLine('text', 'Query', 'Pfad des Datenfelds in einer Datenstruktur');
	dialogBox.append(form.q);
	if (query) {
		form.q.setValue(query.q);
	}

	form.formatting = drawFormLine('select', 'Formatierung');
	dialogBox.append(form.formatting);
	form.formatting.setOptions(self.formattings, query ? query.formatting : null);


	form.success = drawFormLine('checkbox', 'Erfolgskriterium');
	dialogBox.append(form.success);
	if (query) {
		form.success.setValue(query.success);
	}

	form.ignore = drawFormLine('checkbox', 'Ignorieren', 'Nicht für die Risikoberechnung zugelassen');
	dialogBox.append(form.ignore);
	if (query) {
		form.ignore.setValue(query.ignore);
	}

	form.auto_generate = drawFormLine('checkbox', 'Bedingungsgenerierung', 'Bedingungen werden automatisch generiert');
	dialogBox.append(form.auto_generate);
	if (query) {
		form.auto_generate.setValue(query.auto_generate);
	}

	form.depends = drawFormLine('multiselect', 'Abhängigkeiten');
	dialogBox.append(form.depends);
	form.depends.setOptions(self.getCategoriesTreeList(true, true), '');
	if (query) {
		form.depends.setValue(query.depends);
	}

	var status = $(document.createElement('p')).appendTo(dialogBox);


	$(form.success.inputO).change(function () {
		if (this.checked) {
			for (var _query_id in self.data['queries']) {
				var query = self.data['queries'][_query_id];
				if (query.success && query_id != _query_id) {
					alert(query.name + ' ist bereits ein Erfolgskriterium');
					this.checked = false;
					break;
				}
			}
		}

	});

	var buttons = {};
	buttons['Speichern'] = function () {
		var data = {query_id: query_id};
		for (var field in form) {
			data[field] = form[field].getValue();
			if (field == 'depends' && data[field].length == 0) data[field] = null;
		}
		form.name.setError(data.name.length < 2 ? 'Der Name ist zu kurz' : null);
		form.q.setError(data.q.length < 2 ? 'Das Query ist zu kurz' : null);

		for (var field in form) {
			if (form[field].error) return;
		}

		console.log('data', data);
		var action = 'add_query';
		if (query) {
			data.query_id = query_id;
			status.text('Ändere ...');
			action = 'edit_query';
		} else {
			status.text('Erstelle ...');
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
	if (query) {
		buttons['Löschen'] = function () {

			status.text('Lösche ...');
			self.action('remove_query', {query_id: query_id}, status, function (data) {
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

DefinitionsManager.prototype.addPathToCategoryTree = function (path) {
	var self = this;

	function addToTree(path, items) {
		var i, item;
		for (i = 0; i < items.length; i++) {
			item = items[i];
			if (item.id == path[0]) {
				if (path.length > 1) {
					return addToTree(path.slice(1), item.items);
				}
				return item;
			}
		}
		for (i = 0; i < path.length; i++) {
			var part = path[i];
			item = {id: part, items: []};
			items.push(item);
			items = item.items;
		}
		return item;
	}

	addToTree(path, self.categoryTree);
};
DefinitionsManager.prototype.sortCategoryTree = function () {
	var self = this;

	function sortTree(tree) {
		tree.sort(function (a, b) {
			if (a.id < b.id) return -1;
			if (a.id > b.id) return 1;
			return 0;
		});
		for (var i = 0; i < tree.length; i++) {
			var item = tree[i];
			sortTree(item.items);
		}
	}

	sortTree(self.categoryTree);
};
DefinitionsManager.prototype.populateCategoryTreeByQueries = function (queries) {
	var self = this;

	for (var query_id in queries) {
		var q = queries[query_id];
		var categories = q.category.split('.');
		self.addPathToCategoryTree(categories);
	}
};

DefinitionsManager.prototype.getSortedPathElements = function (query_id) {
	var self = this;

	function getSortValue(a) {
		var value = a.condition['compare_value'];
		var query = self.data['queries'][a.query_id];
		if (query.formatting == 'yesno') {
			value = a.condition['compare_value'] ? 'Ja' : 'Nein';
		}
		if (a.condition['comparator'] == 'lower') {
			return [a.condition.order, -Infinity, value];
		}
		if (a.condition['comparator'] == 'lower_equal') {
			return [a.condition.order, -Infinity, value];
		}
		if (a.condition['comparator'] == 'greater') {
			return [a.condition.order, Infinity, value];
		}
		if (a.condition['comparator'] == 'greater_equal') {
			return [a.condition.order, Infinity, value];
		}
		if (a.condition['comparator'] == 'between') {
			value = value[0];
		}
		return [a.condition.order, value];
	}

	var keys = Object.keys(self.data['path_elements']).filter(function (key) {
		return self.data['path_elements'][key].query_id == query_id;
	});

	keys.sort(function (a, b) {
		var pe_a = self.data['path_elements'][a];
		var pe_b = self.data['path_elements'][b];
		var a_values = getSortValue(pe_a);
		var b_values = getSortValue(pe_b);
		for (var i = 0; i < a_values.length; i++) {
			var v1 = a_values[i];
			var v2 = b_values[i];
			if (v1 < v2) return -1;
			if (v1 > v2) return 1;
		}
		return 0;
	});
	return keys;
};

DefinitionsManager.prototype.openConditionDialog = function (query_id, query, pe_id, pe) {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', pe ? 'Bedingung bearbeiten' : 'Neue Bedingung hinzufügen');

	var form = {};

	form.name = drawFormLine('text', 'Name', 'Optional zur internen Verwendung');
	dialogBox.append(form.name);
	if (pe) {
		form.name.setValue(pe.condition.name);
	}

	form.comparator = drawFormLine('select', 'Vergleichoperator');
	dialogBox.append(form.comparator);

	if (['str', 'gender', 'stg'].indexOf(query.formatting) != -1) {
		form.comparator.setOptions(self.comparators.string, pe ? pe.condition.comparator : null);

	} else if (['int', 'grade', 'date', 'semester', 'percent'].indexOf(query.formatting) != -1) {
		form.comparator.setOptions(self.comparators.number, pe ? pe.condition.comparator : null);

	} else if (['yesno'].indexOf(query.formatting) != -1) {
		form.comparator.setOptions(self.comparators.bool, pe ? pe.condition.comparator : null);

	}

	var valueCont = $(createDom('div', '', dialogBox));

	function drawValueSelector(comparator) {
		valueCont.empty();
		if (query.formatting == 'yesno') {
			form.value = drawFormLine('select', 'Wert');
			form.value.setOptions({'true': 'Ja', 'false': 'Nein'});
			valueCont.append(form.value);

		} else if (query.formatting == 'gender') {
			form.value = drawFormLine('select', 'Wert');
			form.value.setOptions({'W': 'Weiblich', 'M': 'Männlich'});
			valueCont.append(form.value);

		} else if (comparator == 'between') {
			var v1 = drawFormLine('text', 'Von');
			valueCont.append(v1);

			var v2 = drawFormLine('text', 'Bis');
			valueCont.append(v2);

			form.value = {
				getValue: function () {
					return [v1.getValue(), v2.getValue()]
				},
				setValue: function (value) {
					if (value) {
						v1.setValue(value[0]);
						v2.setValue(value[1]);
					} else {
						v1.setValue('');
						v2.setValue('');
					}
				},
				setError: function (text) {
					v2.setError(text);
				}
			}

		} else {
			form.value = drawFormLine('text', 'Wert');
			valueCont.append(form.value);
		}

	}

	$(form.comparator.select).change(function (e) {
		var cmp = form.comparator.getValue();
		drawValueSelector(cmp);
	});

	if (pe) {
		drawValueSelector(pe.condition.comparator);
		if (pe.condition.comparator == 'between') {
			form.value.setValue([
				getNumericValueOutput(pe.condition.compare_value[0], query.formatting),
				getNumericValueOutput(pe.condition.compare_value[1], query.formatting)
			]);
		} else if(query.formatting === 'yesno') {
			form.value.setValue(String(pe.condition.compare_value));
		} else {
			form.value.setValue(getNumericValueOutput(pe.condition.compare_value, query.formatting));
		}

	} else {
		drawValueSelector(form.comparator.getValue());
	}

	form.negate = drawFormLine('checkbox', 'Negieren');
	dialogBox.append(form.negate);
	if (pe) {
		form.negate.setValue(pe.condition.negate);
	}

	form.order = drawFormLine('text', 'Level');
	dialogBox.append(form.order);
	if (pe) {
		form.order.setValue(pe.condition.order);
	} else {
		form.order.setValue(0);
	}

	var status = $(document.createElement('p')).appendTo(dialogBox);


	var buttons = {};
	buttons['Speichern'] = function () {
		var data = {query_id: query_id};
		for (var field in form) {
			data[field] = form[field].getValue();
		}
		if (data.comparator == 'between') {
			data.compare_value = [
				getNumericValueInput(data.value[0], query.formatting),
				getNumericValueInput(data.value[1], query.formatting)
			];
		} else {
			if(query.formatting === 'yesno') {
				data.compare_value = data.value === 'true';
			} else {
				data.compare_value = getNumericValueInput(data.value, query.formatting);
			}
		}
		data.order = parseInt(data.order ? data.order : 0);

		for (var field in form) {
			if (form[field].error) return;
		}

		console.log('data', data);
		var action = 'add_path_element';
		status.text('Erstelle ...');
		if (pe_id && pe) {
			data.pe_id = pe_id;
			action = 'edit_path_element';
			status.text('Ändere ...');
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
	if (pe) {
		buttons['Löschen'] = function () {
			status.text('Lösche ...');
			self.action('remove_path_element', {pe_id: pe_id}, status, function (data) {
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

DefinitionsManager.prototype.load = function () {
	var self = this;

	self.action('get_all_definitions', {}, self.browserDOM, function (data) {
		self.data = data;

		self.populateCategoryTreeByQueries(self.data['queries']);

		self.draw();

	});

};

DefinitionsManager.prototype.action = function (action, data, parent, callb) {
	var self = this;
	var url = '/api/ManageDefinitions';

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

		callb(data);

	}).fail(function () {
		parent.removeClass('loading');
		parent.text('Laden der Daten ist fehlgeschlagen.');
	});

};
