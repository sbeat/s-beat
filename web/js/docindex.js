// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function DocIndex(parentDOM) {
	this.parentDOM = parentDOM;
	this.elements = parentDOM.attr('data-elements')||'h1';

	DocIndex.prototype.init.call(this);
}
/**
 * Gets called once this DocIndex is initialized
 */
DocIndex.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	$(window).scroll(function() {
		self.refreshActive();
	});


};

DocIndex.prototype.refreshActive = function () {
	var self=this;
	var list = self.parentDOM.find('a');
	for (var i = 0; i < list.length; i++) {
		var el = list[i];
		if(!el.targetY || el.targetY<window.scrollY)
			continue;

		if(list[i].className!='active') {
			list.removeClass('active');
			list[i].className='active';
		}

		break;
	}

};

/**
 * Gets called every time the DocIndex must be drawn completely
 */
DocIndex.prototype.draw = function () {
	var self = this;
	var titles_list = $(this.elements);

	titles_list.each(function(){
		var el = $(this);
		var id = el.attr('id');
		if(!id) return;
		var text = el.text();

		var link = $(document.createElement('a'));
		link.attr('href','#'+id);
		link.text(text);
		link[0].targetY = el.offset().top;

		self.parentDOM.append(link);

	});


};

