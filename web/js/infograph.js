// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function InfoGraph(parentDOM) {
	this.parentDOM = parentDOM;

	this.form = 'distribution'; // distribution, distributionTime
	this.type = 'grade';

	this.data = null;

	this.svg = parentDOM[0];
	this.drawn = false;


	InfoGraph.prototype.init.call(this);
}


/**
 * Gets called once this InfoGraph is initialized
 */
InfoGraph.prototype.init = function () {
	var self = this;


};

InfoGraph.prototype.draw = function () {
	var self = this;

	/*if (!self.drawn) {
	 self.svg.style.height = self.parentDOM.height()+'px';
	 self.parentDOM.append(self.svg);
	 self.drawn = true;
	 }*/

	var asyncParent = this.parentDOM.parents('[data-asyncload=1]');
	if (asyncParent.size()) {
		asyncParent.one('show', function () {
			doDraw();
		});
	} else {
		doDraw();
	}

	function doDraw() {
		if (self.form == 'hbar') {
			self.drawHBar();
			return;
		}
		nv.addGraph(function () {
			if (self.form == 'distribution') {
				return self.drawDistribution();
			}
			if (self.form == 'distributionTime') {
				return self.drawDistributionTime();
			}
		});
	}

};
InfoGraph.prototype.drawHBar = function () {
	var self = this;
	var hbar = new HBarChart(self.parentDOM);


};
InfoGraph.prototype.drawDistribution = function () {
	var self = this;

	function prepareData() {
		var result = [];
		for (var value in self.data) {
			var count = self.data[value];
			result.push({
				value: value,
				count: count
			})
		}
		return [
			{
				key: '',
				values: result
			}
		];
	}

	function formatY(d) {
		return d.toString();
	}

	function formatX(d) {
		if (self.type == 'grade') {
			return getNumericValueOutput(d, 'grade');
		}
		if (self.type == 'risk') {
			return getNumericValueOutput(d, 'percent') + '%';
		}
		if (self.type == 'label') {
			return d;
		}

	}

	var chart = nv.models.discreteBarChart()
		.x(function (d) {
			return d.value
		})
		.y(function (d) {
			return d.count
		})
		.staggerLabels(false)    //Too many bars and not enough room? Try staggering labels.
		.tooltips(false)        //Don't show tooltips
		.showValues(true)       //...instead, show the bar value right on top of each bar.
		.transitionDuration(350)
	;

	chart.xAxis.tickFormat(formatX);
	chart.yAxis.tickFormat(formatY);

	if (self.type == 'grade') {
		chart.xAxis.axisLabel('Noten');
		chart.yAxis.axisLabel('Anzahl Leistungen');
		chart.yAxis.axisLabelDistance(40);
	}
	if (self.type == 'risk') {
		chart.xAxis.axisLabel('Risiko');
		chart.yAxis.axisLabel('Anzahl');
		chart.yAxis.axisLabelDistance(40);
	}
	if (self.type == 'label') {
		chart.xAxis.axisLabel('Bestanden', 'Nicht bestanden');
		chart.yAxis.axisLabel('Anzahl bestandener Leistungen');
		chart.yAxis.axisLabelDistance(40);
	}

	chart.valueFormat(formatY);

	d3.select(self.svg)
		.datum(prepareData())
		.call(chart);

	nv.utils.windowResize(chart.update);

	return chart;
};


InfoGraph.prototype.drawDistributionTime = function () {
	var self = this;

	function getAllValues() {
		var all_values = [];
		for (var semester_id in self.data) {
			var values = self.data[semester_id];
			for (var value in values) {
				if (all_values.indexOf(value) == -1) {
					all_values.push(value);
				}
			}
		}
		all_values.sort();
		return all_values;
	}

	function prepareData() {
		var result = [];
		var all_values = getAllValues();

		var semesterIds = Object.keys(self.data);
		semesterIds.sort();

		for (var i = 0; i < semesterIds.length; i++) {
			var semester_id = semesterIds[i];
			var values = self.data[semester_id];
			var entry = {
				key: getSemesterText(semester_id),
				values: []
			};
			for (var j = 0; j < all_values.length; j++) {
				var value = all_values[j];
				entry.values.push({
					value: value,
					count: values[value] || 0
				});
			}
			result.push(entry);
		}
		return result;
	}

	function formatY(d) {
		return d.toString();
	}

	function formatX(d) {
		if (self.type == 'grade') {
			return getNumericValueOutput(d, 'grade');
		}
		if (self.type == 'label') {
			return d;
		}
	}

	var chart = nv.models.multiBarChart()
		.x(function (d) {
			return d.value
		})
		.y(function (d) {
			return d.count
		})
		.rotateLabels(0)
		.stacked(true)
		.showControls(true)
		.staggerLabels(false)
		.tooltips(true)
		.transitionDuration(350)
	;

	chart.xAxis.tickFormat(formatX);

	chart.yAxis.tickFormat(formatY);

	if (self.type == 'grade') {
		chart.xAxis.axisLabel('Noten');
		chart.yAxis.axisLabel('Anzahl Leistungen');
		chart.yAxis.axisLabelDistance(40);
	}
	if (self.type == 'risk') {
		chart.xAxis.axisLabel('Risiko');
		chart.yAxis.axisLabel('Anzahl');
		chart.yAxis.axisLabelDistance(40);
	}
	if (self.type == 'label') {
		chart.xAxis.axisLabel('');
		chart.yAxis.axisLabel('Anzahl Leistungen');
		chart.yAxis.axisLabelDistance(40);
	}

	d3.select(self.svg)
		.datum(prepareData())
		.call(chart);

	nv.utils.windowResize(chart.update);

	return chart;
};


function HBarChart(parentDOM) {
	this.parentDOM = parentDOM;

	this.svg = null;
	this.w = this.parentDOM.width();
	this.h = this.parentDOM.height();

	this.tooltip = null;

	this.bars = [];
	this.barScale = null;

	this.barHeight = 20;
	this.barLeftMargin = 150;
	this.spaceBetweenBars = 10;
	this.legendHeight = 20;

	this.firstLegend = false;
	this.barMode = 'relative'; // relative, absolute

	this.minMaxY = [];

	this.colorScale = d3.scale.category20();

	HBarChart.prototype.init.call(this);
}

HBarChart.prototype.init = function () {
	var self = this;

	self.svg = d3.select(self.parentDOM[0]).append("svg")
		.attr("height", self.h);

	self.tooltip = $('<div class="graphTooltip"></div>').hide().appendTo(self.parentDOM);

	window.addEventListener('resize', function () {
		self.w = self.parentDOM.width();
		self.h = self.parentDOM.height();
		self.draw();
	}, false);
};

HBarChart.prototype.createBar = function (id, label) {
	function HBar(id, label) {
		this.id = id;
		this.label = label;
		this.values = [];
		this.scale = null;
		this.xTickFormat = null;
		this.yTickFormat = null;
		this.minMaxX = [];
		this.minMaxY = [];
		this.sumX = 0;
		this.sumY = 0;
	}

	return new HBar(id, label);
};

HBarChart.prototype.addBar = function (id, label) {
	var bar = this.createBar(id, label);
	this.bars.push(bar);
	return bar;
};

HBarChart.prototype.getBar = function (id) {
	for (var i = 0; i < this.bars.length; i++) {
		var bar = this.bars[i];
		if (bar.id == id) return bar;
	}
	return null;
};

HBarChart.prototype.addValue = function (barId, valueId, count) {
	var bar = this.getBar(barId);
	if (!bar) return;

	var entry = bar.values.filter(function (d) {
		return d.x == valueId;
	})[0];
	if (entry) {
		entry.y += count;
	} else {
		entry = {x: valueId, y: count};
		bar.values.push(entry);
	}

	bar.sumY += count;

	if (!bar.minMaxX.length) bar.minMaxX = [Infinity, -Infinity];
	if (!bar.minMaxY.length) bar.minMaxY = [Infinity, -Infinity];

	if (entry.x < bar.minMaxX[0]) bar.minMaxX[0] = entry.x;
	if (entry.x > bar.minMaxX[1]) bar.minMaxX[1] = entry.x;
	if (entry.y < bar.minMaxY[0]) bar.minMaxY[0] = entry.y;
	if (entry.y > bar.minMaxY[1]) bar.minMaxY[1] = entry.y;


};
HBarChart.prototype.calculateBars = function () {
	var self = this;
	if (!self.minMaxY.length) self.minMaxY = [Infinity, -Infinity];
	self.bars.forEach(function (bar) {
		if (bar.sumY < self.minMaxY[0]) self.minMaxY[0] = bar.sumY;
		if (bar.sumY > self.minMaxY[1]) self.minMaxY[1] = bar.sumY;
	});

};
HBarChart.prototype.draw = function () {
	var self = this;

	self.calculateBars();

	self.barScale = d3.scale.ordinal()
		.domain(d3.range(self.bars.length))
		.rangeRoundBands([0, self.h], 0, 0);

	var barGroups = self.svg.selectAll('g.bar')
		.data(self.bars);

	barGroups.exit().remove();

	barGroups.enter()
		.append('g')
		.attr('class', 'bar');

	barGroups
		.attr('transform', function (bar, i) {
			var y = i * self.barHeight + i * self.spaceBetweenBars;
			if (self.firstLegend) {
				y += self.legendHeight;
			} else {
				y += self.legendHeight * i;
			}
			if (self.svg.attr('height') < y + self.barHeight) {
				self.svg.attr('height', y + self.barHeight);
			}
			return 'translate(0,' + y + ')';
		})
		.each(function (bar, i) {
			self.drawBar(bar, d3.select(this));
		});

	if (self.firstLegend) {
		var legends = self.svg.selectAll('g.legends').data([0]);
		legends.enter().append('g')
			.attr('class', 'legends')
			.attr('transform', 'translate(' + self.barLeftMargin + ',' + (self.barHeight * -1) + ')');
		self.drawBarLegend(self.bars[0].values, legends);
	}


};

HBarChart.prototype.drawBarLegend = function (values, parent) {
	var self = this;
	console.log('values', values);

	var colorScale = d3.scale.category20();

	var texts = parent.selectAll('text.desctext')
		.data(values);
	texts.enter()
		.append('text')
		.attr('class', 'desctext')
		.attr('transform', function (d, i) {
			return 'translate(' +
				0 + ', ' +
				(self.barHeight) + ')';
		});

	var start = 0;
	texts
		.text(function (d) {
			return d.x.toString();
		})
		.transition()
		.attr('transform', function (d, i) {
			var size = this.getBBox();
			var x = start + 15;
			start += size.width + 30;
			return 'translate(' +
				x + ', ' +
				(self.barHeight + size.height) + ')';
		});

	var rects = parent.selectAll('rect.descrect')
		.data(values);
	rects.enter()
		.append('rect')
		.attr('class', 'descrect');

	start = 0;
	rects
		.attr('width', 10)
		.attr('height', 10)
		.attr('transform', function (d, i) {
			var size = texts[0][i].getBBox();
			var x = start;
			start += size.width + 30;
			return 'translate(' +
				x + ', ' +
				(self.barHeight + 5) + ')';
		})
		.attr('fill', function (d, i) {
			return colorScale(i);
		});

};

/**
 * Draws the bar and appends it to the given parent.
 * First the rectacnge for each bar value is drawn and then the labels onto each bar
 */
HBarChart.prototype.drawBar = function (bar, parent) {
	var self = this;

	var barLabel = parent.selectAll('text.barLabel')
		.data([bar.label]);
	barLabel.enter()
		.append('text')
		.attr('class', 'barLabel');
	barLabel
		.text(function (d) {
			return d;
		})
		.attr('transform', function () {
			var size = this.getBBox();
			return 'translate(0, ' + (size.height) + ')';
		});

	var rectsGroup = parent.selectAll('g')
		.data([0]);
	rectsGroup.enter()
		.append('g');
	rectsGroup.attr('transform', 'translate(' + self.barLeftMargin + ',0)');

	bar.scale = d3.scale.linear()
		.range([0, self.w - self.barLeftMargin]);
	if (self.barMode === 'relative') {
		bar.scale.domain([0, bar.sumY]);
	}
	if (self.barMode === 'absolute') {
		bar.scale.domain([0, self.minMaxY[1]]);
	}

	var sum = 0;
	var values = bar.values.map(function (d) {
		return {
			d: d,
			start: sum,
			end: sum += d.y
		};
	});

	var rects = rectsGroup.selectAll('rect')
		.data(values);
	rects.exit().remove();
	rects.enter()
		.append('rect')
		.attr('transform', function (d, i) {
			return 'translate(0 , 0)';
		})
		.on('mouseover', function (d, i) {
			self.drawBarTooltip(bar, i);
			self.tooltip
				.show()
				.css('left', d3.event.pageX + 'px')
				.css('top', d3.event.pageY + 'px');
		})
		.on('mouseout', function () {
			self.tooltip.hide();
		});
	rects
		.transition()
		.attr('width', function (d) {
			return bar.scale(d.end - d.start);
		})
		.attr('height', self.barHeight)
		.attr('transform', function (d, i) {
			return 'translate(' + bar.scale(d.start) + ', 0)';
		})
		.attr('fill', function (d, i) {
			return self.colorScale(i);
		});


	var texts = rectsGroup.selectAll('text.perctext')
		.data(values);
	texts.enter()
		.append('text')
		.attr('class', 'perctext')
		.style('pointer-events', 'none')
		.attr('transform', function (d, i) {
			return 'translate(' + (bar.scale(d.start)) + ', 0)';
		});
	texts
		.text(function (d) {
			if (self.barMode === 'relative' && d.d.y > 0 && d.d.y / bar.sumY > 0.05) {
				return self.getBarValueText(bar, d.d);
			} else if (self.barMode === 'absolute' && d.d.y > 0 && d.d.y / self.minMaxY[1] > 0.05) {
				return self.getBarValueText(bar, d.d);
			} else {
				return '';
			}
		})
		.attr('text-anchor', 'middle')
		.transition()
		.attr('transform', function (d, i) {
			var size = this.getBBox();
			return 'translate(' +
				(bar.scale(d.start) + bar.scale(d.end - d.start) / 2) + ', ' +
				(size.height) + ')';
		});

	if (!self.firstLegend) {
		self.drawBarLegend(bar.values, rectsGroup);
	}


};
HBarChart.prototype.getBarValueText = function (bar, d) {
	var value = d.y === null ? 0 : d.y;
	if (this.barMode === 'relative') {
		return (value / bar.sumY * 100).toFixed(0) + '%';
	} else if (this.barMode === 'absolute') {
		return value;
	} else {
		return '';
	}
};
HBarChart.prototype.drawBarTooltip = function (bar, selectedValueIndex) {
	var self = this;
	self.tooltip.empty();

	$('<div></div>').text(bar.label).appendTo(self.tooltip);
	bar.values.forEach(function (d, i) {
		var entry = $('<div class="tooltipEntry"></div>').appendTo(self.tooltip);
		entry.css('border-left-color', self.colorScale(i));
		if (selectedValueIndex === i) {
			entry.addClass('active');
		}

		$('<b></b>').text(self.getBarValueText(bar, d)).appendTo(entry);
		entry.append(' ');
		$('<span></span>').text(d.x).appendTo(entry);

	});


};