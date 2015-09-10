var rx = require('rx'),
	_ = require('lodash'),
	rxo = rx.Observables,
	rxn = rxo.fromNodeCallback,
	rxarray = rxo.fromArry;

var fs = require('fs');

var path = require('path');

//Helpers
exports.isDefined = function(x) {
	return x !== null && x !== undefined;
}
exports.isNull = function(x) {
	return x === null;
}
exports.isNotNull = function(x) {
	return x !== null;
}
exports.isNotEmptyString = function(x) {
	return x !== '';
}
exports.isNotEmpty = function(x) {
	return x.length > 0;
}

exports.fs = {};
exports.fs.readdir = rxn(fs.readDir);

exports.fs.mkdir = rxn(require('fs').mkdir;

exports.fs.rmdir = rxn(require('fs').rmdir;

exports.fs.readFile = function(dir) {
	return rxn(require('fs').readFile);
}
exports.fs.writeFile = function(dir) {
	return rxn(require('fs').writeFile);
}
exports.fs.appendFile = function(dir) {
	return rxn(require('fs').appendFile);
}

// Zip
exports.fs.zipdir = function () {
	var ziplib = require('./zip.js');
    var _zip = process.platform !== 'win32' ? 
    	ziplib.zipdiros :  ziplib.zipdir;
    return rxo(_zip);
}

exports.fs._rsync = function (codeDirectory, callback) {
	var exec = require('child_process').exec;
	//--exclude=node_modules 
  exec('rsync -r --exclude=.git --exclude=*.log . ' + codeDirectory, function (err) {
    if (err) {
      throw err;
    }

    return callback(null, true);
  });
};

// Must have rsync installed
exports.fs.rsync = function() {
	return rxn( exports.fs._rsync );
}