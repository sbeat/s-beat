// Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
// see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

function DataFileBrowser(parentDOM) {
	this.parentDOM = parentDOM;

	this.type = parentDOM.attr('data-type'); // students, exams

	this.filesDOM = $(document.createElement('div'));
	this.uploadDOM = $(document.createElement('div'));

	this.data = null; // Last loaded data

	this.drawn = false;

	this.typeSettings={
		'students':{
			'delimiter':';',
			'required_fields':[
				'identnr','stg','immdat','exmdat','sperrart1','pnr','pdatum',
				'geschl','gebdat','hzbdatum',['hzbart','hzbgrp'],'hzbnote'
			],
			'date_fields':['immdat','exmdat','pdatum','gebdat','hzbdatum']
		},
		'exams':{
			'delimiter':';',
			'required_fields':[
				'identnr','pnr','pdtxt',['abschlart','abschl'],'stg','psem','bonus',
				'pstatus','part','pnote',
				'pvermerk','pversuch','pform',['ppflicht','pflicht'],'pabschn'
			]
		},
		'studentidents':{
			'delimiter':';',
			'required_fields':[
				'identnr', ['matrikelnr', 'mtknr'], 'vorname', 'nachname', 'email'
			]
		},
		'courses': {
			'delimiter': ';',
			'required_fields': [
				'stg', ['abschl', 'abschlart'], 'ltxt', 'ktxt', 'fb', 'regelstz'
			]
		}
	};

	DataFileBrowser.prototype.init.call(this);
}
/**
 * Gets called once this DataFileBrowser is initialized
 */
DataFileBrowser.prototype.init = function () {
	// Check for global context and filters
	var self = this;

	self.draw();

	self.load();

};
/**
 * Gets called every time the DataFileBrowser must be drawn completely
 */
DataFileBrowser.prototype.draw = function () {
	var self = this;
	if (!this.drawn) {
		this.parentDOM.empty();

		this.filesDOM.addClass('fileslist');
		this.parentDOM.append(this.filesDOM);
		this.filesDOM.sortable({
			update: function (e, ui) {
				self.saveFiles();
			}
		});

		this.uploadDOM.addClass('uploadbox');
		this.parentDOM.append(this.uploadDOM);

		this.drawUpload();

		this.drawn = true;
	}


	if (!this.data || !this.data['files_info']) {
		this.filesDOM.text('Keine Daten verfügbar');
		return;
	}

	var list = this.data['files_info'];
	list.sort(function (a, b) {
		if (a['order'] < b['order']) return -1;
		if (a['order'] > b['order']) return 1;
		return 0;
	});

	this.filesDOM.empty();
	for (var i = 0; i < list.length; i++) {
		var info = list[i];
		this.filesDOM.append(self.drawFile(info));
	}


};
DataFileBrowser.prototype.drawFile = function (info) {
	var self = this;
	var fileO = document.createElement('div');
	fileO.className = 'fileitem';
	fileO.infoData = info;

	var mainO = fileO.appendChild(document.createElement('div'));
	mainO.className = 'main';

	var nameO = mainO.appendChild(document.createElement('div'));
	nameO.className = 'name';

	var infoO = mainO.appendChild(document.createElement('div'));
	infoO.className = 'info';

	var activeO = fileO.appendChild(document.createElement('div'));
	activeO.className = 'status';

	var orderO = fileO.appendChild(document.createElement('div'));
	orderO.className = 'order';

	if (info['active']) fileO.className += ' active';

	$(nameO).text(info.file);
	$(infoO).text('Größe: ' + getBytesOutput(info['size'], 1) + ' Datum: ' + getDateTimeText(new Date(parseInt(info['mtime'] * 1000))));
	orderO.title = 'Ordnungsnummer der Reihenfolge';
	$(orderO).text('↕' + info.order)
		.tooltip();

	if (info['active'])
		activeO.title = 'Ist aktiv';
	else
		activeO.title = 'Ist deaktiviert';

	$(activeO).tooltip()
		.click(function (e) {
			info['active'] = !info['active'];
			self.saveFiles();
		});

	var optO = nameO.appendChild(document.createElement('div'));
	optO.className = 'opt';
	$(optO).click(function(e){
		var text = $(document.createElement('div'));
		text.text('Was möchten Sie mit der Datei '+info['file']+' tun?');

		var buttons = {};
		buttons[info['active']?'Deaktivieren':'Aktivieren']=function(){
			info['active'] = !info['active'];
			self.saveFiles();
			$(this).dialog("close");
		};
		buttons['Löschen']=function(){
			if(confirm('Möchten Sie die Datei '+info['file']+' wirklich löschen?')) {
				info['remove'] = true;
				self.saveFiles();
			}
			$(this).dialog("close");
		};
		buttons['Nichts']=function(){
			$(this).dialog("close");
		};


		text.dialog({
			title:info['file'],
			modal:true,
			buttons:buttons
		})

	});

	return fileO;
};

DataFileBrowser.prototype.saveFiles = function () {
	var self = this;
	var storeList = [];
	var index = 0;
	this.filesDOM.find('.fileitem').each(function () {
		var info = this.infoData;
		if (!info) return;
		index++;
		info['order'] = index;
		storeList.push(info);
	});

	self.filesDOM.addClass('loading');

	var url = '/api/SaveFiles';
	$.ajax({
		url: url,
		type: 'POST',
		contentType: 'application/json; charset=utf-8',
		data: JSON.stringify({
			directory: self.type,
			list: storeList
		})
	}).success(function (data) {
		self.filesDOM.removeClass('loading');

		self.load();

	}).fail(function () {
		self.filesDOM.removeClass('loading');
		self.filesDOM.text('Speichern der Daten ist fehlgeschlagen.');
	});


};

DataFileBrowser.prototype.load = function () {
	var self = this;
	var url = '/api/GetFiles';

	var params = [];
	params.push('directory=' + self.type);

	if (params.length) url += '?';
	url += params.join('&');

	self.filesDOM.addClass('loading');

	$.ajax({
		url: url
	}).success(function (data) {
		self.filesDOM.removeClass('loading');

		self.data = data;

		self.draw();

	}).fail(function () {
		self.filesDOM.removeClass('loading');
		self.filesDOM.text('Laden der Daten ist fehlgeschlagen.');
	});

};


DataFileBrowser.prototype.drawUpload = function (error) {
	var self = this;
	self.uploadDOM.empty();

	var pbar = document.createElement('div');
	pbar.className = 'progbar';
	var bar = pbar.appendChild(document.createElement('div'));
	bar.className = 'bar';
	bar.style.width = '0%';
	pbar = $(pbar);
	pbar.hide();
	self.uploadDOM.append(pbar);

	var info = $(document.createElement('div'));
	self.uploadDOM.append(info);

	if(error) {
		info.text('ERROR: '+error.msg);
		info.addClass('error');
	}

	var button = $(document.createElement('a'));
	button.attr('href', 'javascript:void(0)');
	button.text('CSV Datei von Computer auswählen');
	button.addClass('button');
	self.uploadDOM.append(button);

	var input = $(document.createElement('input'));
	input.attr('type', 'file');
	input.attr('accept', 'text/csv');
	button.click(function (e) {
		e.preventDefault();
		input.click();
	});

	input.fileupload({
		url: '/api/UploadFile?directory=' + self.type,
		dataType: 'json',
		limitMultiFileUploads: 1,
		paramName: 'file',
		done: function (e, data) {
			//console.log('done', data);
			self.drawUpload();
			self.load();
		},
		add: function (e, data) {
			//console.log('add', data);
			var file = data.files[0];
			self.checkFile(file, function (error) {
				if (!error) {
					data.submit();
					button.hide();
					info.removeClass('error');
				} else {
					self.drawUpload(error);
				}

			});

		},
		start: function (e, data) {
			//console.log('start', data);
			pbar.show();

		},
		progress: function (e, data) {
			var progress = data.loaded / data.total * 100;
			if (data.bitrate)
			//console.log('progress', data);
				bar.style.width = progress.toFixed(2) + '%';
			info.text(progress.toFixed(2) + '% ' +
				getBytesOutput(data.loaded,2) + '/' + getBytesOutput(data.total,2) + ' ' +
				getBytesOutput(data.bitrate,2) + '/s' +
				' ' + data.files[0].name);
		}
	});


};

/**
 * Possible errors:
 *    invalid_name
 *    no_data_lines
 *
 * @param file
 * @param callback
 */
DataFileBrowser.prototype.checkFile = function (file, callback) {
	var self = this;
	console.log('checkFile', file);
	if (!file.name.match(/^[-\w]+\.csv$/)) {
		callback({code:'invalid_name',msg:'Der Dateiname darf nur Buchstaben, Zahlen, - und _ enthalten und muss mit .csv enden.'});
		return;
	}

	var readLen = 10000;
	if (file.size < readLen)
		readLen = file.size;

	var headerFields = null;

	var reader = new FileReader();
	reader.onload = function (e) {
		var lines = reader.result.split('\n');
		if(lines.length<=2) {
			callback({code:'no_data_lines',msg:'Keine Datenzeilen in der Datei gefunden.'});
			return;
		}
		var i, line, err;
		for (i = 0; i < lines.length-1 && i<10; i++) {
			line = lines[i].trim();
			if(i==0) {
				err=checkHeaderLine(line);
			} else {
				err=checkLine(line,i+1);
			}
			if(err) {
				callback(err);
				return;
			}
		}

		callback(null);
	};
	reader.readAsText(file.slice(0,readLen));

	function readColumns(line) {
		var result = [];
		var delimiter = self.typeSettings[self.type].delimiter;
		var s=false;
		var n='';
		var lc=null;
		for (var i = 0; i < line.length; i++) {
			var c = line[i];
			if(c=='"' && lc!='\\') s=!s;
			else if(!s && c==delimiter) {
				result.push(n);
				n = '';
			} else n+=c;
		}
		result.push(n);
		return result;
	}

	function checkHeaderLine(line) {
		var delimiter = self.typeSettings[self.type].delimiter;
		if(line.indexOf(delimiter)==-1) {
			return {code:'delimiter_not_found',msg:'Das Trennzeichen "'+delimiter+'" wurde nicht gefunden.'};
		}

		var cols = readColumns(line).map(function(f){ return f.toLowerCase(); });
		var required = self.typeSettings[self.type].required_fields;
		for (var i = 0; i < required.length; i++) {
			var req = required[i];
			if (typeof(req) == 'string' && cols.indexOf(req)==-1) {
				return {code: 'col_not_found', msg: 'Die Spalte "' + req + '" wurde nicht gefunden.'};
			}
			if(Array.isArray(req)) {
				var found = false;
				for (var j = 0; j < req.length; j++) {
					var field = req[j];
					if(cols.indexOf(field) != -1)
						found = true;
				}
				if(!found) {
					return {code: 'col_not_found', msg: 'Eine der Spalten "' + req.join('", "') + '" wurde nicht gefunden.'};
				}
			}

		}

		headerFields = cols;
		return null;
	}

	function checkLine(line,fields,lineNo) {
		var values = readColumns(line);
		if(values.length<fields.length) {
			return {code:'invalid_cols',msg:'Die Zeile '+lineNo+' hat weniger Spalten als es Kopfspalten gibt '+values.length+'<'+fields.length+'.'};
		}

		var date_fields = self.typeSettings[self.type].date_fields;

		var err;
		for (var i = 0; i < fields.length; i++) {
			var field = fields[i];
			var value = values[i];

			if(date_fields.indexOf(field)!=-1) {
				err=checkDate(field,value);
			} else {
				err=checkFieldValue(field,value);
			}

			if(err) {
				return err;
			}

		}

		return null;
	}

	function checkFieldValue(field,value) {
		return null;
	}

	function checkDate(field,value) {
		if(value=='') return null;
		if(value.match(/^(\d\d)-(\w\w\w)-(\d\d)$/)) {

			var month = RegExp.$2;
			var months = {
				'Jan': 1,
				'Feb': 2,
				'Mrz': 3,
				'Apr': 4,
				'Mai': 5,
				'Jun': 6,
				'Jul': 7,
				'Aug': 8,
				'Sep': 9,
				'Okt': 10,
				'Nov': 11,
				'Dez': 12
			};
			if (!months[month]) {
				return {
					code: 'invalid_date_month',
					msg: 'Die Spalte "' + field + '" enthält ein ungültigen Monat "' + month + '". ' +
					'Erlaubt sind: ' + Object.keys(months).join(', ')
				};
			}

		} else if (value.match(/^(\d\d)\.(\d\d)\.(\d\d\d\d)$/)) {
			// OK

		} else {
			return {
				code: 'invalid_date', msg: 'Die Spalte "' + field + '" enthält ein ungültiges Datumsformat.' +
				'Das Datum sollte im Format TT-MMM-YY sein Z.B. 04-Mrz-99.'
			};
		}

		return null;
	}

};
