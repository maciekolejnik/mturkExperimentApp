/** This file queries the database (collection id must be specified below)
 * that contains plays of trust game and uses webppl-cognitive-agents library
 * to generate behaviour predictions. It then evaluates those predictions and
 * saves the evaluations in a json file consisting of following objects:
 * {
 *   userId,
 *   pmse
 * }
 *
 * GOOGLE_APPLICATION_CREDENTIALS must be set to an appropriate credentials
 * (in our case, prod) file so that this file can talk to the database
 */

const webpplAux = require('../webppl/webpplAux');
const log = require('../util/auxiliary').log;
const {Firestore} = require('@google-cloud/firestore');

/** params */
const WRITE = true;
const HITID = "3HJ1EVZS3T8TBOSXTPWY3UWPO5NR34";

if (!webpplAux.init('script')) {
  process.exit(1)
}
console.log('prediction script initialised')

const firestore = new Firestore();

async function main() {
  try {
    const hitCollection = firestore.collection(HITID).orderBy('earned');
    const hitSnapshot = await hitCollection.get();
    const resultPromises = hitSnapshot.docs.map(doc => {
      log(`Retrieved data for user ${doc.id}`);
      return evaluatePlay(doc);
    });
    const results = await Promise.all(resultPromises);
    const writeToDBPromises = results.map(result => {
      return writeToDb(result);
    })
    return Promise.all(writeToDBPromises);
  } catch (err) {
    console.log(`Something went wrong: ${err}`);
  }
}

function writeToDb(value) {
  const userId = value.user;
  return new Promise((resolve, reject) => {
    if (!WRITE) resolve(true);
    const docRef = firestore.collection(`${HITID}evals`).doc(userId);
    docRef.set({
      predictions: {
        pmses: value.pmses,
        mses: value.mses,
        fses: value.fses
      }
    }, { merge: true })
      .then(() => {
        resolve(true)
      })
      .catch(err => {
        console.log(`Error writing to the database: ${err.message}`);
        reject();
      });
  });
}

/** evaluates predictions for a given play (represented as
 * data from database)
 * returns a promise */
function evaluatePlay(playDoc) {
  const data = playDoc.data();
  const params = {
    botSetup: data.botSetup,
    history: data.history
  }
  return new Promise((resolve, reject) => {
    webpplAux.evaluatePredictions(params, function(result) {
      if (result.error === undefined) {
        const pmses = result.pmses;
        const mses = result.mses;
        const fses = result.fses;
        console.log(`PMSEs for user ${playDoc.id}: ${pmses}`);
        const evaluation = {
          user: playDoc.id,
          horizon: data.condition.horizonDisclosed,
          pmses: pmses,
          mses: mses,
          fses: fses
        }
        resolve(evaluation);
      } else {
        console.log(`evaluating predictions failed: ${result.error.message}`);
        reject(result.error.message);
      }
    });
  });
}

main().then(() => {
  process.exit(1);
})
