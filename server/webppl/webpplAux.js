/** This file encapsulated the complexity of webppl by exposing a
 *  simple interface:
 *  - */

const path = require('path');
const fs = require('fs');
const webppl = require('webppl');
const util = require('webppl/src/util');
const log = require('../util/auxiliary').log;
const DEBUG = process.env.DEBUG;

function loadWebpplBundles() {
  const packageNames = ['webppl-cognitive-agents'];
  const packages = packageNames.map(name => {
    const packagePath = path.resolve(__dirname, `../../node_modules/${name}`);
    const manifestPath = path.join(packagePath, 'package.json');
    const manifest = require(manifestPath);
    const packageFilePaths = manifest.webppl.wppl.map(relPath => {
      return path.join(packagePath, relPath);
    });
    const package = {
      wppl: packageFilePaths.map(filePath => {
        return {
          code: fs.readFileSync(filePath, 'utf8'),
          filename: filePath
        }
      })
    }
    return package;
  })
  const bundles = webppl.parsePackageCode(packages);
  return bundles;
}

function loadAndCompileScript(scriptName, callerId) {
  const filePath = path.resolve(__dirname, scriptName);
  const script = fs.readFileSync(filePath, 'utf8');
  const options = {
    verbose: DEBUG,
    bundles
  }
  const jobName = `compile ${scriptName} for ${callerId}`;
  const codeAndAssets = util.timeif(options.verbose, jobName, () => webppl.compile(script, options));
  return codeAndAssets;
}

let bundles;
let computeAction;
// let gameInitScript;
let prediction;
let callerId;

function init(thisCallerId) {
  bundles = loadWebpplBundles();
  computeAction = loadAndCompileScript('computeAction.wppl', thisCallerId);
  // gameInitScript = loadAndCompileScript('gameInit.wppl', thisCallerId);
  prediction = loadAndCompileScript('predictions.wppl', thisCallerId);
  callerId = thisCallerId;
  return true
}


function getErrorHandlerFor(scriptName, callback) {
  function handleError(error) {
    const message = error.toString();
    console.log(`Error caught in ${scriptName} script: ${message}`);
    const result = {
      error: true,
      message
    };
    callback(result);
  }
  return handleError;
}

function getOptions(params, scriptName, callback) {
  const errorHandler = getErrorHandlerFor(scriptName, callback);
  const globalStore = {
    ...params,
    loggingLevel: DEBUG
  }
  const options = {
    verbose: DEBUG > 1,
    bundles,
    initialStore: globalStore,
    errorHandlers: [errorHandler]
  }
  return options
}

/** computes action of the bot */
function computeBotAction(params, callback) {
  if (!computeAction) {
    throw new Error('webpplAux uninitialised');
  }
  const options = getOptions(params, 'computeAction', callback);
  log('webpplAux.js: Calling webppl.run() with computeActionScript now');
  const k = (s, result) => {
    log('webpplAux.js: computeAction script terminated successfully: ' +
      JSON.stringify(result));
    callback(result);
  }
  const jobName = `computeBotAction for worker ${callerId}`;
  util.timeif(options.verbose, jobName, webppl.prepare(computeAction, k, options).run);
}



function testWppl(callback) {
  const options = getOptions({}, 'testScript', callback);
  webppl.run("let a = flip() ? 'hello' : 'good bye'; display(a + ' world'); 1", function (s,result) {
    callback(result);
  }, options);
}

function evaluatePredictions(params, callback) {
  if (!prediction) {
    throw new Error('webpplAux uninitialised');
  }
  log("webpplAux.js: evaluatePredictions")
  const options = getOptions(params, 'prediction', callback);
  const k = (s, result) => {
    callback(result);
  }
  webppl.prepare(prediction, k, options).run();
}

module.exports = {
  computeBotAction,
  evaluatePredictions,
  testWppl,
  init
}