// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function UpdateProcess(parentDOM) {
	this.parentDOM = parentDOM;

	this.buttonDOM = $(document.createElement('a'));
	this.applyDOM = $(document.createElement('a'));
	this.viewTempDOM = $(document.createElement('a'));
	this.preInfoDOM = $(document.createElement('p'));
	this.infoDOM = $(document.createElement('div'));
	this.listDOM = $(document.createElement('div'));

	this.data = null; // Last loaded data

	this.drawn = false;
	this.isRunning = false;

	UpdateProcess.prototype.init.call(this);
}
/**
 * Gets called once this UpdateProcess is initialized
 */
UpdateProcess.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};

/**
 * Gets called every time the UpdateProcess must be drawn completely
 */
UpdateProcess.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.preInfoDOM.addClass('updateInfo');
		this.parentDOM.append(this.preInfoDOM);
		this.preInfoDOM.text('Wenn der komplette Prozess durchlaufen ist, werden die berechneten Daten als aktueller Stand übernommen.');

		this.infoDOM.addClass('updateInfo');
		this.parentDOM.append(this.infoDOM);

		this.buttonDOM.addClass('updatebutton');
		this.parentDOM.append(this.buttonDOM);
		this.buttonDOM.text('Updateprozess starten');
		this.buttonDOM.hide();
		this.buttonDOM.addClass('button');
		this.buttonDOM.click(function (e) {
			e.preventDefault();
			if (!confirm('Möchten Sie den Updateprozess wirklich starten?')) {
				return;
			}
			self.buttonDOM.hide();
			self.run();
		});

		function getViewTempButtonText() {
			return isTempActive()?'Temporäre Datenansicht deaktivieren':'Temporäre Datenansicht aktivieren';
		}

		this.viewTempDOM
			.text(getViewTempButtonText())
			.hide()
			.addClass('button')
			.appendTo(this.parentDOM)
			.click(function(e){
				e.preventDefault();
				saveStorage('isTempActive', !isTempActive());
				$(this).text(getViewTempButtonText());

				displayTempDataHeader();
			});

		this.applyDOM
			.text('Daten übernehmen')
			.hide()
			.addClass('button')
			.appendTo(this.parentDOM)
			.click(function (e) {
				e.preventDefault();
				if (!confirm('Möchten Sie die Daten aus dem letzten Update wirklich übernehmen?')) {
					return;
				}
				self.applyDOM.hide();
				self.runApply();
			});

		this.listDOM.addClass('updateProcess');
		this.parentDOM.append(this.listDOM);

		this.drawn = true;
	}

	if (this.isRunning) {
		this.buttonDOM.hide();
	} else {
		this.buttonDOM.show();
	}

	if (!this.data) {
		this.listDOM.text('Keine Daten verfügbar');
		return;
	}

	if(this.data.settings.update_manual_apply) {
		this.preInfoDOM.text('ACHTUNG: Wenn der komplette Prozess durchlaufen ist, müssen die Daten von einem Administrator übernommen werden.');
	}

	this.listDOM.empty();

	if (this.data.complete) {
		this.infoDOM.text('Der Prozess ist komplett abgeschlossen.');
	} else if (this.running) {
		this.infoDOM.text('Der Prozess wird aktuell ausgeführt.');
	} else {
		this.infoDOM.text('Prozess ist nicht abgeschlossen.');
	}

	for (var i = 0; i < this.data.steps.length; i++) {
		var step = this.data.steps[i];
		this.listDOM.append(this.drawProcessEntry(step));
		if(step.ident=='apply_data' && step.progress_info && step.progress_info.state=='wait_for_admin') {
			this.applyDOM.show();
			this.viewTempDOM.show();
			if (this.data.complete) {
				this.infoDOM.text('Der Prozess muss von einem Administrator abgeschlossen werden.');
			}
		}
	}

};
UpdateProcess.prototype.drawProcessEntry = function (step) {

	var pBox = document.createElement('div');
	pBox.className = 'process';

	function c(cont, className) {
		var el = pBox.appendChild(document.createElement('div'));
		if (className) {
			el.className = className;
		}
		el.appendChild(document.createTextNode(cont));
		return el;
	}

	var started = new Date(step.date_started * 1000);
	var ended = new Date(step.date_updated * 1000);
	var duration = (ended - started) / 1000;

	var status = 'Abgeschlossen';
	if (!step.done) status = 'Nicht abgeschlossen';
	if (step.running) status = 'Wird ausgeführt';
	if (step.failed) status = 'Fehlgeschlagen ';
	//if(step.running && !step.done && !step.failed) status = 'Unbekannter Fehler';
	if(step.progress_info && step.progress_info.state == 'wait_for_admin') {
		status = 'Warte auf Admin';
		step.progress = 0;
	}

	c(step.ident, 'ident');
	var statusObj = c('Status: ' + status, 'item');
	if (step.failed && step.progress_info.error) {
		$(statusObj).append(' ');
		$('<a href="" />')
			.text('Details')
			.appendTo(statusObj)
			.click(function (e) {
				e.preventDefault();
				$('<pre />').text(step.progress_info.error).appendTo(pBox);
				$(this).remove();
			});
	}

	c('Dauer: ' + getTimeOutput(duration), 'item');
	c('Gestartet: ' + getDateTimeText(new Date(step.date_started * 1000)), 'item');
	c('Beendet: ' + getDateTimeText(new Date(step.date_done * 1000)), 'item');
	c('Fortschritt: ' + (step.progress * 100).toFixed(1) + '%', 'item');

	var bar = c('', 'progbar').appendChild(document.createElement('div'));
	bar.className = 'bar';
	bar.style.width = (step.progress * 100).toFixed(1) + '%';

	if (step.progress_info && step.progress_info.file_count) {
		c('Datei: ' + step.progress_info.file_num + '/' + step.progress_info.file_count, 'item');
	}

	if (step.ident == 'import_students' && step.progress_info && step.progress_info.num) {
		c('Anzahl: ' + step.progress_info.num_success + ' / ' + step.progress_info.num, 'item');
	}
	if (step.ident == 'import_applicants' && step.progress_info && step.progress_info.num) {
		c('Anzahl: ' + step.progress_info.num, 'item');
	}
	if (step.ident == 'import_exams' && step.progress_info && step.progress_info.num) {
		c('Anzahl: ' + step.progress_info.num, 'item');
		c('Doppelte: ' + step.progress_info.failed, 'item');
	}

	if (step.ident == 'calculate_student_exams' && step.progress_info && step.progress_info.count) {
		c('Nr./Gesamt: ' + step.progress_info.num + '/' + step.progress_info.count, 'item');
	}
	if (step.ident == 'calculate_student_risk' && step.progress_info && step.progress_info.count) {
		c('Nr./Gesamt: ' + step.progress_info.num + '/' + step.progress_info.count, 'item');
	}

	if (step.ident == 'generate_paths_apriori' && step.progress_info && step.progress_info.count) {
		c('Schritt: ' + numTd(step.progress_info.proc_num + 1) + '/' + numTd(step.progress_info.proc_count) + ' (' + step.progress_info.proc_ident + ')', 'item');
		c('Nr./Gesamt: ' + numTd(step.progress_info.num) + '/' + numTd(step.progress_info.count), 'item');
		c('Gespeichert/Gesamt: ' + step.progress_info.saved + '/' + step.progress_info.saved_total, 'item');
		c('Dimensionen: ' + step.progress_info.dim, 'item');
		c('Features: ' + step.progress_info.features_used + '/' + step.progress_info.features, 'item');
	}

	if (step.running && step.progress_info.count && step.progress_info.num) {
		var left = 0;
		var progDuration = duration;
		if (step.progress_info.dim_started) {
			progDuration = (ended - (new Date(step.progress_info.dim_started * 1000))) / 1000;
		}
		var leftItems = step.progress_info.count - step.progress_info.num;
		var secPerItem = progDuration / step.progress_info.num;
		var itemPerSec = progDuration ? step.progress_info.num / progDuration : 0;
		left = leftItems * secPerItem;
		c('Restzeit ca.: ' + getTimeOutput(left), 'item');
		c('Pro Sekunde: ' + numTd(itemPerSec.toFixed(1)), 'item');
	}

	return pBox

};

UpdateProcess.prototype.run = function () {
	var self = this;
	var url = '/api/RunProcess';

	var params = [];

	if (params.length) url += '?';
	url += params.join('&');

	self.listDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		if (data.ok) {

			var wait = (data.wait + 5) * 1000;

			self.infoDOM.text('Startsignal wurde registriert. Es kann bis zu einer Minute dauern, bis der Prozess startet.');
			setTimeout(function () {
				self.listDOM.removeClass('loading');
				self.load();
			}, wait);

		} else if (data.error) {
			self.listDOM.removeClass('loading');
			self.infoDOM.text('FEHLER: Es existiert bereits ein Startsignal.');
			self.buttonDOM.show();
		}

	}).fail(function () {
		self.listDOM.removeClass('loading');
		self.listDOM.text('Starten des Prozesses ist fehlgeschlagen.');

	})

};

UpdateProcess.prototype.runApply = function () {
	var self = this;
	var url = '/api/RunProcess?apply_data=true';

	var params = [];

	if (params.length) url += '?';
	url += params.join('&');

	self.listDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		if (data.ok) {

			self.infoDOM.text('Datenübernahme erfolgreich');
			self.listDOM.removeClass('loading');
			location.reload();

		} else if (data.error) {
			self.listDOM.removeClass('loading');
			self.infoDOM.text('FEHLER: Datenübernahme gescheitert');
			self.buttonDOM.show();
		}

	}).fail(function () {
		self.listDOM.removeClass('loading');
		self.listDOM.text('Anfrage für Datenübernahme gescheitert');

	})

};

UpdateProcess.prototype.load = function (noloading) {
	var self = this;
	var url = '/api/GetProcess';

	var params = [];

	if (params.length) url += '?';
	url += params.join('&');

	if (!noloading)
		self.listDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		if (!noloading)
			self.listDOM.removeClass('loading');

		self.data = data;


		var now = new Date().getTime();

		self.isRunning = false;
		for (var i = 0; data && data.steps && i < data.steps.length; i++) {
			var step = data.steps[i];
			var updated = step['date_updated'] * 1000;
			if (!step.done && step.running && updated < now - 600000) {
				step.running = false;
			}
			if (!step.done && step.running) {
				self.isRunning = true;
			}
		}

		self.draw();

		if (self.isRunning) {
			setTimeout(function () {
				self.load(true);
			}, 3000);
		}


	}).fail(function () {
		if (!noloading)
			self.listDOM.removeClass('loading');
		self.listDOM.text('Laden der Daten ist fehlgeschlagen. Versuche es wieder ...');

		setTimeout(function () {
			self.load();
		}, 3000);
	})

};



