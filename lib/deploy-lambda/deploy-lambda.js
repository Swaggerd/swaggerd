'use strict';

//var aws = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var os = require('os');
var packageJson = require('./../package.json');
var path = require('path');
var async = require('async');
var zip = new require('node-zip')();
var wrench = require('wrench');
var dotenv = require('dotenv');

//new
var noderx = require('./utils/noderx.js');

var rx = require('rxjs-plus'),
	_ = require('lodash'),
	rxo = rx.Observables,
	rxn = rxo.fromNodeCallback;

require('rxjs-aws');
var aws = rxo.aws;

var Lambda = function () {
  this.version = packageJson.version;

  return this;
};

Lambda.prototype._createSampleFile = function (file) {
  var exampleFile = process.cwd() + '/' + file;
  var boilerplateFile = __dirname + '/' + file + '.example';

  if (!fs.existsSync(exampleFile)) {
    fs.writeFileSync(exampleFile, fs.readFileSync(boilerplateFile));
    console.log(exampleFile + ' file successfully created');
  }
};

Lambda.prototype.setup = function () {
  console.log('Running setup.');
  this._createSampleFile('.env');
  this._createSampleFile('event.json');
  this._createSampleFile('deploy.env');
  console.log('Setup done. Edit the .env, deploy.env, and event.json files as needed.');
};

Lambda.prototype._runHandler = function (handler, event) {
  var context = {
    succeed: function (result) {
      console.log('succeed: ' + result);
      process.exit(0);
    },
    fail: function (error) {
      console.log('fail: ' + error);
      process.exit(-1);
    },
    done: function () {
      process.exit(0);
    }
  };

  handler(event, context);
};

// Keep
Lambda.prototype._params = function (program, buffer) {
  var params = {
    FunctionName: program.functionName + (program.environment ? '-' + program.environment : ''),
    Code: { ZipFile: buffer },
    Handler: program.handler,
    Role: program.role,
    Runtime: program.runtime,
    Description: program.description,
    MemorySize: program.memorySize,
    Timeout: program.timeout
  };
  if (program.version) {
    // TODO FIX
    //params.FunctionName += ('-' + program.version);
  }

  return params;
};

// Keep?
Lambda.prototype._codeDirectory = function (program) {
  var epoch_time = +new Date();

  return os.tmpDir() + '/' + program.functionName + '-' + epoch_time;
};

// Keep
Lambda.prototype._setEnvironmentVars = function (program, codeDirectory) {
  console.log('=> Setting "environment variables" for Lambda from %s', program.configFile);
  // Which file is the handler?
  var handlerFileName = codeDirectory + '/' + program.handler.split('.').shift() + '.js';
  var contents = fs.readFileSync(handlerFileName);

  var configValues = fs.readFileSync(program.configFile);
  var prefix = '////////////////////////////////////\n// "Environment Variables"\n';
  var config = dotenv.parse(configValues);

  for (var k in config) {
    if (!config.hasOwnProperty(k)) {
      continue;
    }

    // Use JSON.stringify to ensure that it's valid code.
    prefix += 'process.env["' + k + '"]=' + JSON.stringify(config[k]) + ';\n';
  }
  prefix += '////////////////////////////////////\n\n';

  fs.writeFileSync(handlerFileName, prefix + contents.toString());
};



Lambda.prototype._upload = function(program, buffer) {
    var _this = this;
    buffer = buffer || program.buffer;
    program.buffer = buffer;
    console.log('=> Reading zip file to memory');
    var params = _this._params(program, buffer);

    async.map(program.regions, function (region, cb) {
      console.log('=> Uploading zip file to AWS Lambda ' + region + ' with parameters:');
      console.log(params);

      aws.config.update({
        region: region
      });

      var lambda = new aws.Lambda();

    // Check If Lambda Function Exists Already
    lambda.getFunction({
        FunctionName: params.FunctionName
    }).subscribe(function(data) {
        //if (err && err.code !== 'ResourceNotFoundException') return console.log(err, err.stack);

        if (!data || !data.Code) {
            /**
             * Create New Lambda Function
             */

            console.log('=> Uploading your Lambda Function to AWS Lambda with these parameters: ');
            console.log(params);

            lambda.createFunction(params, function(err, data) {
                //lambda_arn = data;
                return cb(err, data);
            });

        } else {
            /**
             * Delete Existing & Create New Lambda Function
             */
            console.log('=> Updating existing Lambda function...');
            params.Code.FunctionName = params.FunctionName;
            lambda.updateFunctionCode(params.Code, function(err, data) {
                if (err) return console.log(err, err.stack);
                console.log('=> Updating existing Lambda config...');
                var update_params = {
                  FunctionName: params.FunctionName,
                  Description: params.Description,
                  Handler: params.handler,
                  MemorySize: params.MemorySize || 0,
                  Role: params.Role,
                  Timeout: params.Timeout || 0
                };
                lambda.updateFunctionConfiguration(update_params, function(err, data) {
                    if (err) return console.log(err, err.stack);
                    return cb(err, data);
                });
            });
        }
    });

      /*lambda.uploadFunction(params, function (err, data) {
        cb(err, data);
      });*/

    }, function (err, results) {
      if (err) {
        console.error(err);
      } else {
        console.log('=> Zip file(s) done uploading. Results follow: ');
        console.log(results);
        if(program.onComplete) program.onComplete();
      }
    });
}

// program.functionName
// program.region = ","
Lambda.prototype.deploy = function (program) {
  this._createSampleFile('.env');

  // Warn if not building on 64-bit linux
  var arch = process.platform + '.' + process.arch;
  if (arch !== 'linux.x64') {
    console.warn('Warning!!! You are building on a platform that is not 64-bit Linux (%s). ' +
      'If any of your Node dependencies include C-extensions, they may not work as expected in the ' +
      'Lambda environment.\n\n', arch);
  }

  var _this = this;
  program.regions = program.region.split(',');
  var codeDirectory = _this._codeDirectory(program);

  console.log('=> Moving files to temporary directory');
  // Move all files to tmp folder (except .git, .log, event.json and node_modules)

  noderx.rsync(codeDirectory).subsctibe(function (err) {
    console.log('=> Running npm install --production');

      // Add custom environment variables if program.configFile is defined
      if (program.configFile) {
        _this._setEnvironmentVars(program, codeDirectory);
      }
      console.log('=> Zipping deployment package');

      noderx.zip(codeDirectory).subscribe(function (buffer) {
        _this._upload(program, buffer);
      });

  });
};

module.exports = new Lambda();
