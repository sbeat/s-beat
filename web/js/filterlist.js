// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

/**
 * Draws a List of pages for pagination.
 * Emits on parentDOM gotoStart event with the start index on click.
 * Triggers the gotoStart initial
 * @param parentDOM
 * @constructor
 */
function FilterList(parentDOM) {
	this.parentDOM = parentDOM;
	this.listDOM = $(document.createElement('div'));

	this.available = []; // available filters for selection
	this.multiFilters = {};
	this.possibleValues = {}; // id: [list of values]

	this.filters = []; // {id, type, query, condition}
	this.drawn = false;

	FilterList.prototype.init.call(this);
}
FilterList.prototype.hasFilter = function (filter) {
	return this.filters.filter(function (d) {
		if (d.id == filter.id) return d;
		if (filter.type == 'filterElement' && d.type == 'filterElement' && d.query.q == filter.query.q) {
			return d
		}
		return false;
	})[0];
};
FilterList.prototype.addFilter = function (f) {
	if (this.hasFilter(f)) return false;
	this.filters.push(f);
	this.draw();
	this.filterChanged('add', f);
	return true;
};
FilterList.prototype.addAttributeFilter = function (id, name, group, formatting, value) {
	var o = {
		id: id,
		name: name,
		group: group,
		type: 'attribute',
		formatting: formatting,
		value: value
	};
	this.available.push(o);
	return o;
};
FilterList.prototype.addValueFilter = function (id, name, group, formatting, values, value) {
	var o = {
		id: id,
		name: name,
		group: group,
		type: 'value',
		formatting: formatting,
		value: value,
		values: values // all possible values as Dictionary
	};
	this.available.push(o);
	return o;
};
FilterList.prototype.addElementFilter = function (id, query, condition) {
	var o = {
		id: id,
		type: 'filterElement',
		query: query,
		condition: condition
	};
	this.available.push(o);
	return o;
};
FilterList.prototype.copyFilter = function(filter) {
	var newFilter = {};
	for (var key in filter) {
		newFilter[key] = filter[key];
	}
	return newFilter;
};
FilterList.prototype.sortFilters = function () {
	function get_values_for_sort(a) {
		var name = '', value = null;
		var category = '';
		if (a.type == 'attribute' || a.type == 'value') {
			name = a.displayName ? a.displayName : a.name;
			value = a.value;
			category = Array.isArray(a.group) ? a.group.join('.') : a.group;
		}
		if (a.type == 'filterElement') {
			name = a.query.name;
			category = Array.isArray(a.query.category) ? a.query.category.join('.') : a.query.category;
			value = a.condition['compare_value'];
			if (a.query.formatting == 'yesno') {
				value = a.condition['compare_value'] ? 'Ja' : 'Nein';
			}
			if (a.condition['comparator'] == 'lower') {
				return [category + '.' + name, -Infinity, value];
			}
			if (a.condition['comparator'] == 'lower_equal') {
				return [category + '.' + name, -Infinity, value];
			}
			if (a.condition['comparator'] == 'greater') {
				return [category + '.' + name, Infinity, value];
			}
			if (a.condition['comparator'] == 'greater_equal') {
				return [category + '.' + name, Infinity, value];
			}
			if (a.condition['comparator'] == 'between') {
				value = value[0];
			}
		}
		return [category + '.' + name, value];
	}

	this.available.sort(function (a, b) {
		var a_values = get_values_for_sort(a);
		var b_values = get_values_for_sort(b);
		for (var i = 0; i < a_values.length; i++) {
			var v1 = a_values[i];
			var v2 = b_values[i];
			if (v1 < v2) return -1;
			if (v1 > v2) return 1;
		}
		return 0;
	});
};
FilterList.prototype.removeFilter = function (f) {
	var found = false;
	for (var i = 0; i < this.filters.length; i++) {
		var obj = this.filters[i];
		if (obj.id == f.id) {
			found = true;
			this.filters.splice(i, 1);
			i--;
		}
	}

	this.draw();
	this.filterChanged('remove', f);
};
FilterList.prototype.replaceFilter = function (f, newFilter) {
	for (var i = 0; i < this.filters.length; i++) {
		var obj = this.filters[i];
		if (obj.id == f.id) {
			this.filters.splice(i, 1, newFilter);
			break;
		}
	}

	this.draw();
	this.filterChanged();
};
FilterList.prototype.getQueries = function (forPaths) {
	var ret = {};
	for (var i = 0; i < this.filters.length; i++) {
		var f = this.filters[i];
		if (forPaths && f.type == 'filterElement') {
			if (f.query.success) {
				if (!ret.elements) ret.elements = [];
				ret.elements.push(f.id);
			} else {
				if (!ret.filter_elements) ret.filter_elements = [];
				ret.filter_elements.push(f.id);
			}
		} else if (f.type == 'filterElement') {
			if (!ret.elements) ret.elements = [];
			ret.elements.push(f.id);
		}
		if (f.type == 'attribute') {
			ret[f.id] = f.value;
		}
		if (f.type == 'value') {
			ret[f.id] = f.value;
		}
	}

	return ret;
};
FilterList.prototype.filterChanged = function () {

};
FilterList.prototype.init = function () {
	var self = this;
	self.draw();

	this.parentDOM.droppable({
		accept: function (el) {
			if (!el.length) return false;
			return el[0].filterItem && !self.hasFilter(el[0].filterItem);
		},
		over: function (e, ui) {
			$(ui.helper).addClass('active');
		},
		out: function (e, ui) {
			$(ui.helper).removeClass('active');
		},
		drop: function (e, ui) {
			var filterItem = ui.draggable[0].filterItem;
			if (filterItem) {
				self.addFilter(filterItem);
			}
		}

	});

	/*
	 this.listDOM.sortable({
	 receive: function (e, ui) {
	 ui.item.isOut = false;
	 },
	 over: function (e, ui) {
	 ui.item.isOut = false;
	 $(ui.item).addClass('active');
	 },
	 out: function (e, ui) {
	 ui.item.isOut = true;
	 $(ui.item).removeClass('active');
	 },
	 beforeStop: function (e, ui) {
	 if (ui.item.isOut) {
	 console.log('beforeStop ', ui);
	 self.removeFilter(ui.item[0].filterItem);
	 }
	 }
	 });
	 */

};

FilterList.prototype.draw = function () {
	var self = this;
	if (!self.parentDOM.find('div').size()) {


		var fBox = $(document.createElement('div'));
		fBox.addClass('addfilter');
		fBox.text('Filter hinzufügen');
		self.parentDOM.append(fBox);
		fBox.click(function (e) {
			e.stopPropagation();
			self.drawAddFilterMenu(fBox);
		});

		self.listDOM.addClass('filters');
		self.parentDOM.append(self.listDOM);
	}

	self.listDOM.empty();
	for (var i = 0; i < self.filters.length; i++) {
		var filter = self.filters[i];
		self.listDOM.append(self.drawFilter(filter));
	}

};

FilterList.prototype.drawAddFilterMenu = function (fBox) {
	var self = this;
	var fselDOM = self.drawFilterSelection(self.available);
	fselDOM.addClass('filterMenu');
	var offset = fBox.offset();

	offset.top += fBox.outerHeight();
	fselDOM.css({'top': offset.top + 'px', 'left': offset.left + 'px'});

	fselDOM.click(function (e) {
		e.stopPropagation();
	});
	var win = $(window);

	$(document.body).append(fselDOM);

	function clickOutside() {
		fselDOM.remove();
	}

	win.one('click', clickOutside);

	fselDOM.find('a').click(function (e) {
		e.preventDefault();
		if (this.filterItem) {
			fselDOM.remove();
			var hasFilter = self.hasFilter(this.filterItem);
			var filter = hasFilter || this.filterItem;

			if (self.multiFilters[filter.id]) {
				self.openMulitValueDialog(self.multiFilters[filter.id], filter.id, function (filters) {
					for (var i = 0; i < filters.length; i++) {
						var filter = filters[i];
						if (!filter.checked && self.hasFilter(filter)) {
							self.removeFilter(filter);
						} else if (filter.checked) {
							self.addFilter(filter);
						}
					}
				});

			} else if (filter.type == 'attribute') {
				self.openValueDialog(filter, function (value) {
					if (hasFilter) {
						self.replaceFilter(filter, filter);
					} else {
						self.addFilter(filter);
					}
				});
			} else if (filter.type == 'value') {
				if(filter.value===null) {
					self.openValueDialog(filter, function (value) {
						if (hasFilter) {
							self.replaceFilter(filter, filter);
						} else {
							self.addFilter(filter);
						}
					});
				} else if (hasFilter) {
					self.replaceFilter(filter, filter);
				} else {
					self.addFilter(filter);
				}
			} else {
				self.addFilter(this.filterItem);
			}
		}

	});

};

FilterList.prototype.drawFilter = function (filter,noInteraction) {
	var self = this;

	var peBox = document.createElement('div');
	peBox.className = 'pe';
	peBox.filterItem = filter;


	var qBox = peBox.appendChild(document.createElement('div'));
	qBox.className = 'query';

	var cBox = peBox.appendChild(document.createElement('div'));
	cBox.className = 'cond';

	if(!noInteraction) {
		var deleteBox = peBox.appendChild(document.createElement('div'));
		deleteBox.className = 'delete';

		$(deleteBox).click(function (e) {
			e.stopPropagation();
			self.removeFilter(filter);
		});
	}


	peBox = $(peBox);

	if (filter.type == 'filterElement') {
		qBox.appendChild(document.createTextNode(filter.query.name));
		cBox.appendChild(document.createTextNode(getConditionText(filter.condition, filter.query.formatting)));
		qBox.title = filter.query.name;
		//$(qBox).tooltip();
		if (!noInteraction) {
			peBox.click(function (e) {
				self.openValueDialog(filter, function (newFilter) {
					self.replaceFilter(filter, newFilter);
				});
			});
		}

	} else if (filter.type == 'attribute') {
		var info = getCompareValueInfo(filter.value, filter.formatting);
		qBox.appendChild(document.createTextNode(filter.name));
		cBox.appendChild(document.createTextNode(info.text));
		qBox.title = filter.name;
		//$(qBox).tooltip();
		if (!noInteraction) {
			peBox.click(function (e) {
				self.openValueDialog(filter, function (newFilter) {
					self.replaceFilter(filter, newFilter);
				});
			});
		}

	} else if (filter.type == 'value') {
		var info = getCompareValueInfo(filter.value, filter.formatting);
		if(!info.type) {
			info.text = filter.values[filter.value];
		}
		qBox.appendChild(document.createTextNode(filter.name));
		cBox.appendChild(document.createTextNode(info.text));
		qBox.title = filter.name;
		//$(qBox).tooltip();
		if (!noInteraction) {
			peBox.click(function (e) {
				self.openValueDialog(filter, function (newFilter) {
					self.replaceFilter(filter, newFilter);
				});
			});
		}

	}


	return peBox;
};

FilterList.prototype.drawFilterSelection = function (filters) {
	var self = this;
	var parentList = document.createElement('ul');
	parentList.lists = {};
	parentList.items = {};
	function createItem(id, label, parent, filterItem) {
		var item = document.createElement('li');
		parent.appendChild(item);
		parent.items[id] = item;

		var a = document.createElement('a');
		a.href = '';
		a.appendChild(document.createTextNode(label));
		a.filterItem = filterItem;

		item.appendChild(a);

		return item;
	}

	function getList(name, parent) {
		if (!parent.lists[name]) {
			var item = createItem(name, name, parent);

			var list = document.createElement('ul');
			item.appendChild(list);

			list.items = {};
			list.lists = {};
			parent.lists[name] = list;
			return list;
		}
		return parent.lists[name];
	}

	function getListByPath(path, parent) {
		for (var i = 0; i < path.length; i++) {
			var obj = path[i];
			parent = getList(obj, parent);
		}
		return parent;
	}

	function addItem(path, id, label, filterItem) {
		var list = getListByPath(path, parentList);
		return createItem(id, label, list, filterItem);
	}

	function splitGroup(text) {
		if (Array.isArray(text)) return text;
		var parts = [];
		var s = 0, p;
		do {
			p = text.indexOf('.', s);
			if (p != -1) {
				if (text.charAt(p - 1) == '\\') continue;
				parts.push(text.substring(s, p).replace('\\', ''));
				s = p + 1;
			} else {
				parts.push(text.substring(s).replace('\\', ''));
			}

		} while (p != -1);

		return parts;
	}

	function addAttribute(group, id, item) {
		if (group == 'ignore')return;
		var path = splitGroup(group);
		addItem(path, id, item.displayName ? item.displayName : item.name, item);
	}

	function addFilterElement(group, queryid, id, item) {
		if (group == 'ignore')return;
		var path = splitGroup(group);
		path.push(queryid);
		addItem(path, id, getConditionText(item.condition, item.query.formatting), item);
	}

	function addValueElement(group, id, item) {
		if (group == 'ignore')return;
		var path = splitGroup(group);
		for (var key in item.values) {
			var text = item.values[key];
			var itemPath = path.slice();
			itemPath.push(item.name);
			var f = self.copyFilter(item);
			f.value = key;
			addItem(itemPath, id, text, f);
		}
	}

	for (var i = 0; i < filters.length; i++) {
		var f = filters[i];
		if (f.type == 'filterElement') addFilterElement(f.query.category, f.query.name, f.id, f);
		if (f.type == 'attribute') addAttribute(f.group, f.id, f);
		if (f.type == 'value') addValueElement(f.group, f.id, f);
	}

	parentList = $(parentList);
	parentList.menu();

	return parentList;
};

FilterList.prototype.drawValueSelector = function (value, formatting, sendCallb, prepend) {
	/*
	 str
	 int
	 gender      M,W
	 grade       three digit number
	 date        timestamp to format as YYYY-MM-DD
	 stg         short of a course of study
	 semester    semester id in form of [year][1|2]
	 yesno       boolean to display as yes or no
	 percent     number betwen 0.0 and 1.0 to be formatted as num*100%
	 */
	var self = this;

	var info = getCompareValueInfo(value, formatting);

	var boxO = $(document.createElement('div'));
	boxO.addClass('valueSelect');
	if (prepend) {
		boxO.append(prepend);
	}

	function drawValueInput(value, formatting) {

		if (['int', 'grade', 'percent'].indexOf(formatting) != -1) {
			var valueField = $(document.createElement('input'));
			valueField.addClass('valueField');
			valueField.on('keyup', onCheckNummeric);
			valueField.on('keyup', onCheckEnter);
			valueField.val(getNumericValueOutput(value, formatting));
			valueField.getValue = function () {
				var val = this.val();
				return getNumericValueInput(val, formatting);
			};
			setTimeout(function () {
				valueField.focus();
			}, 10);

			return valueField;
		}
		if (formatting == 'semester') {
			var valueSelect = $(document.createElement('select'));
			valueSelect.addClass('valueSelect');
			valueSelect.append('<option value="">-</option>');

			var currentYear = (new Date()).getFullYear();
			var opt;
			for (var year = currentYear; year >= 2004; year--) {

				opt = document.createElement('option');
				opt.value = (year * 10 + 2).toString();
				opt.appendChild(document.createTextNode(getSemesterText(parseInt(opt.value))));


				if (opt.value == value) opt.selected = true;
				valueSelect.append(opt);

				opt = document.createElement('option');
				opt.value = (year * 10 + 1).toString();

				//The student data is available only from the winter semester 2004/2005!!!
				if (opt.value == 20041) {
					continue;
				}

				opt.appendChild(document.createTextNode(getSemesterText(parseInt(opt.value))));
				if (opt.value == value) opt.selected = true;
				valueSelect.append(opt);
			}
			boxO.append(valueSelect);
			valueSelect.getValue = function () {
				var val = this.val();
				if (val == '') return null;
				return val;
			};
			return valueSelect;

		}
		if (formatting == 'date') {
			var dateSelect = $(document.createElement('div'));
			dateSelect.addClass('dateSelect');
			dateSelect.datepicker({
				changeYear: true,
				changeMonth: true,
				yearRange: '1960:' + (new Date()).getFullYear()
			});
			dateSelect.datepicker('setDate', new Date(value * 1000));
			dateSelect.getValue = function () {
				var val = this.datepicker('getDate');
				var date = new Date($.datepicker.formatDate('yy-mm-ddT00:00:00Z', val));
				return Math.floor(date.getTime() / 1000);
			};
			return dateSelect;
		}


	}

	function onCheckNummeric(e) {
		if (!this.value.match(/^-?[0-9,\.]*$/)) {
			this.value = this.value.replace(/[^-0-9,\.]/g, '');
			this.value = this.value.replace(/--/g, '-');
			this.value = this.value.replace(/,/g, '.');
		}
		if (this.value.match(/^(-?\d+\.\d+)/)) {
			this.value = RegExp.$1;
		}
	}

	function onCheckEnter(e) {
		if (e.which == 13) {
			sendCallb.call(boxO);
		}

	}

	function drawNumeric(value) {
		boxO.empty();
		if (prepend) {
			boxO.append(prepend);
		}
		var info = getCompareValueInfo(value, formatting);

		var opSelect = drawSelect({
			equal: 'gleich',
			gte: 'mindestens',
			lte: 'maximal',
			between: 'zwischen'
		}, info.operator);
		opSelect.className = 'comparator';
		boxO.append(opSelect);
		$(opSelect).change(function () {
			var op = this.value;
			var info = getCompareValueInfo(boxO.getValue(), formatting);

			if (info.operator == op) return;

			var useValue = info.value;
			if (useValue == '') useValue = '0';
			if (info.operator == 'between') useValue = info.minValue;
			if (op == 'equal') drawNumeric(useValue);
			else if (op == 'gte') drawNumeric(useValue + ',');
			else if (op == 'lte') drawNumeric(',' + useValue);
			else if (op == 'between') drawNumeric(useValue + ',' + useValue);

		});

		var valuesO = $(document.createElement('div'));
		valuesO.addClass('compareValue ' + info.operator);
		boxO.append(valuesO);

		if (info.operator == 'between') {
			var valueField1 = drawValueInput(info.minValue, formatting, info);
			valuesO.append(valueField1);

			var valueField2 = drawValueInput(info.maxValue, formatting);
			valuesO.append(valueField2);

			boxO.getValue = function () {
				return valueField1.getValue() + ',' + valueField2.getValue();
			};

		} else {

			var valueField = drawValueInput(info.value, formatting);
			valuesO.append(valueField);

			boxO.getValue = function () {
				if (info.operator == 'gte') return valueField.getValue() + ',';
				if (info.operator == 'lte') return ',' + valueField.getValue();
				return valueField.getValue();
			};

		}

	}

	function drawBoolean(value) {
		var info = getCompareValueInfo(value, formatting);
		var valueSelect = drawSelect({
			true: 'Ja',
			false: 'Nein'
		}, info.value);
		boxO.getValue = function () {
			return valueSelect.value;
		};
		boxO.append(valueSelect);
	}

	function drawString(value) {
		var valueField = $(document.createElement('input'));
		valueField.addClass('valueField');
		valueField.attr('type', 'text');
		valueField.on('keyup', onCheckEnter);
		valueField.val(value);
		boxO.getValue = function () {
			return valueField.val();
		};
		boxO.append(valueField);

	}

	if (info.type == 'numeric') drawNumeric(value);
	else if (info.type == 'boolean') drawBoolean(value);
	else drawString(value);

	return boxO;
};

FilterList.prototype.drawStringValueSelector = function (filter, sendCallb) {

	var self = this;
	var boxO = $(document.createElement('div'));
	boxO.addClass('filterSelect');

	var values = self.possibleValues[filter.id];

	if (values.length > 10) {
		var searchLine = $('<p/>').appendTo(boxO);
		var searchInput = $('<input type="text" class="">')
			.attr('placeholder', 'Suchen')
			.appendTo(searchLine)
			.on('keyup', function () {
				filterItems(searchInput.val());
			});

	}

	for (var i = 0; i < values.length; i++) {
		var val = values[i];
		var el = document.createElement('a');
		el.href = '';
		el.appendChild(document.createTextNode(val));
		if (val == filter.value) el.className = 'active';
		el.filterValue = val;
		boxO.append(el);
	}

	sortElements(boxO);

	var allItems = boxO.find('a');
	allItems.click(function (e) {
		e.preventDefault();
		allItems.removeClass('active');
		$(this).addClass('active');
		sendCallb.call(boxO);
	});

	function filterItems(term) {
		var regexp = new RegExp(term);
		allItems.each(function () {
			var el = $(this);
			if (el.text().match(regexp)) {
				el.show();
			} else {
				el.hide();
			}
		});

	}

	boxO.getValue = function () {
		var curr = boxO.find('a.active')[0];
		if (curr) return curr.filterValue;
		return null;
	};

	return boxO;

};

FilterList.prototype.drawValueAttributeSelector = function (filter, sendCallb) {

	var self = this;
	var boxO = $(document.createElement('div'));
	boxO.addClass('filterSelect');

	for (var val in filter.values) {
		var text = filter.values[val];
		var el = document.createElement('a');
		el.href = '';
		el.appendChild(document.createTextNode(text));
		if (val == filter.value) el.className = 'active';
		el.filterValue = val;
		boxO.append(el);
	}

	sortElements(boxO);

	var allItems = boxO.find('a');
	boxO.find('a').click(function (e) {
		e.preventDefault();
		allItems.removeClass('active');
		$(this).addClass('active');
		sendCallb.call(boxO);
	});

	boxO.getValue = function () {
		var curr = boxO.find('a.active')[0];
		if (curr) return curr.filterValue;
		return null;
	};

	return boxO;

};

FilterList.prototype.drawFilterElementSelector = function (filter, sendCallb) {
	var self = this;
	var boxO = $(document.createElement('div'));
	boxO.addClass('filterSelect');

	var filters = self.available.filter(function (f) {
		return f.query && filter.query && f.query.q == filter.query.q;
	});

	for (var i = 0; i < filters.length; i++) {
		var f = filters[i];
		var el = document.createElement('a');
		el.href = '';
		el.appendChild(document.createTextNode(getConditionText(f.condition, f.query.formatting)));
		el.filterItem = f;
		if (f.id == filter.id) el.className = 'active';
		boxO.append(el);
	}

	var allItems = boxO.find('a');
	boxO.find('a').click(function (e) {
		e.preventDefault();
		allItems.removeClass('active');
		$(this).addClass('active');
		sendCallb.call(boxO);
	});

	boxO.getValue = function () {
		var curr = boxO.find('a.active')[0];
		if (curr) return curr.filterItem;
		return filter;
	};

	return boxO;
};
/**
 * @param id
 * @param [type]
 * @returns {*}
 */
FilterList.prototype.getFilterById = function (id, type) {
	var filters = this.available.filter(function (f) {
		return f.id == id && (!type || f.type == type);
	});
	return filters[0];
};

FilterList.prototype.openMulitValueDialog = function (filter_ids, mainFilter_id, callb) {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	var mainFilter = self.getFilterById(mainFilter_id);
	if (mainFilter.type == 'filterElement') {
		dialogBox.attr('title', mainFilter.query.name);
	}
	if (mainFilter.type == 'attribute') {
		dialogBox.attr('title', mainFilter.name);
	}
	if (mainFilter.type == 'value') {
		dialogBox.attr('title', mainFilter.name);
	}

	function drawValueSelection(filter, active) {
		var selector;

		var label = document.createElement("label");
		label.className = 'multiValueLabel';
		dialogBox.append(label);

		var checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = active;
		checkbox.className = 'checkbox';

		if (filter.type == 'filterElement') {
			label.appendChild(document.createTextNode(filter.query.name));
			selector = self.drawFilterElementSelector(filter, submitMultiValueDialog);
			dialogBox.append(selector);
		}
		if (filter.type == 'attribute') {
			label.appendChild(document.createTextNode(filter.name));
			if (self.possibleValues[filter.id]) {
				selector = self.drawStringValueSelector(filter, submitMultiValueDialog);
			} else {
				selector = self.drawValueSelector(filter.value, filter.formatting, submitMultiValueDialog, checkbox);
			}
			dialogBox.append(selector);
		}
		if (filter.type == 'value') {
			label.appendChild(document.createTextNode(filter.name));
			selector = self.drawValueAttributeSelector(filter, submitMultiValueDialog);
			dialogBox.append(selector);
		}
		selector.checkbox = checkbox;
		selector.addClass('checkbox');
		return selector;
	}

	var selectors = [];

	function submitMultiValueDialog() {
		var filters = [];
		dialogBox.dialog("close");
		for (var i = 0; i < selectors.length; i++) {
			var d = selectors[i];
			if (d.filter.type == 'attribute') {
				d.filter.value = d.selector.getValue();
				d.filter.checked = d.selector.checkbox.checked;
				filters.push(d.filter);
			}
		}
		callb(filters);
	}

	for (var i = 0; i < filter_ids.length; i++) {
		var filter = self.getFilterById(filter_ids[i]);
		if (filter) {
			var selector = drawValueSelection(filter, self.hasFilter(filter) ? true : false);
			selectors.push({filter: filter, selector: selector});

		}
		else {
			console.log("Filter not found", filter_ids[i]);
		}

	}

	dialogBox.dialog({
		modal: true,
		width: 420,
		buttons: {
			OK: submitMultiValueDialog,
			Abbrechen: function () {
				$(this).dialog("close");
			},
			'Löschen': function () {
				self.removeFilter(filter);
				$(this).dialog("close");
			}
		}
	});


};


FilterList.prototype.openValueDialog = function (filter, callb) {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	var selector;
	var buttons = {};
	if (filter.type == 'filterElement') {
		dialogBox.attr('title', filter.query.name);
		selector = self.drawFilterElementSelector(filter, function () {
			callb(this.getValue());
			dialogBox.dialog("close");
		});
		dialogBox.append(selector);

		// Find user defined filter
		var udefFilter = self.getFilterById(filter.query.q, 'attribute');
		if (udefFilter) {
			buttons['Benutzerdefiniert'] = function () {
				$(this).dialog("close");
				self.openValueDialog(udefFilter, callb);
			};
		}

		buttons['OK'] = function () {
			$(this).dialog("close");
			if (selector) {
				callb(selector.getValue());
			}

		};

	}
	if (filter.type == 'attribute') {
		dialogBox.attr('title', filter.name);
		if (self.possibleValues[filter.id]) {
			selector = self.drawStringValueSelector(filter, function () {
				filter.value = this.getValue();
				callb(filter);
				dialogBox.dialog("close");
			});
		} else {
			selector = self.drawValueSelector(filter.value, filter.formatting, function () {
				filter.value = this.getValue();
				callb(filter);
				dialogBox.dialog("close");
			});
		}

		buttons['OK'] = function () {
			$(this).dialog("close");
			if (selector) {
				filter.value = selector.getValue();
				callb(filter);
			}

		};

		dialogBox.append(selector);
	}

	if (filter.type == 'value') {
		dialogBox.attr('title', filter.name);
		selector = self.drawValueAttributeSelector(filter, function () {
			filter.value = this.getValue();
			callb(filter);
			dialogBox.dialog("close");
		});

		buttons['OK'] = function () {
			$(this).dialog("close");
			if (selector) {
				filter.value = selector.getValue();
				callb(filter);
			}

		};

		dialogBox.append(selector);
	}


	buttons['Abbrechen'] = function () {
		$(this).dialog("close");
	};
	buttons['Löschen'] = function () {
		self.removeFilter(filter);
		$(this).dialog("close");
	};


	dialogBox.dialog({
		modal: true,
		width: 420,
		buttons: buttons
	});


};

