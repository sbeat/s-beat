// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function createDom(tag, classname, parent) {
	var el = document.createElement(tag);
	if (classname)
		el.className = classname;
	if (parent && parent.appendChild) {
		parent.appendChild(el);
	} else if (parent && parent.append) {
		parent.append(el);
	}
	return el;
}

function drawSelect(options, current, empty) {
	var s = document.createElement('select');
	var o;
	if (typeof(empty) != 'undefined') {
		o = document.createElement('option');
		s.appendChild(o);
		o.value = '';
		o.appendChild(document.createTextNode(empty));
	}
	var isArray = Array.isArray(options);

	for (var value in options) {
		o = document.createElement('option');
		s.appendChild(o);
		var v = options[value];
		if (isArray && typeof(v) == 'object') {
			o.value = v.value;
			o.appendChild(document.createTextNode(v.label));
		} else if (isArray) {
			o.value = v;
			o.appendChild(document.createTextNode(v));
		} else {
			o.value = value;
			o.appendChild(document.createTextNode(v));
		}

		if (o.value == current) o.selected = true;
	}

	return s;
}

function drawFormLine(type, label, desc) {
	var container = document.createElement('div');
	container.className = 'formline ' + type;

	var labelO = container.appendChild(document.createElement('label'));
	labelO.className = 'formlabel';
	labelO.appendChild(document.createTextNode(label));
	container.labelO = labelO;

	var valueO = container.appendChild(document.createElement('div'));
	valueO.className = 'formvalue';
	container.valueO = valueO;

	var errorO = container.appendChild(document.createElement('div'));
	errorO.className = 'formerror';
	errorO.style.display = 'none';
	container.errorO = errorO;

	container.error = false;
	container.setError = function (text) {
		if (text) {
			this.error = true;
			errorO.style.display = '';
			$(this.errorO).text(text);
		} else {
			this.error = false;
			errorO.style.display = 'none';
		}
	};

	if (desc && type != 'checkbox') {
		var descO = container.appendChild(document.createElement('div'));
		descO.className = 'formdesc';
		descO.appendChild(document.createTextNode(desc));

	}

	if (type == 'text') {
		var inputO = valueO.appendChild(document.createElement('input'));
		inputO.type = 'text';
		container.input = inputO;
		container.getValue = function () {
			return this.input.value;
		};
		container.setValue = function (value) {
			return this.input.value = value;
		};
	}
	if (type == 'static') {
		var spanO = valueO.appendChild(document.createElement('span'));
		container.input = spanO;
		container.getValue = function () {
			return $(this.input).text();
		};
		container.setValue = function (value) {
			return $(this.input).text(value);
		};
	}
	if (type == 'checkbox') {
		var inputContainer = valueO.appendChild(document.createElement('label'));
		var inputO = inputContainer.appendChild(document.createElement('input'));
		inputO.type = 'checkbox';
		container.input = inputO;

		if (desc) {
			inputContainer.appendChild(document.createTextNode(desc))
		}

		container.setValue = function (value) {
			this.input.checked = value;
		};
		container.getValue = function () {
			return this.input.checked;
		};

	}
	if (type == 'select') {
		var selectO = valueO.appendChild(document.createElement('select'));
		container.select = selectO;
		container.getValue = function () {
			var values = [];
			for (var i = 0; i < this.select.length; i++) {
				var option = this.select[i];
				if (this.select.multiple && option.selected) {
					if (option.value.length) {
						values.push(option.value);
					}
				}
				else if (option.selected) return option.value;
			}
			if (this.select.multiple) {
				return values;
			}
			return null;
		};
		container.setValue = function (value) {
			for (var i = 0; i < this.select.length; i++) {
				var option = this.select[i];
				if (this.select.multiple && value && value.indexOf(option.value) != -1 || !this.select.multiple && option.value == value) {
					option.selected = true;
				} else {
					option.selected = false;
				}
			}
		};
		container.setOptions = function (options, current, empty) {
			var o;
			$(this.select).empty();
			if (typeof(empty) != 'undefined') {
				o = document.createElement('option');
				this.select.appendChild(o);
				o.value = '';
				o.appendChild(document.createTextNode(empty));
			}

			var isArray = Array.isArray(options);

			for (var value in options) {
				o = document.createElement('option');
				this.select.appendChild(o);
				var v = options[value];
				if (isArray && typeof(v) == 'object') {
					o.value = v.value;
					o.appendChild(document.createTextNode(v.label));
				} else if (isArray) {
					o.value = v;
					o.appendChild(document.createTextNode(v));
				} else {
					o.value = value;
					o.appendChild(document.createTextNode(v));
				}

				if (o.value == current) o.selected = true;
			}
		};

	}

	if (type == 'multiselect') {
		var selectO = valueO.appendChild(document.createElement('span'));

		var link = $(createDom('a', '', valueO));
		link.attr('href', '');
		link.text('Hinzufügen');
		link.click(function (e) {
			e.preventDefault();

			drawOptionSelector(container.options, function (option) {
				if (container.selected.indexOf(option.value) == -1) {
					container.selected.push(option.value);
					container.setValue(container.selected);
				}
			});

		});

		container.selected = [];
		container.options = [];
		container.select = selectO;
		container.getValue = function () {
			return container.selected;
		};
		container.drawItem = function (option) {
			var item = createDom('span', 'selectitem', this.select);
			item.appendChild(document.createTextNode(option.label));

			var link = $(createDom('a', 'crossicon', item));
			link.attr('href', '');
			link.click(function (e) {
				e.preventDefault();
				var pos = container.selected.indexOf(option.value);
				if (pos != -1) {
					container.selected.splice(pos, 1);
					container.setValue(container.selected);
				}

			});

		};
		container.setValue = function (value) {
			$(this.select).empty();

			for (var i = 0; i < this.options.length; i++) {
				var option = this.options[i];
				if (value && value.indexOf(option.value) != -1) {
					if (this.selected.indexOf(option.value) == -1) {
						this.selected.push(option.value);
					}
					this.drawItem(option);

				} else {
					var pos = this.selected.indexOf(option.value);
					if (pos != -1) {
						this.selected.splice(pos, 1);
					}
				}
			}

		};
		container.setOptions = function (options, current) {
			var o;
			this.options = options;
			if (current) {
				this.setValue(current);
			}

		};

	}

	return container;
}

function drawOptionSelector(options, sendCallb) {
	var self = this;
	var boxO = $(document.createElement('div'));
	boxO.addClass('filterSelect');

	if (options.length > 10) {
		var searchLine = $('<p/>').appendTo(boxO);
		var searchInput = $('<input type="text" class="">')
			.attr('placeholder', 'Suchen')
			.appendTo(searchLine)
			.on('keyup', function () {
				filterItems(searchInput.val());
			});

	}

	for (var i = 0; i < options.length; i++) {
		var f = options[i];
		var el = document.createElement('a');
		el.href = '';
		el.appendChild(document.createTextNode(f.label));
		el.option = f;
		boxO.append(el);
	}

	var allItems = boxO.find('a');
	allItems.click(function (e) {
		e.preventDefault();
		dialogBox.dialog("close");
		sendCallb(this.option);
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

	var buttons = {};
	buttons['Abbrechen'] = function () {
		$(this).dialog("close");
	};

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Auswahl');
	dialogBox.append(boxO);

	dialogBox.dialog({
		width: 500,
		buttons: buttons,
		modal: true
	});


	return boxO;
}

function loadStorage(key, def) {
	try {
		var data = window.localStorage.getItem(key);
		if (typeof(data) == 'undefined' || data === null) return def;
		return JSON.parse(data);
	} catch (e) {
		return def;
	}
}

function saveStorage(key, value) {
	window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorage(key, value) {
	window.localStorage.removeItem(key);
}

function getByPath(path, o) {
	if (!Array.isArray(path)) path = path.split('.');
	if (!path.length) return o;
	var name = path.shift();
	if (o && typeof(o) == 'object') {
		return getByPath(path, o[name]);
	}
	return undefined;
}


function getNumericValueOutput(value, formatting) {
	if (typeof(value) == 'object' && value === null || isNaN(value)) return '';
	if (formatting == 'grade') return (Math.floor(value / 10) / 10).toFixed(1);
	if (formatting == 'percent') return (value * 100).toFixed(1);
	if (formatting == 'date') return getDateText(new Date(value * 1000));
	if (formatting == 'semester') return getSemesterText(value);
	if (formatting == 'status') return getStatusText(value);
	if (formatting == 'int' && (value % 1).toString().length > 4) return value.toFixed(2);
	return value;
}

function getNumericValueInput(value, formatting) {
	if (typeof(value) == 'string') value = value.replace(/,/g, '.');
	if (formatting == '') return null;
	if (formatting == 'grade') return Math.round(value * 100);
	if (formatting == 'percent') return value / 100;
	if (formatting == 'int') return parseInt(value);
	return value;
}

function getConditionText(condition, formatting) {
	var s = '';
	if (condition['negate'])
		s += '! ';

	if (['int', 'grade', 'percent', 'date', 'semester'].indexOf(formatting) != -1) {
		if (condition['comparator'] == 'equal')
			s += getNumericValueOutput(condition['compare_value'], formatting);
		if (condition['comparator'] == 'lower')
			s += '< ' + getNumericValueOutput(condition['compare_value'], formatting);
		if (condition['comparator'] == 'lower_equal')
			s += '<= ' + getNumericValueOutput(condition['compare_value'], formatting);
		if (condition['comparator'] == 'greater')
			s += '> ' + getNumericValueOutput(condition['compare_value'], formatting);
		if (condition['comparator'] == 'greater_equal')
			s += '>= ' + getNumericValueOutput(condition['compare_value'], formatting);
		if (condition['comparator'] == 'between')
			s += getNumericValueOutput(condition['compare_value'][0], formatting) + ' ≤x≤ '
				+ getNumericValueOutput(condition['compare_value'][1], formatting)

	} else if (formatting == 'yesno') {
		if (condition['comparator'] == 'is')
			s += condition['compare_value'] ? 'Ja' : 'Nein';
	} else {
		s += condition['compare_value'];
	}

	//s += '' + condition['comparator'] + ' ';
	//s += condition['compare_value'];
	return s;
}

/**
 str
 int
 gender      M,W
 grade       three digit number
 date        timestamp to format as YYYY-MM-DD
 stg         short of a course of study
 semester    semester id in form of [year][1|2]
 yesno       boolean to display as yes or no
 percent     number betwen 0.0 and 1.0 to be formatted as num*100%
 * @param value
 * @param formatting
 */
function getCompareValueInfo(value, formatting) {
	var ret = {
		type: null, // numeric,boolean,string
		formatting: formatting,
		dataValue: value,
		operator: 'equal',
		text: '',
		value: null
	};
	if (['int', 'grade', 'percent', 'date', 'semester'].indexOf(formatting) != -1) {
		ret.type = 'numeric';
		value = String(value);
		if (value == '' || value == 'null' || value === null) {
			ret.operator = 'equal';
			ret.value = 0;
			ret.valueOutput = '';
			ret.text = ret.valueOutput;

		} else if (value.indexOf(',') != -1) {
			var parts = value.split(',');
			if (parts.length == 2 && parts[0].length && parts[1].length) {
				ret.operator = 'between';
				ret.minValue = parseFloat(parts[0]);
				ret.maxValue = parseFloat(parts[1]);
				ret.minValueOutput = getNumericValueOutput(ret.minValue, formatting);
				ret.maxValueOutput = getNumericValueOutput(ret.maxValue, formatting);
				ret.text = ret.minValueOutput + ' ≤x≤ ' + ret.maxValueOutput;
			} else if (parts.length == 2 && parts[0].length && !parts[1].length) {
				ret.operator = 'gte';
				ret.value = parseFloat(parts[0]);
				ret.valueOutput = getNumericValueOutput(ret.value, formatting);
				ret.text = '>= ' + ret.valueOutput;
			} else if (parts.length == 2 && !parts[0].length && parts[1].length) {
				ret.operator = 'lte';
				ret.value = parseFloat(parts[1]);
				ret.valueOutput = getNumericValueOutput(ret.value, formatting);
				ret.text = '<= ' + ret.valueOutput;
			}
		} else {
			ret.operator = 'equal';
			ret.value = parseFloat(value);
			ret.valueOutput = getNumericValueOutput(ret.value, formatting);
			ret.text = ret.valueOutput;
		}

	} else if (formatting == 'yesno') {
		ret.type = 'boolean';
		if (value == 'true') {
			ret.operator = 'equal';
			ret.value = 'true';
			ret.valueOutput = 'Ja';
			ret.text = ret.valueOutput;
		} else {
			ret.operator = 'equal';
			ret.value = 'false';
			ret.valueOutput = 'Nein';
			ret.text = ret.valueOutput;
		}

	} else if (formatting == 'risk') {
		ret.type = 'risk';
		ret.operator = 'equal';
		ret.value = value;
		var valueMapping = {
			red: 'Rot',
			yellow: 'Gelb',
			green: 'Grün'
		};
		ret.valueOutput = valueMapping[value];
		ret.text = ret.valueOutput;

	} else if (formatting == 'status') {
		ret.type = 'status';
		ret.operator = 'equal';
		ret.value = value;
		ret.valueOutput = getStatusText(value);
		ret.text = ret.valueOutput;

	} else {
		ret.type = 'string';
		ret.operator = 'equal';
		ret.value = value;
		ret.text = ret.value;
	}
	return ret;
}

/**
 str
 int
 gender      M,W
 grade       three digit number
 date        timestamp to format as YYYY-MM-DD
 stg         short of a course of study
 semester    semester id in form of [year][1|2]
 yesno       boolean to display as yes or no
 percent     number betwen 0.0 and 1.0 to be formatted as num*100%
 * @param value
 * @param formatting
 */
function getFormattedHTML(value, formatting) {
	var ret;
	if (value === null || value === undefined) {
		return document.createTextNode('-');
	}
	if (formatting == 'gender') {
		ret = document.createElement('span');
		ret.className = 'gender ' + value;
		ret.appendChild(document.createTextNode(value));
		return ret;
	}
	if (formatting == 'date') {
		return document.createTextNode(value ? getDateText(new Date(value * 1000)) : '-');
	}
	if (formatting == 'stg') {
		ret = document.createElement('span');
		ret.className = 'stg ' + value;
		ret.setAttribute('data-stg', value);
		ret.appendChild(document.createTextNode(value));
		return ret;
	}
	if (formatting == 'semester' && Array.isArray(value)) {
		ret = document.createElement('span');
		var ranges = getSemesterRanges(value).map(function (range) {
			if (Array.isArray(range)) {
				return getSemesterText(range[0]) + ' - ' + getSemesterText(range[1]);
			} else {
				return getSemesterText(range);
			}
		});
		ret.appendChild(document.createTextNode(ranges.join(', ')));
		return ret;
	} else if (formatting == 'semester') {
		value = Math.floor(value);
		ret = document.createElement('span');
		ret.className = 'semester ' + (value % 10 == 1 ? 'ss' : 'ws');
		ret.setAttribute('data-semester', value);
		ret.appendChild(document.createTextNode(getSemesterText(value)));
		return ret;
	}
	if (formatting == 'risk') {
		if (!value || value.median === null)
			return document.createTextNode('-');
		ret = document.createElement('div');
		ret.className = 'riskbar';
		ret.title = (value.median_scaled * 100).toFixed(1) + '% Risiko';
		var redbar = ret.appendChild(document.createElement('div'));
		redbar.style.width = ((value.median_scaled) * 100) + '%';
		$(ret).tooltip();
		return ret;
	}
	if (formatting == 'grade') {
		return document.createTextNode(getNumericValueOutput(value, 'grade'));
	}
	if (formatting == 'percent') {
		return document.createTextNode((value * 100).toFixed(1) + '%');
	}
	if (formatting == 'yesno') {
		return document.createTextNode(value ? 'Ja' : 'Nein');
	}
	if (formatting == 'float') {
		return document.createTextNode((value).toFixed(1));
	}
	if (formatting == 'int' && (value % 1).toString().length > 4) {
		return document.createTextNode(value.toFixed(2));
	}
	if (formatting == 'status') {
		// Status 1=Finished, 2=Aborted, 3=Successful, 4=Studying
		return document.createTextNode(getStatusText(value));
	}

	return document.createTextNode(value);
}

/**
 * Generate Graph for risk values
 * @param risk
 *    risk.values
 *    risk.median
 *    risk.mean
 * @param w
 * @param h
 */
function getRiskGraph(risk, w, h) {
	var canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.heigt = h;
	var ctx = canvas.getContext('2d');

	ctx.beginPath();
	ctx.moveTo(0, h);


}

function drawRiskLights(value, setting) {
	var color = 'green';
	if (value >= setting[1]) color = 'yellow';
	if (value >= setting[2]) color = 'red';

	var lights = $('<div class="lights" />');
	$('<div class="green">').appendTo(lights);
	$('<div class="yellow">').appendTo(lights);
	$('<div class="red">').appendTo(lights);
	lights.find('.' + color).addClass('active');

	return lights;
}

function getSemesterRanges(semesters) {
	if (!semesters || !semesters.length) {
		return [];
	}
	semesters.sort();
	var last = semesters[0];
	var lastStart = last;
	var ranges = [];
	for (var i = 1; i < semesters.length; i++) {
		var value = semesters[i];
		var year = Math.floor(value / 10);
		var semnr = value % 10;
		var lastYear = Math.floor(last / 10);
		var lastSemnr = last % 10;
		if (year === lastYear && semnr === lastSemnr + 1 || year === lastYear + 1 && semnr === 1) {
			last = value;
			continue;
		}
		if (lastStart === last) {
			ranges.push(last);
		} else {
			ranges.push([lastStart, last])
		}
		lastStart = value;
		last = value;
	}
	if (lastStart === last) {
		ranges.push(last);
	} else {
		ranges.push([lastStart, last])
	}
	return ranges;
}

function addSemester(semester, count) {
	var year = Math.floor(semester / 10);
	var type = semester % 10; // 1=SS, 2=WS
	if (count === 0) {
		return semester;
	} else if (count === 1 && type === 1) {
		return year * 10 + 2;
	} else if (count === 1 && type === 2) {
		return (year + 1) * 10 + 1;
	} else if (count === -1 && type === 1) {
		return (year - 1) * 10 + 2;
	} else if (count === -1 && type === 2) {
		return year * 10 + 1;
	} else {
		var iterations = Math.abs(count);
		for (var i = 0; i < iterations; i++) {
			semester = addSemester(semester, count / iterations);
		}
	}
	return semester;
}

function getStatusText(value) {
	var valueMapping = {
		1: 'Abgeschlossen',
		2: 'Abgebrochen',
		3: 'Erfolgreich',
		4: 'Studierend'
	};
	return valueMapping[value] ? valueMapping[value] : 'Unbekannt';
}

function getSemesterText(value) {
	var year = Math.floor(value / 10);
	var semnr = value % 10;
	var ret = '';

	if (semnr == 1) ret = 'SoSe ' + year;
	if (semnr == 2) {
		var sndyear = (year + 1) % 100;
		var fstyear = year % 100;
		ret = 'WiSe ' + (fstyear < 10 ? '0' + fstyear : fstyear) + '/' + (sndyear < 10 ? '0' + sndyear : sndyear);
	}
	return ret;
}

function getDateText(dt) {
	var day = dt.getDate();
	if (isNaN(day)) {
		return '-';
	}
	var month = dt.getMonth() + 1;
	var year = dt.getFullYear();
	var ret = '';
	ret += day < 10 ? '0' + day : day;
	ret += '.';
	ret += month < 10 ? '0' + month : month;
	ret += '.';
	ret += year;
	return ret;
}

function getDateTimeText(dt) {
	var hour = dt.getHours();
	if (isNaN(hour)) {
		return '-';
	}
	var minute = dt.getMinutes();
	var sec = dt.getSeconds();
	var ret = getDateText(dt) + ' ';
	ret += hour < 10 ? '0' + hour : hour;
	ret += ':';
	ret += minute < 10 ? '0' + minute : minute;
	ret += ':';
	ret += sec < 10 ? '0' + sec : sec;
	return ret;
}

function getMonthsText(month) {

	var text = "";
	var years = 0;
	var months = 0;

	if (month < 12) {
		return month + " Monate";
	}
	else {
		years = Math.floor(month / 12);
		months = month % 12;
		text += years + ' ' + (years > 1 ? 'Jahre' : 'Jahr');
		if (months > 0) {
			text += " und " + months + ' ' + (months > 1 ? 'Monate' : 'Monat');
		}
	}
	return text;
}

function getTimeOutput(timeval) {
	var time = {};
	var s = Math.floor(timeval);
	//time.d = Math.floor(s / 86400);
	//s -= time.d * 86400;
	time.h = Math.floor(s / 3600);
	s -= time.h * 3600;
	time.i = Math.floor(s / 60);
	s -= time.i * 60;
	time.s = s;

	return time.h + 'h ' + time.i + 'm ' + time.s + 's';
}

function getBytesOutput(bytes, r) {
	var ret = bytes;
	var symbol = 'B';
	if (ret > 1024) {
		ret /= 1024;
		symbol = 'KB'
	}
	if (ret > 1024) {
		ret /= 1024;
		symbol = 'MB'
	}
	if (ret > 1024) {
		ret /= 1024;
		symbol = 'GB'
	}
	return ret.toFixed(r || 0) + symbol
}

function numTd(num) {
	var parts = String(num).split('.');
	var n = parts[0];
	var ret = '';
	var ri = 1;
	for (var i = n.length - 1; i >= 0; i--, ri++) {
		ret = n[i] + ret;
		if (ri % 3 == 0 && i) ret = ',' + ret;
	}
	if (parts[1] !== undefined) ret += '.' + parts[1];
	return ret;
}

function randomString(len) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i = 0; i < len; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum, rnum + 1);
	}
	return randomstring;
}

function getUserRole() {
	return $(document.body).attr('data-user-role') || 'guest';
}

function getUserName() {
	return $(document.body).attr('data-user-name') || 'guest';
}


/**
 * Parses a query string to an object
 * @param txt
 * @returns {{}}
 */
function parseQuery(txt) {
	txt = String(txt || location.href);
	var pq = txt.indexOf('?');
	if (pq != -1) txt = txt.substr(pq + 1);
	var query = {};
	var p = -1;
	var s = 0;
	var name = null;
	do {
		p = txt.indexOf('=', s);
		if (p != -1) {
			name = decodeURIComponent(txt.substring(s, p).trim());
			s = p + 1;
			p = txt.indexOf('&', s);
			if (p != -1) {
				query[name] = decodeURIComponent(txt.substring(s, p));
				s = p + 1;
			} else {
				query[name] = decodeURIComponent(txt.substring(s));
			}
		}
	} while (p != -1);

	return query;
}

function addToSet(arr, item) {
	if (Array.isArray(arr) && arr.indexOf(item) === -1) {
		arr.push(item);
	}
}

function removeFromSet(arr, item) {
	if(Array.isArray(arr)) {
		var i = arr.indexOf(item);
		if(i !== -1) {
			arr.splice(i, 1);
		}
	}
}

function removeDataColumn(name) {
	if (this.columnData[name]) {
		delete this.columnData[name];
	}

	removeFromSet(this.columns, name);

	if(this.settings) {
		for(var key in this.settings) {
			if(this.settings.hasOwnProperty(key) && this.settings[key]) {
				removeFromSet(this.settings[key].columns, name);
			}
		}
	}
}

function openColumnDialog() {
	var self = this;
	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Spaltenauswahl');

	$(document.createElement('p')).text(
		'Die ausgewählten Spalten können per Drag & Drop sortiert werden.').appendTo(dialogBox);


	function drawRow(col) {
		if (col.presets && col.presets.indexOf(self.settingId) == -1) return null;

		var boxO = document.createElement('li');
		boxO.className = 'colrow';
		boxO.colId = col.id;

		var labelO = boxO.appendChild(document.createElement('label'));

		var checkO = labelO.appendChild(document.createElement('input'));
		checkO.className = 'name';
		checkO.type = 'checkbox';

		checkO.checked = self.columns.indexOf(col.id) != -1;
		if (self.mandatoryColumns.indexOf(col.id) != -1) {
			checkO.disabled = true;
		}

		if (checkO.checked) {
			boxO.className += ' sortable';
			var orderBox = document.createElement('div');
			orderBox.className = 'orderbox';
			boxO.appendChild(orderBox);
		}

		labelO.appendChild(document.createTextNode(col.label));

		return boxO;
	}

	var ul = $(document.createElement('ul'));
	ul.addClass('columnlist');
	var i, col;
	for (i = 0; i < this.columns.length; i++) {
		col = self.columnData[self.columns[i]];
		ul.append(drawRow(col));
	}
	var columnsSorted = Object.keys(self.columnData);
	columnsSorted.sort(function (a, b) {
		var cola = self.columnData[a];
		var colb = self.columnData[b];
		if (cola.label < colb.label) return -1;
		if (cola.label > colb.label) return 1;
		return 0;
	});
	for (var j = 0; j < columnsSorted.length; j++) {
		var colId = columnsSorted[j];
		if (self.columns.indexOf(colId) == -1) {
			ul.append(drawRow(self.columnData[colId]));
		}
	}

	dialogBox.append(ul);

	ul.sortable();

	dialogBox.dialog({
		width: 400,
		maxHeight: 500,
		modal: true,
		buttons: {
			OK: function () {

				for (var i = 0; i < self.columns.length; i++) {
					self.columns.splice(i, 1);
					i--;
				}

				var colIds = [];
				$(this).find('li').each(function () {
					var checkO = $('input', this)[0];
					if (checkO.checked)
						self.columns.push(this.colId);
				});

				self.saveSettings();

				self.draw();

				$(this).dialog("close");

			},
			'Abbrechen': function () {
				$(this).dialog("close");
			}
		}
	});

}


function openSettingsDialog() {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Einstellungen');

	var label, p;
	if (self.pagination) {
		if (self.pagination.limit) {
			p = document.createElement('p');
			p.className = 'optionset';
			dialogBox.append(p);
			label = document.createElement('label');
			p.appendChild(label);
			label.appendChild(document.createTextNode('Limit'));
			var limitSelect = drawSelect({
				'10': '10',
				'20': '20',
				'30': '30',
				'50': '50',
				'100': '100',
				'500': '500',
				'1000': '1000'
			}, self.pagination.limit);
			p.appendChild(limitSelect);
		}


		p = document.createElement('p');
		p.className = 'optionset';
		dialogBox.append(p);
		label = document.createElement('label');
		p.appendChild(label);
		label.appendChild(document.createTextNode('Primäre Sortierung'));
		var sortSelect1 = drawSelect(self.pagination.sortOptions, self.pagination.sort1);
		sortElements($(sortSelect1), true);
		p.appendChild(sortSelect1);

		p = document.createElement('p');
		p.className = 'optionset';
		dialogBox.append(p);
		label = document.createElement('label');
		p.appendChild(label);
		label.appendChild(document.createTextNode('Sekundäre Sortierung'));
		var sortSelect2 = drawSelect(self.pagination.sortOptions, self.pagination.sort2, 'keine');
		sortElements($(sortSelect2), true);
		p.appendChild(sortSelect2);
	}

	if (self.graphMode) {
		p = document.createElement('p');
		p.className = 'optionset';
		dialogBox.append(p);
		label = document.createElement('label');
		p.appendChild(label);
		label.appendChild(document.createTextNode('Diagramm Modus'));
		var graphModeSelect = drawSelect({
			'relative': 'Relative Werte',
			'absolute': 'Absolute Werte'
		}, self.graphMode);
		sortElements($(graphModeSelect), true);
		p.appendChild(graphModeSelect);
	}


	if (self.settingsServerSaveable) {
		p = $(document.createElement('p')).text(
			'Die aktuellen Einstellungen und die Filterauswahl können unter einem Namen gespeichert werden.  ').appendTo(dialogBox);
		$('<a href=""/>').text('Einstellungen laden').appendTo(p).click(function (e) {
			e.preventDefault();
			self.openLoadSettingsDialog();
		});


		var settingIdSelect = null, settingName = null;

		getSortedListSettings(self.settingsPrefix, function (list) {
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
				if (val && val != 'new') {
					settingName.value = idseljQ.find(':selected').text();
				}
				if (val || val == 'new') {
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
	}


	var buttons = {
		Speichern: function () {

			if (self.pagination.limit) {
				self.pagination.limit = parseInt(limitSelect.value);
			}
			self.pagination.sort1 = sortSelect1.value;
			self.pagination.sort2 = sortSelect2.value;

			if (self.graphMode) {
				self.graphMode = graphModeSelect.value;
			}

			if (self.settingsServerSaveable) {
				var idseljQ = $(settingIdSelect);
				var settingId = idseljQ.val();
				if (settingId) {
					if (settingId == 'new') {
						settingId = self.settingsPrefix + '<new>';
					}

					if (!settingName.value.length) {
						settingName.className = (settingName.className || '') + ' error';
						return;
					}

					dialogBox.addClass('loading');
					self.saveSettings(settingId, settingName.value, function (data) {
						dialogBox.removeClass('loading');
						if (data && data.status == 'ok') {
							dialogBox.dialog("close");
							self.pagination.changed();

						} else if (data && data.error == 'already_exists' && data.id) {
							loadServerSettings('list', function (settings) {
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

					});


				} else {
					dialogBox.dialog("close");
					self.pagination.changed();
				}
			} else {
				dialogBox.dialog("close");
				self.pagination.changed();
			}


		},
		'Zurücksetzen': function () {
			self.pagination.setStart(0);

			if (self.pagination.onReset) self.pagination.onReset();

			$(this).dialog("close");
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


}

function openLoadSettingsDialog() {
	var self = this;

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Gespeicherte Einstellungen auswählen');

	var entriesBox = $(document.createElement('div')).appendTo(dialogBox);

	function drawSetting(setting) {
		var box = $(document.createElement('div')).addClass('settingbox');

		var i;
		var frow = $(document.createElement('div')).addClass('titlerow').appendTo(box);
		var colrow = $(document.createElement('div')).addClass('colrow').appendTo(box);
		var filterrow = $(document.createElement('div')).addClass('filters').appendTo(box);

		$('<span/>').text(setting.name).appendTo(frow);
		frow.append(' ');
		$('<a/>')
			.attr('href', location.pathname + '?ssid=' + setting.id)
			.text('Laden')
			.appendTo(frow);

		if (setting.columns) {
			for (i = 0; i < setting.columns.length; i++) {
				var column = setting.columns[i];
				var col = self.columnData[column];
				var colitem = $('<span/>')
					.addClass('colitem')
					.attr('title', col.title)
					.text(col.label)
					.appendTo(colrow);

				var sortField = col.sortBy ? col.sortBy : col.id;
				if (setting.sort1 == sortField + ',1') colitem.addClass('asc');
				if (setting.sort1 == sortField + ',-1') colitem.addClass('desc');
				if (setting.sort2 == sortField + ',1') colitem.addClass('asc2');
				if (setting.sort2 == sortField + ',-1') colitem.addClass('desc2');

			}
		}
		if (setting.filters) {
			for (i = 0; i < setting.filters.length; i++) {
				var filter = setting.filters[i];
				filterrow.append(self.filter.drawFilter(filter, true));
			}
		}


		return box;
	}

	getSortedListSettings(self.settingsPrefix, function (list) {

		if (list && list.length) {
			for (var i = 0; i < list.length; i++) {
				var setting = list[i];
				entriesBox.append(drawSetting(setting));
			}
		} else {
			$('<p>').text('Es sind keine gespeiherten Einstellungen vorhanden.').appendTo(entriesBox);
		}


	});


	dialogBox.dialog({
		width: 600,
		modal: true
	});
}

function loadPresetSettings() {
	var settings = this.settings[this.settingId] || this.settings['default'];
	if (typeof(settings.limit) != 'undefined')
		this.pagination.limit = settings.limit;

	if (typeof(settings.sort1) != 'undefined')
		this.pagination.sort1 = settings.sort1;

	if (typeof(settings.sort2) != 'undefined')
		this.pagination.sort2 = settings.sort2;

	if (typeof(settings.columns) != 'undefined' && this.filter)
		this.filter.filters = settings.filters;

	if (typeof(settings.columns) != 'undefined')
		this.columns = settings.columns.slice();

	if (typeof(settings.rows) != 'undefined')
		this.rows = settings.rows.slice();

	if (typeof(settings.displayFilters) != 'undefined')
		this.displayFilters = settings.displayFilters;

	if (typeof(settings.displayPagination) != 'undefined')
		this.displayPagination = settings.displayPagination;

	if (typeof(settings.displayStats) != 'undefined')
		this.displayStats = settings.displayStats;

	if (typeof(settings.sortable) != 'undefined')
		this.sortable = settings.sortable;

}

function loadSettings(settings) {
	if (!settings) {
		settings = loadStorage(this.settingsPrefix + this.settingId);
	}
	if (this.loadPresetSettings) {
		this.loadPresetSettings(this.settingId);
	}
	if (!settings || settings.rev !== this.settingsRev) {
		return;
	}
	if (settings.filters) {
		this.filter.filters = settings.filters;
	}
	if (settings.limit) {
		this.pagination.limit = settings.limit;
	}
	if (settings.sort1) {
		this.pagination.sort1 = settings.sort1;
	}
	if (settings.sort2) {
		this.pagination.sort2 = settings.sort2;
	}
	if (settings.columns) {
		this.columns = settings.columns;
	}
	if (this.settingsFields) {
		for (var i = 0; i < this.settingsFields.length; i++) {
			var field = this.settingsFields[i];
			if (settings[field] !== undefined) {
				this[field] = settings[field];
			}
		}
	}

}

function saveSettings(serverSettingId, name, callb) {
	var self = this;
	var settings = loadStorage(this.settingsPrefix + this.settingId, {});
	settings.rev = this.settingsRev;
	if (this.filter) {
		settings.filters = this.filter.filters;
	}
	if (typeof(this.pagination) != 'undefined') {
		settings.limit = this.pagination.limit;
		settings.sort1 = this.pagination.sort1;
		settings.sort2 = this.pagination.sort2;
	}

	if (this.columns) {
		settings.columns = this.columns;
	}
	if (this.settingsFields) {
		for (var i = 0; i < this.settingsFields.length; i++) {
			var field = this.settingsFields[i];
			settings[field] = this[field];
		}
	}
	if (name) {
		settings.name = name;
	}

	saveStorage(this.settingsPrefix + this.settingId, settings);

	if (!serverSettingId) return;

	setServerSetting('list', serverSettingId, settings, callb);

}

function removeSettings() {
	removeStorage(this.settingsPrefix + this.settingId);
}

var loadedServerSettings = {};

function loadServerSettings(type, callb) {
	if (loadedServerSettings[type]) {
		callb(loadedServerSettings[type]);
		return;
	}
	var url = '/api/GetSettings';
	var params = [];
	params.push('type=' + type);
	if (params.length) url += '?';
	url += params.join('&');

	$.ajax({
		url: url
	}).success(function (data) {
		if (data.settings) {
			// Globally save settings, cache settings in browser
			loadedServerSettings[type] = data.settings;

			if (typeof(callb) == 'function') callb(loadedServerSettings[type]);
		} else {
			if (typeof(callb) == 'function') callb(null);
		}


	}).fail(function () {
		if (typeof(callb) == 'function') callb(null);
	});

}

function getServerSetting(type, id, callb) {
	if (loadedServerSettings[type] && typeof(loadedServerSettings[type][id]) != 'undefined') {
		callb(loadedServerSettings[type][id]);
		return;
	}
	var url = '/api/GetSettings';
	var params = [];
	params.push('type=' + type);
	params.push('id=' + id);
	if (params.length) url += '?';
	url += params.join('&');

	$.ajax({
		url: url
	}).success(function (data) {
		if (data.settings) {
			if (typeof(callb) == 'function') callb(data.settings[id]);
		} else {
			if (typeof(callb) == 'function') callb(null);
		}


	}).fail(function () {
		if (typeof(callb) == 'function') callb(null);
	});

}

function setServerSetting(type, id, value, callb) {
	var data = {
		id: id,
		data: value,
		type: type
	};

	var url = '/api/SaveSettings';
	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify(data)
	}).success(function (data) {
		if (data && data.status == 'ok') {
			loadedServerSettings[type] = null;
		}
		if (typeof(callb) == 'function') callb(data);

	}).fail(function () {
		if (typeof(callb) == 'function') callb(null);
	});

}

function getSortedListSettings(prefix, callb) {
	loadServerSettings('list', function (settings) {
		if (!settings) {
			callb(null);
			return;
		}

		var list = [];
		for (var id in settings) {
			if (id.indexOf(prefix) == 0) {
				settings[id].id = id;
				list.push(settings[id]);
			}
		}

		list.sort(function (a, b) {
			if (a.name < b.name) return -1;
			if (a.name > b.name) return 1;
			return 0;
		});

		callb(list);
	});

}

function drawTableHead(tr, tooltipPrefix) {
	var i;
	for (i = 0; i < this.columns.length; i++) {
		var col = this.columns[i];
		var cd = col && col.cdId ? this.columnData[col.cdId] : this.columnData[col];
		if (!cd) continue;
		var th = $(document.createElement('th'));
		th[0].colId = cd.id;

		var thbox = $(document.createElement('div'));
		th.append(thbox);

		var thlabel = $(document.createElement('span'));
		thbox.append(thlabel);
		if (this.getColumnLabel) {
			thlabel.append(this.getColumnLabel(col));
		} else {
			thlabel.text(cd.label);
		}
		thlabel.attr('title', cd.title);

		var extended_tooltip = $('#' + tooltipPrefix + cd.id);
		if (extended_tooltip.size()) {
			thlabel.tooltip({content: extended_tooltip.html()});
		} else {
			thlabel.tooltip();
		}

		var sortField = cd.sortBy ? cd.sortBy : cd.id;
		var sort1 = null;
		var sort2 = null;
		if (this.pagination) {
			sort1 = this.pagination.sort1;
			sort2 = this.pagination.sort2;
		}
		if (this.sort1) {
			sort1 = this.sort1;
		}
		if (this.sort2) {
			sort2 = this.sort2;
		}
		if (sort1 == sortField + ',1') th.addClass('asc');
		if (sort1 == sortField + ',-1') th.addClass('desc');
		if (sort2 == sortField + ',1') th.addClass('asc2');
		if (sort2 == sortField + ',-1') th.addClass('desc2');


		tr.append(th);

	}
}


function sortElements(parent, caseStable) {
	var childs = parent.children();
	childs.sort(function (a, b) {
		var an = caseStable ? $(a).text() : $(a).text().toLowerCase();
		var bn = caseStable ? $(b).text() : $(b).text().toLowerCase();
		if (an < bn) return -1;
		if (an > bn) return 1;
		return 0;
	});
	childs.each(function () {
		parent.append(this);
	});
}

function sortByField(arr, field, dir) {
	if (!dir) dir = 1; // 1=asc, -1=desc
	arr.sort(function (a, b) {
		var vA = a ? a[field] : null;
		var vB = b ? b[field] : null;
		if (vA < vB) return -1 * dir;
		if (vA > vB) return 1 * dir;
		return 0;
	});
}

function scrollVisible(el) {
	var poff = el.parent().offset();
	var currpos = 0;
	$(window).scroll(function () {
		var sy = window.scrollY;
		if (sy > poff.top) {
			currpos = sy - poff.top;
			el.css({'margin-top': currpos + 'px'});
		} else if (currpos) {
			currpos = 0;
			el.css({'margin-top': currpos + 'px'});
		}
	});
}

function defineFD(fieldData, id, label, title, formatting) {
	fieldData[id] = {id: id, label: label, title: title, formatting: formatting};
}

function adjustTableHeaders(table) {
	table.find("th").each(function (index) {
		var th = $(this);
		th.find("span").css({
			"width": "auto",
			"overflow": "hidden"
		});
		th.find("span").css({
			"width": th.width() + "px",
			"overflow": "hidden"
		});
	});
}

function isTempActive() {
	return loadStorage('isTempActive', false);
}

function displayTempDataHeader() {
	if (!isTempActive()) {
		$('#tempMessage').remove();
		return;
	}

	var box = $('<div id="tempMessage" class="toperror"></div>');
	$('#website').prepend(box);

	$('<span/>').text('Temporärere Datenansicht aktiv. ').appendTo(box);
	$('<a href=""/>').text('Deaktivieren').appendTo(box)
		.click(function (e) {
			e.preventDefault();
			saveStorage('isTempActive', false);
			location.reload();
		});

}

function openLogoutDialog() {

	var dialogBox = $(document.createElement('div'));
	dialogBox.attr('title', 'Logout');

	var textBox = $(document.createElement('p')).appendTo(dialogBox);
	textBox.text('Bitte schließen Sie den Browser um sich abzumelden. Dadurch wird Ihre Sitzung beendet.');


	dialogBox.dialog({
		width: 400,
		modal: true
	});
}

$(function onReady() {

	/*$(".tbl").each(function () {
	 adjustTableHeaders($(this));
	 });*/

	displayTempDataHeader();

	$(window).bind("resize", function () {
		$(".tbl").each(function () {
			adjustTableHeaders($(this));
		});
	});
	/*$('[data-scrollVisible]').each(function(){
	 scrollVisible($(this));
	 });*/

	$('[data-toggle]').each(function () {
		var element = $(this);
		var targetId = element.attr('data-toggle');
		var target = $('#' + targetId);
		if (target.is(':visible')) {
			element.addClass('visible');
		} else {
			target.attr('data-asyncload', '1');
		}
		element.click(function (e) {
			e.preventDefault();
			if (target.is(':visible')) {
				element.removeClass('visible');
				target.hide();
			} else {
				element.addClass('visible');
				target.show();
				target.trigger('show');
			}
		});

	});

	$('[data-load]').each(function () {
		var element = $(this);
		var loadName = element.attr('data-load');
		if (typeof(window[loadName]) == 'function') {
			new window[loadName](element);
		}
	});

	$('[data-config]').each(function () {
		var element = $(this);
		var configName = element.attr('data-config');
		var value = getByPath(configName, CONFIG);
		element.text(value);
	});

});

$.extend($.ui.tooltip.prototype.options, {
	show: 100,
	hide: 100
});
