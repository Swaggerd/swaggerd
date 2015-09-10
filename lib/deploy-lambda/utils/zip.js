var rx = require('rx-plus'),
  _ = require('lodash'),
  rxo = rx.Observables,
  rxn = rxo.fromNodeCallback;

var path = require('path');

// Lib non-native zip
exports.zipdir = function (codeDirectory, callback) {
	var zip = new require('node-zip')();
  var wrench = require('wrench');
  var fs = require('fs');

  var options = {
    type: 'nodebuffer',
    compression: 'DEFLATE'
  };

  console.log('=> Zipping repo. This might take up to 30 seconds');
  var files = wrench.readdirSyncRecursive(codeDirectory);
  files.forEach(function (file) {
    var filePath = path.join(codeDirectory, file); //[codeDirectory, file].join('/');
    var isFile = fs.lstatSync(filePath).isFile();
    if (isFile) {
      var content = fs.readFileSync(filePath);
      zip.file(file, content);
    }
  });

  var data = zip.generate(options);

  return callback(null, data);
};

// TODO: needed?
function zipfileTmpPath() {
  var os = require('os');
  
  var ms_since_epoch = +new Date();
  var filename = 'noderx_' + ms_since_epoch + '.zip';
  var zipfile = path.join(os.tmpDir(), filename);

  return zipfile;
};

// Native lib
exports.zipdiros = function (codeDirectory, callback) {
	var exec = require('child_process').exec;
  var zipfile = zipfileTmpPath(),
    cmd = 'zip -r ' + zipfile + ' .';
  exec(cmd, {
    cwd: codeDirectory,
    maxBuffer: 10 * 1024 * 1024
  }, function (err) {
    if (err !== null) {
      return callback(err, null);
    }

    require('fs').readFile(zipfile, function(err, data) {
    	callback(null, data);
    });
    
  });
};