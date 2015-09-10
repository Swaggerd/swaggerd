/*eslint quotes: [0, "single"], curly: 0, new-cap:1, eqeqeq:1, no-loop-func:1, no-unreachable:1, camelcase:0, noempty:0, dot-notation:0, no-underscore-dangle:0*/
/*eslint-disable no-console */
/*eslint-env node */

'use strict';
var path = require("path");
var packageJson = require(path.join(__dirname, '..', 'package.json'));
var aws = require('aws-sdk');
var fs = require('fs');
var _ = require("lodash");
var rx = require("rx"),
    rxo = rx.Observable,
    rxn = rxo.fromNodeCallback;
var nla = require("node-lambda");

var ncp = require('ncp').ncp;
var CodeGen = require('swagger-js-codegen').CodeGen;

var tdir = path.join(__dirname, '..', 'templates');
var server_path = path.join(__dirname, 'server-connect.js');

var Lambdapi = function() {
  this.version = packageJson.version;

  return this;
};

// Starts the local server
Lambdapi.prototype.run = function(program) {
  var _this = this;
  var port = program.port;

  var server = require(server_path);
  if(program.editor) server.startWithEditor(port, function() {
    // onChange spec
    _this.setup('swagger.json', program);
  });
  else server.start(port, !program.noreload);
};

// Deploy the project to Lambda
Lambdapi.prototype.deploy = function(program) {
  // Get the local package name to prefix the lambda functions
  var _package = require(path.join(process.cwd(), 'package.json'));
  var packageName = _package.name;
  if(program.noprefix) packageName = '';

  var base_dir = path.join(process.cwd());

  // Get the list of controllers
  var fileList = fs.readFileSync(path.join(base_dir, 'controllers.json'));
  var controllers =  JSON.parse(fileList);

  var _handler = _.keys(controllers)[0];
  var _controller = controllers[_handler];
  //--
  var funcName = _controller.toString().replace('.js', '');
  program.functionName = packageName + '_' + funcName;
  program.handler = 'handler.' + _handler;
  program.onComplete = function() {
    program.onComplete = null; // only care about first op
  // Run node-lamnda over each controller
    _.forEach(controllers, function(controller, handler) {
      if(!controller || !handler) return; // guard
      if(handler === _handler) return; // already processed
      
      // Swizzle the auto generated lambda names and handler for the controllers
      var funcName = controller.toString().replace('.js', '');
      program.functionName = packageName + '_' + funcName;
      program.handler = 'handler.' + handler;
      console.log("Uploading: ", program.functionName);
      nla._upload(program);
      program = _.clone(program);
    });
  }
  nla.deploy(program);

  
};
/*
Lambdapi.prototype.create = function(program) {
	//nla.deploy(program);
  console.log(program);
};
*/

// Parse a swagger spec to initialize the project.
// - generates lambda functions for each API end point
Lambdapi.prototype.setup = function(file, options) {
  //nla.setup(); // copy .env into project

  var file_flag = options.clean?'w':'wx';

  // Read in the Swagger spec file
  var swaggerSpec = null;
  try {
    swaggerSpec = JSON.parse(fs.readFileSync(file, 'UTF-8'));
  } catch(e) {
    console.log("Cannot open Swagger file: "+ file);
    console.log(e);
    return;
  }

  // Path locations
  var class_path = path.join(tdir, 'lambda-class.mustache'),
    method_path = path.join(tdir, 'lambda-method.mustache'),
    request_path = path.join(tdir, 'lambda-request.mustache');

  var base_dir = path.join(process.cwd());
  var controller_dir = path.join(base_dir, 'controllers');

  // Copy .env and deploy.env to controller root
  copyFileIfNew(path.join(__dirname, '.env.example'), 
    path.join(base_dir, '.env'), 'wx');
  copyFileIfNew(path.join(__dirname, 'deploy.env.example'), 
    path.join(base_dir, 'deploy.env'), 'wx');

  // Controller list to use for deployment
  var fileList = path.join(base_dir, 'controllers.json');
  // Clear the current controller list
  fs.writeFileSync(fileList, "");

  // Performs controller creation on template sentinal value
  var methodAction = function () {
    return function (text, render) {
      var parse = render(text).split("|||");
      try {
        var file = path.join(controller_dir, parse[0]);
        
        // write the controller
        fs.writeFileSync(file, parse[1], {'flag': file_flag });
        console.log("controllers/" + parse[0] + " created.");
      } catch(e) {
        if(options.commentignore) console.log("controllers/" + parse[0] + " already made, skipping.");
        else if(!options.commentignore) {
          console.log("controllers/" + parse[0] + " comments updated.");
          var controllerBody = fs.readFileSync(file).toString();
          // Remove old comments
          controllerBody = controllerBody.replace(/ * .+λ.*(\r\n|\n|\r)/g, '');
          controllerBody = controllerBody.replace(/\/\*\*(\r\n|\n|\r) \*\/(\r\n|\n|\r)/g, '');
          // Get comments from new generated function
          var newComments = parse[1].match(/(?!\n)+([\s\S]*)(?=exports\.handler)/g)[0];
          //console.log(newComments);
          fs.writeFileSync(file, newComments + controllerBody);
       }
      }
      return "";
    };
  };
/*
  var api_dir = path.join(process.cwd(), 'api');
  fs.mkdir(api_dir, function(err, resp) {
    if(err && err.code === 'EEXIST') console.log("API already exists");
    else if(err) throw new Error(err);
    fs.writeFileSync(path.join(api_dir, 'swagger.json'), swaggerSpec);
  });
*/

  // Create Public and API directory, copy swagger json into api
  var public_url = path.join(base_dir, 'public');
  var api_url = path.join(public_url); //, 'api'

  // Make the public static page path
  fs.mkdir(public_url, function(err) {
    if(err && err.code === 'EEXIST') {
      console.log("Public dir already exists");
    }
    else if(err) throw new Error(err);
    
    // Swagger-ui path
    var sw_source = path.join(__dirname, '..', 'node_modules', 'swagger-ui', 'dist');
    
    // Create the docs path for Swagger-ui
    var sw_dest = path.join(public_url, "docs");
    ncp(sw_source, sw_dest, {clobber:false}, function (err) {
      console.log(err ? err : "Created /docs/");
      // OVerride default index.html
      ncp(path.join(__dirname, 'swagger-ui'), sw_dest, {clobber:true}, function (err) {
        console.log(err ? err : "Created /docs/index.html");
       });
     });
    
    // public/api
    //served by route//fs.writeFileSync(path.join(api_url, 'swagger.json'), JSON.stringify(swaggerSpec, null, '\t'));
  });

  // Template generation config
  var source_config = {
    methodAction: methodAction,
    moduleName: 'Test',
    className: 'Test',
    swagger: swaggerSpec,
    template: {
        class: fs.readFileSync(class_path, 'utf-8'),
        method: fs.readFileSync(method_path, 'utf-8'),
        request: fs.readFileSync(request_path, 'utf-8')
    }
  };

  // Make thr controller directory
  fs.mkdir(controller_dir, function(err, resp) {
    if(err && err.code === 'EEXIST') console.log("Controllers already exists");
    else if(err) throw new Error(err);
    // Execute the template on the spec
    var source = CodeGen.getCustomCode(source_config);

    // Build the mapping file based on a convention in the handler.js
    // TODO: build mappings based on the Swagger.json
    var controllerHash = {};
    var controllerHandlerMaps = source.match(/\(\((.*)\)\)/g);
    _.forEach(controllerHandlerMaps, function(controllerHandler) {
      var handler = controllerHandler.replace(/\(\((.*)=>.*/, "$1");
      var controller = controllerHandler.replace(/.*=>(.*)\)\)/, "$1");
      //console.log(handler, controller);
      controllerHash[handler] = controller;
    });
    fs.writeFileSync(fileList, JSON.stringify(controllerHash, null, '\t'));

    // Write the handler JS file that directs the web request
    fs.writeFileSync(path.join(base_dir, 'handler.js'), source);
    console.log("handler.js saved");

    // Optionally generate a local copy of the server
    if(options.genlocal) {
      copyFileIfNew(server_path, path.join(base_dir, 'server.js'), file_flag);
    }
  });
};

module.exports = new Lambdapi();

// Copy a file if it doesn't already exists
function copyFileIfNew(from, to, file_flag) {
  if(!file_flag) file_flag = 'wx';
  try {
    var data = fs.readFileSync(from);
    fs.writeFileSync(to, data, {'flag': file_flag});

    console.log(path.relative(process.cwd(), to) + " created.");
  } catch(err) {
    if(err && err.code === 'EEXIST') console.log(path.relative(process.cwd(), to) + " already exists");
    else if(err) throw new Error(err);
  }
}
