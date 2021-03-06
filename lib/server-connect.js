/*eslint quotes: [0, "single"], curly: 0, new-cap:1, eqeqeq:1, no-loop-func:1, no-unreachable:1, camelcase:0, noempty:0, dot-notation:0, no-underscore-dangle:0*/
/*eslint-disable no-console */
/*eslint-env node */
'use strict';
var swaggerTools = require('swagger-tools');
var serveStatic = require('serve-static');
var zlib = require('zlib')
//var querystring = require('querystring');

var path = require("path");

var swaggerTools = require('swagger-tools');
//var swaggerEditor = require('serve-swagger-editor');

var routesPath = path.join(process.cwd(), "handler.js");

var express = require('express');
var compression = require('compression');
//var http = require('http');
var bodyParser = require('body-parser');
var YAML = require('js-yaml');
var fs = require('fs');
var parser = require("swagger-parser");
var _ = require("lodash");
var director = require('director');
var router = new director.http.Router().configure(
          { recurse: null }); // 'backward'
var Qs = require('qs');
var multer = require('multer');

var PORT = process.env.PORT || 8080;
var RELOAD = true;

function setupApp() {
  var app = express();
  app.use(compression({'strategy':zlib.Z_FILTERED, 'level': 6})); // GZIP
  app.use(bodyParser.json({limit: '100mb'}));

  app.use(express.static('public')); // Mount static Public folder

  // Mount swagger.js on /public from project root
  app.use('/swagger.json', function(req, res, next) {
    res.sendFile(path.join(process.cwd(), 'swagger.json'));
  });

  function onDone(err, xs) {
    var paths = xs.paths;
    var pairs = _.toPairs(paths);
    var vo = _.map(pairs, function(x) {
      return { path:x[0], methods: x[1] };
    } );
    _.forEach(vo, setupPath);
  }
  parser.parse(path.join(process.cwd(), 'swagger.json'), {'validateSchema':false, 'strictValidation': false}, onDone);
  return app;
}

//===============


var module_cache = null;
function setupPath(x) {
    // TODO: lookup v1 version api
    var verpath = '/v1' + x.path;
    var params = verpath.match(/(?!{)[a-z0-9]*(?=})/gi);
    params = _.filter(params, function(e) {
        return e !== ''
    }); // TODO: clean

    var verpath_params = verpath.replace(/}/g, '').replace(/{/g, ':');
    var verpath_noparams = verpath.replace(/\/{(.*)$/, ''); //needed?
    //var verpath2_noparams = x.path.toLowerCase().replace(/\/{(.*)$/, ''); //needed?
    //console.log("params", params, verpath, verpath_noparams);
    _.forEach(x.methods, function(data, method) {
        // TODO: refactor into its own function, remove trace
        console.log("Creating " + method.toUpperCase() +
                    " route: ", verpath_params);
        router.on(method, verpath_params, function() {
            console.log("router.on", method, verpath_params);
            var _this = this;

            var args = arguments;
            //_forEach(this.req.query, function(val, key))
            var context = {};
            context.query = '{' + Qs.stringify(this.req.query,
                                  { delimiter: ', ' }) + '}';
            var path = this.req.path.replace(verpath_noparams, '');
            var pathparams = {};
            //arguments[0]
            //console.log(this.req.params);
            _.forEach(params, function(v, i) {
                pathparams[v] = args[i];
                // /params
            });
            context.pathparam = '{' + Qs.stringify(pathparams, {
                delimiter: ','
            }) + '}';

            context.body = _this.req.body;
            context.files = _this.req.files;

            var handler = getPathToMethodName(method, x.path);

            var routes = module_cache =
                (module_cache || require(routesPath));

            var hdl = routes[handler];
            if (!hdl) {
                _this.res.status(404).end("No API handler: /" + handler);
                console.log("No API handler: /" + handler);
                return;
            }
            console.log("Fetching handler: " + handler);
            try {
              var _event = makeEvent(_this.req, _this.res, handler);
              var _ret = hdl(context, _event);
              // If returns Rx stream, subscribe to it
              if(_ret && _ret.subscribe) {
                //_ret.defaultIfEmpty(rxo.throw('No response'))
                _ret.take(1)
                //.catch(function(e) { return rxo.throw(e) })
                .subscribe(
                  function(x) { _event.done(null, x) }
                  , function(x) {
                    console.log('controller error:', x, x?x.stack:'')
                    _event.done(x, null)
                  })
                  //subscribeAlt(_event.done);
              }
              else if(_ret && _ret.then) {
                _ret.then(function(x) {
                   _event.done(null, x);
                });
              }
            } catch(e) {
            //if(false) {
              //var err = new Error();
              console.log("{CONTROLLER ERROR}");
              console.log("{Handler: " + handler, "Path: "+verpath+"}");
              dumpError(e);
              _this.res.status(500).end();
            }
            if (RELOAD) {
              module_cache = null;
              //delete require.cache[require.resolve(routesPath)];
              // delete the entire cache to be safe
              for(var k in require.cache) {
                delete require.cache[k];
              }
              //require.cache = {}; // clear all
            }
            return false;
        });
    });
    return router;
}

function dumpError(err) {
  if (typeof err === 'object') {
    if (!err.stack && err.message) {
      console.log('\nError Message: ' + err.message)
    }
    else if (err.stack) {
      console.log(err.stack);
    } else console.log(err);
  } else {
    console.log(err);
  }
}

// Make the controller Event parameter
function makeEvent(req, res, fname) {
  var event = {
    _completed:false,
    done: function(err, done) {
      //console.log("done", fname);
      if(event._completed) {
        console.log("Warning: Handler " + fname + " already resolved");
        return;
      }
      event._completed = true;

      if(err){
        console.log("Failed", fname, dumpError(err));
        // Error response
        //res.statusCode = 400;
        if(typeof err === "object") res.status(400).json(err);
        else res.status(400).send(err);
        return;
      }

      // Success response
      if (_.isBuffer(done)) {
        res.write(done);
        res.end();
      }
      else if (typeof done === 'object') res.json(done);
      else res.end(err ? err : done);

    },
    fail: function(err) {
      console.log("Failed", fname, err);
      // Explicit fail response
      if(event._completed) {
        console.log("Warning: Handler " + fname + " already resolved");
        return;
      }
      event._completed = true;
      res.status(400).end(err);
    },
    getRemainingTimeInMillis: function () {
      return 60 * 1000;
    },
    getMemoryLimitInMB: function () {
      return 512;
    },
    getAwsRequestId: function() {
      return 0;
    },
    getFunctionName: function() {
      return fname;
    },
    getIdentity: function() {
      return null;
    }
  }
  return event;
}

exports.startWithEditor= function(port, handler, onChange) {
  if(!port && process.env.PORT) port = process.env.PORT;
  var editor_lib_path = path.join(__dirname, '../', 'node_modules', 'swagger-editor');
  var editor_config = path.join(__dirname, 'swagger-editor', 'defaults.json');

  app = setupApp();

  app.use('/editor/spec', bodyParser.text({type:'application/yaml'}), function(req, res, next) {
    var spec_path = path.join(process.cwd(), 'swagger.json');
    console.log("/editor/spec by " + req.method);
    if(req.method==='GET' || req.method==='HEAD' || req.method==='DELETE') {
      var f = fs.readFileSync(spec_path);
      var y = YAML.safeDump(JSON.parse(f));
      res.send(y);
      //res.sendFile(path);
    }
    else if(req.method==='PUT' || req.method==='POST' || req.method==='PATCH') {
      //console.log("body ", req.body);
      var toObj = YAML.safeLoad(req.body);
      //console.log(toObj);
      fs.writeFileSync(spec_path, JSON.stringify(toObj, null, '\t'));
      console.log("Swagger.json updated");
      if(onChange) onChange();
      res.end('ok');
    } else {
      res.status(500).end("Spec save method unsusported: " + res.method);
    }
  });

  app.use('/editor/config/defaults.json', function(req, res, next) {
    console.log("defaults.json");
    res.sendFile(editor_config);
  });

  app.use('/editor', express.static(editor_lib_path));
  exports.start(port, true, handler, app);
  console.log("Swagger-editor on ./editor/");
}

exports.start = function(port, alwaysReload, handler, app) {
  if(!app) app = setupApp();
  if(!port && process.env.PORT) port = process.env.PORT;
  RELOAD = alwaysReload;
  console.log("Hot reload: " + RELOAD);
  console.log("Swagger-ui on ./docs/");
  console.log("API accessible under ./v1/");

  if(handler) {
    if(typeof handler !== 'string') module_cache = handler;
    else routesPath = path.join(process.cwd(), handler);
  }

  var multerFields = multer({
    limits: {
      fieldSize: 1e8 // 100MB
    },
    isMemory: true
  }).fields([{
    name: 'file'
  }])

  // Connect route to app
  app.use(multerFields, function(req, res) {
    router.dispatch(req, res, function (err) {
        if (err) {
          res.writeHead(404);
          res.end();
        }
    });
  });
  //http.createServer(app).listen(port);
  app.listen(port);
};

// Start the server is script is called directly
if(!module.parent) {
  console.log("Local server started on: ", PORT);
  console.log("Swagger-ui on ./docs");
  console.log("API accessible under ./v1/");
  var app = setupApp();
  exports.start(PORT, false, null, app);
}
// ==============
var camelCase = function(id) {
    if(id.indexOf('-') === -1) {
        return id;
    }
    var tokens = [];
    id.split('-').forEach(function(token, index){
        if(index === 0) {
            tokens.push(token[0].toLowerCase() + token.substring(1));
        } else {
            tokens.push(token[0].toUpperCase() + token.substring(1));
        }
    });
    return tokens.join('');
};


var getPathToMethodName = function(m, path){
    if(path === '/' || !path) {
        return m.toLowerCase();
    }

    // clean url path for requests ending with '/'
    var cleanPath = path;
    if( cleanPath.indexOf('/', cleanPath.length - 1) !== -1 ) {
        cleanPath = cleanPath.substring(0, cleanPath.length - 1);
    }

    var segments = cleanPath.split('/').slice(1);
    segments = _.transform(segments, function (result, segment) {
        if (segment[0] === '{' && segment[segment.length - 1] === '}') {
            segment = 'by' + segment[1].toUpperCase() + segment.substring(2, segment.length - 1);
        }
        result.push(segment);
    });
    var result = camelCase(segments.join('-'));
    return m.toLowerCase() + result[0].toUpperCase() + result.substring(1);
};
