// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

var studentsInfo = null;
var definitions = null;


var studentsStart = 0;

function addFilter(preField, preValue) {

	var filterContainer = $('#filter');
	var filters = filterContainer.find('.filters');
	var box = $(document.createElement('div'));
	box.attr('data-filter', '');
	var select = $(document.createElement('select'));
	box.append(select);
	var input = $(document.createElement('input'));
	box.append(input);
	if (typeof(preValue) != 'undefined') {
		input.val(preValue);
	}

	var option = $(document.createElement('option'));
	select.append(option);

	for (var query_id in definitions['queries']) {
		var query = definitions['queries'][query_id];
		option = $(document.createElement('option'));
		select.append(option);
		option.val(query.q);
		option.text(query.name);
		if (preField == query.q) option.attr('selected', true);
	}

	var remove = $(document.createElement('button'));
	box.append(remove);
	remove.text('X');
	remove.click(function () {
		box.remove();
	});

	filters.append(box);

}

function getStorage(key, def) {
	try {
		return JSON.parse(window.localStorage.getItem(key));
	} catch (e) {
		return def;
	}
}
function setStorage(key, value) {
	return window.localStorage.setItem(key, JSON.stringify(value));
}

function initFilters() {
	var filterContainer = $('#filter');
	var button = filterContainer.find('[data-action=go]');
	button.click(loadStudents);

	button = filterContainer.find('[data-action=add_filter]');
	button.click(function (e) {
		e.preventDefault();
		console.log('add filter');
		addFilter();
	});

	var filters = getStorage('apitest_filters');
	for (var name in filters) {
		addFilter(name, filters[name]);
	}

}

function getFilters() {
	var filterContainer = $('#filter');
	var filters = filterContainer.find('[data-filter]');

	var result = {};
	filters.each(function () {
		var el = $(this);
		var select = el.find('select');
		var input = el.find('input');

		var field = select.val();
		var value = input.val();

		if (field) {
			result[field] = value;
		}

	});

	return result;
}

function loadStudents() {
	var url = '/api/GetStudents';

	var filters = getFilters();
	setStorage('apitest_filters', filters);

	var params = [];
	for (var name in filters) {
		params.push(name + '=' + encodeURIComponent(filters[name]));
	}

	params.push('start=' + studentsStart);

	if (params.length) url += '?';
	url += params.join('&');

	$.ajax({
		url: url
	}).success(function (data) {
		studentsInfo = data;
		drawStudents();

	}).fail(function () {

	})

}

function loadDefinitions() {
	var url = '/api/GetDefinitions';

	$.ajax({
		url: url
	}).success(function (data) {
		definitions = data;
		initFilters();
	}).fail(function () {

	})

}

function getDateText(dt) {
	var ret = '';
	ret += dt.getDate();
	ret += '.';
	ret += (dt.getMonth() + 1);
	ret += '.';
	ret += (dt.getFullYear());

	return ret;
}

function drawPagination() {
	var pages = Math.floor(studentsInfo.count / studentsInfo.limit) + 1;
	var current = Math.floor(studentsInfo.start / studentsInfo.limit) + 1;
	var maxPages = 40;
	var pagesStart = Math.floor(current - maxPages / 2);
	if (pagesStart < 0) pagesStart = 0;
	var pagesEnd = maxPages;
	if (pages < pagesEnd) pagesEnd = pages;

	var a;

	var pagesContainer = $('[data-pages]');
	pagesContainer.empty();

	if (current > 1) {
		a = $(document.createElement('a'));
		pagesContainer.append(a);
		pagesContainer.append(' ');
		a.attr('href', '');
		a.text('Previous');
		a[0].start = (current - 2) * studentsInfo.limit;
		a.click(gotoPage);
	}

	for (var i = pagesStart; i < pagesStart + pagesEnd; i++) {
		a = $(document.createElement('a'));
		pagesContainer.append(a);
		pagesContainer.append(' ');

		if (i + 1 == current) a.addClass('active');

		a.attr('href', '');
		a.text(i + 1);
		a[0].start = i * studentsInfo.limit;
		a.click(gotoPage);


	}

	if (current < pages) {
		a = $(document.createElement('a'));
		pagesContainer.append(' ');
		pagesContainer.append(a);
		a.attr('href', '');
		a.text('Next');
		a[0].start = (current) * studentsInfo.limit;
		a.click(gotoPage);
	}

	function gotoPage(e) {
		e.preventDefault();
		studentsStart = this.start;
		loadStudents();
	}

}

function drawStudents() {
	drawPagination();

	$('[data-students]').each(function () {
		var el = $(this);
		var field = el.attr('data-students');

		if (typeof(studentsInfo[field]) != 'undefined') {
			el.text(studentsInfo[field]);
		}

	});


	var table = $('#studentsTable');
	var thead = table.find('thead');
	var tbody = table.find('tbody');
	thead.empty();
	tbody.empty();

	var headers = null;

	function createHeaders(d) {
		headers = [];
		var tr = $(document.createElement('tr'));
		for (var name in d) {
			var th = $(document.createElement('th'));
			th.text(name);
			tr.append(th);
			headers.push(name);
		}
		thead.append(tr);

	}

	function createRow(d, tr, i) {
		d.nr = parseInt(i) + studentsInfo.start + 1;
		if (!headers) createHeaders(d);


		headers.forEach(function (field) {
			var value = d[field];
			var td = $(document.createElement('td'));

			if (field.indexOf('date') != -1 && value) {
				var dt = new Date(value * 1000);
				td.text(getDateText(dt));

			}
            else if(typeof(value)=="object"){
                td.text(JSON.stringify(value))

            }
            else {
				td.text(value);
			}


			tr.append(td);
		});


	}

	for (var i = 0; i < studentsInfo.list.length; i++) {
		var d = studentsInfo.list[i];
		var tr = $(document.createElement('tr'));
		createRow(d, tr, i);
		tbody.append(tr);
	}


}

$(function onAPITestReady() {
	loadDefinitions();

});