// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

/**
 * Draws a List of pages for pagination.
 * Emits on parentDOM gotoStart event with the start index on click.
 * Triggers the gotoStart initial
 * @param parentDOM
 * @constructor
 */
function Pagination(parentDOM) {
	this.parentDOM = parentDOM;
	this.secondaryDOM = null;
	this.pagesBox = $(document.createElement('div')).appendTo(parentDOM);
	this.miscBox = $(document.createElement('div')).addClass('pageInfo').appendTo(parentDOM);
	this.infoBox = $(document.createElement('span')).appendTo(this.miscBox);
	this.linkBox = $(document.createElement('span')).appendTo(this.miscBox);

	this.count = 0;
	this.limit = 0;
	this.start = 0;
	this.maxPages = 8;
	this.displayStats = true;
	this.onReset = null;

	this.sortOptions = {};
	this.sort1 = null;
	this.sort2 = null;

	Pagination.prototype.init.call(this);
}
Pagination.prototype.init = function () {
	var self = this;

	if (location.href.match(/#start_(\d+)/)) {
		this.start = parseInt(RegExp.$1);
	}


};
Pagination.prototype.setStart = function (start) {
	this.start = start;
	if (location.href.match(/#start_(\d+)/)) {
		if(parseInt(RegExp.$1) != start) {
			location.href = '#start_'+start;
		}
	}
};
Pagination.prototype.update = function (data) {
	if (!data) return;
	if (typeof(data['count']) == 'number') this.count = data['count'];
	if (typeof(data['limit']) == 'number') this.limit = data['limit'];
	if (typeof(data['start']) == 'number') this.start = data['start'];
};
Pagination.prototype.addLink = function (label,click) {
	this.linkBox.append(' ');
	var setBtn = $(document.createElement('a'));
	setBtn.attr('href', '');
	setBtn.text(label);
	setBtn.click(function (e) {
		e.preventDefault();
		click();
	});
	this.linkBox.append(setBtn);
};
Pagination.prototype.draw = function () {
	var self = this;

	self.drawPages(self.pagesBox);

	if (self.secondaryDOM) {
		self.drawPages(self.secondaryDOM);
	}

	if (self.displayStats) {
		var lastNum = self.start + self.limit;
		if (lastNum > self.count) lastNum = self.count;

		if (self.count) {
			self.infoBox.html('<b>' + (self.start + 1) + '</b> - <b>' + lastNum + '</b> von <b>' + self.count + '</b>');
		} else {
			self.infoBox.html('<b>' + (self.start) + '</b> - <b>' + lastNum + '</b> von <b>' + self.count + '</b>');
		}

	}

};

Pagination.prototype.drawPages = function (pagesContainer) {
	var self = this;

	var pages = Math.ceil(self.count / self.limit);
	var current = Math.floor(self.start / self.limit) + 1;
	var maxPages = self.maxPages;
	var pagesStart = Math.floor(current - maxPages / 2);
	if (pagesStart < 0) pagesStart = 0;
	var pagesEnd = pagesStart + maxPages + 1;
	if (pagesEnd > pages) {
		pagesEnd = pages;
		pagesStart = pagesEnd - maxPages;
		if (pagesStart < 0) pagesStart = 0;
	}
	if (pages < pagesEnd) pagesEnd = pages;


	var a;

	pagesContainer.empty();

	if (current >= maxPages - 1) {
		a = $(document.createElement('a'));
		pagesContainer.append(a);
		pagesContainer.append(' ');
		a.text('<');
		a[0].start = (current - 2) * self.limit;
		a.attr('href', '#start_' + a[0].start);
		a.click(gotoPage);
	}

	if (pagesStart >= maxPages) {
		a = $(document.createElement('a'));
		pagesContainer.append(a);
		pagesContainer.append(' ');
		a.text(1);
		a[0].start = 0;
		a.attr('href', '#start_' + a[0].start);
		a.click(gotoPage);

		var a2 = $(document.createElement('span'));
		pagesContainer.append(a2);
		pagesContainer.append(' ');
		a2.text('...');
//		a2[0].start = 0;
//		a2.attr('href', '#start_' + a2[0].start);
//		a2.click(gotoPage);
	}

	if (pages > 1) {
		for (var i = pagesStart; i < pagesEnd; i++) {
			a = $(document.createElement('a'));
			pagesContainer.append(a);
			pagesContainer.append(' ');

			if (i + 1 == current) a.addClass('active');

			a.text(i + 1);
			a[0].start = i * self.limit;
			a.attr('href', '#start_' + a[0].start);
			a.click(gotoPage);
		}
	}


	if (pagesEnd < pages) {
		a = $(document.createElement('span'));
		pagesContainer.append(a);
		pagesContainer.append(' ');
		a.text('...');
//		a[0].start = (pages - 1) * self.limit;
//		a.attr('href', '#start_' + a[0].start);
//		a.click(gotoPage);

		a2 = $(document.createElement('a'));
		pagesContainer.append(a2);
		pagesContainer.append(' ');
		a2.text(pages);
		a2[0].start = (pages - 1) * self.limit;
		a2.attr('href', '#start_' + a2[0].start);
		a2.click(gotoPage);
	}

	if (current < pages) {
		a = $(document.createElement('a'));
		pagesContainer.append(' ');
		pagesContainer.append(a);
		a.text('>');
		a[0].start = (current) * self.limit;
		a.attr('href', '#start_' + a[0].start);
		a.click(gotoPage);
	}

	function gotoPage(e) {
		self.start = this.start;
		self.changed();
	}


};


Pagination.prototype.changed = function () {
};


