var _ = require("lodash");
var rx = require('rxjs-plus'); 
var fs = require('fs');

_.rxo = rx.Observable; 
_.rxwrap = _.rxo.fromNodeCallback;

function ownedBy(name, val) {
  return val.owner === name;
}
var ownedByPred = function(name) { return _.partial(ownedBy, name); }


// ================
/*


var readDir = _.rxwrap(fs.readdir);
var readFile = _.rxwrap(fs.readFile);

var sourceDir = readDir('./').flatMap(_.rxo.fromArray);
var readPerm = readFile('perm.json', 'utf-8').map(JSON.parse).repeat();

var source = sourceDir.zip(readPerm, function(src, perm) {
  if(perm[src]) perm[src].resource = src;
  return perm[src] || null;
}).filter( _.isObject ).publish();

var subscription = source.filter(ownedByPred("group a")).subscribe(function(data) {
  console.log("-- Next --", data);
});
source.connect();
*/
// =========


var resources = {};
exports.getResource = function(pathName) {
	if(!resources[pathName]) resources[pathName] = _.rxo.empty();
	return resources[pathName];
};

exports.setResource = function(pathName, observable) {
	if(!resources[pathName]) resources[pathName] = _.rxo.empty();
	if(observable) resources[pathName].concat(observable);
	return resources[pathName];
}

exports.getResource('/cat').take(2).forEach(console.log);
exports.setResource('/cat', _.rxo.range(0, 5));
