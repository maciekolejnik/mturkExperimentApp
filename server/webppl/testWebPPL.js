const webpplAux = require('./webpplAux');

function callback(result) {
  if (result.error) {
    console.log(`WebPPL test failed: ${result.message}`);
  } else {
    console.log(`WebPPL test succeeded`);
  }
  process.exit(1);
}

webpplAux.testWppl(callback);