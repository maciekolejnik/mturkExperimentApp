// server/index.js

/** Server code for the AMT trust experiment web app.
 * It defines some endpoints for running the trust game,
 * but most importantly, it calls webppl (and in particular,
 * the webppl-cognitive-agents library) to generate behaviour
 * of the bot. The following flow of API calls is expected
 * for each participant of the experiment:
 *
 * 1) POST /new
 *    and include all the questionnaire answers
 *    response will include all the parameters of the game, i.e.
 *    -
 *
 */

/** load external libraries */
const path = require('path');
const express = require("express");
const bodyParser = require('body-parser');
const assert = require('assert').strict;

/** load local stuff */
const mturk = require('./mturk/mturk');
const params = require('./params');
const aux = require('./util/auxiliary');
const {gameInit} = require('./gameInit');
const { createQueue } = require('./worker/redisAux');
const log = aux.log;

/** INITIALISE SERVER */
const PORT = process.env.PORT || 3001;

/** Initialise params that can be set via env variable */
const HORIZON = parseInt(process.env.HORIZON) || params.HORIZON
const COMPREHENSION_LIMIT = parseInt(process.env.COMPREHENSION_LIMIT)
  || params.COMPREHENSION_LIMIT

const app = express();

// parse application/json
app.use(bodyParser.json());
// parse text/plain
app.use(bodyParser.text());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, '../client/build')));
app.use(express.static(path.resolve(__dirname, '../client/public')));

/** SECTION: Server State */
// here we store bot's transfer computed by the worker and time taken
  // to compute it ({value, took}), indexed by userId.
let computedBotsTransfer = {};
// here we store last investment of participant until bot's return is computed
let participantsInvestment = {};
// maps ids of currently running computeAction jobs to { userId, started }
let actionJobs = {};
// once init job is complete, setup for the user is stored below
// it contains parameters of the game (k, endowments, horizon, roles) as
// well as game history (past investments/returns) which gets updated regularly
let record = {};
// if something goes wrong when performing computation for a given user,
// save that here (eg database errors)
let failure = {};

function printServerState() {
  log(
    `Server state:
  computeAction jobs currently running: ${Object.keys(actionJobs)}
  users currently playing the game: ${Object.keys(record)}`);
}

/** SECTION: Redis */
const actionQueue = createQueue('action');

function initQueues() {
  actionQueue.on('global:completed', (jobId, serialisedResult) => {
    log(`Job (${jobId}) completed with result ${serialisedResult}`);
    assert(actionJobs[jobId], `Job ${jobId} from actionQueue just completed 
  but not found in actionJobs record.`);
    const result = JSON.parse(serialisedResult);
    const actionJob = actionJobs[jobId];
    assert(actionJob, `Job ${jobId} just completed but not found in actionJobs`);
    const userId = actionJob.userId;
    assert(userId, `Job ${jobId} just completed but no userId found in actionJobs`);
    const started = actionJob.started;
    assert(started, `Job ${jobId} just completed but no started found in actionJobs`);
    const botTook = Math.trunc((aux.now() - started) / 1000);
    console.log(`Computing bot transfer for user ${userId} took ${botTook} seconds`);
    computedBotsTransfer[userId] = {
      value: result,
      took: botTook
    };
    delete actionJobs[jobId];
    if (userId in participantsInvestment) {
      record[userId].history.push({
        invested: participantsInvestment[userId].amount,
        returned: result,
        took: {
          bot: botTook,
          human: participantsInvestment[userId].time
        }
      });
      delete participantsInvestment[userId];
    }
  });

  actionQueue.on('global:failed', (jobId, err) => {
    console.log(`Job (${jobId}) failed due to ${err}`);
    const userId = actionJobs[jobId];
    failure[userId] = `Job ${jobId} failed: ${err}`;
    delete actionJobs[jobId];
  });

  actionQueue.on('global:stalled', (jobId) => {
    console.log(`Job (${jobId}) stalled!`);
    const userId = actionJobs[jobId];
    failure[userId] = `Job ${jobId} stalled.`;
    delete actionJobs[jobId];
  })
}

/** SECTION: Firestore */
const {Firestore} = require('@google-cloud/firestore');
// Create a new client
const firestore = new Firestore();

function timestamp() {
  return Firestore.Timestamp.now();
}

/** @return {Promise<boolean>}*/
async function testConnectivity() {
  // basic test, create a document, verify it's there, delete
    const testDocRef = firestore.collection('test').doc('test');
    return testDocRef.set({
      test: 'test'
    })
      .then(() => {
        log("Write successful.")
        return testDocRef.get()
      })
      .then(testDoc => {
        assert(testDoc.exists,
          "connectivity test: test doc just created does not exist");
        const data = testDoc.data();
        const testVal = data.test;
        // console.log(testDoc.data());
        // console.log(testDoc.exists);
        // console.log(testVal);
        assert.equal(testVal, 'test',
          "connectivity test: value for 'test' field of test doc unexpected");
        log("Read successful");
        return testDocRef.update({
          test: Firestore.FieldValue.delete()
        })
      })
      .then(() => {
        log("Delete field successful.");
        testDocRef.delete()
      })
      .then(() => {
        log("Delete document successful.");
        return true;
      })
      .catch(err => {
        console.log("Connectivity test failed:");
        throw err;
        // log(err);
      })
}

/** SECTION: API */

/** Big function that sets up all the API endpoints */
function initAPI(app, collection) {

  /** -----------------------
   *  API: /new
   *  should be called for every new participant to initiate a game
   *  answers to questions should be included in the body of the request
   *  as that allows us to initialise the game appropriately.
   *  ----------------------*/
  app.post("/new", async (req, res) => {
    console.log("GET /new");

    function validateRequestBody(body) {
      const demographicData = body.demographic;
      const questionnaireAnswers = body.questionnaire;

      assert(questionnaireAnswers.moneyRequest >= 0
        && questionnaireAnswers.moneyRequest <= 20,
        `/new moneyRequest passed in the body should be in [0,20]; 
        found: ${questionnaireAnswers.moneyRequest}`);
      assert(questionnaireAnswers.lottery1 in [0,1,2],
        `/new lottery1 passed in the body should be in [0,1,2]; 
        found: ${questionnaireAnswers.lottery1}`);
      assert(questionnaireAnswers.lottery2 in [0,1,2],
        `/new lottery2 passed in the body should be in [0,1,2]; 
        found: ${questionnaireAnswers.lottery2}`);
      assert(questionnaireAnswers.lottery3 in [0,1,2],
        `/new lottery3 passed in the body should be in [0,1,2]; 
        found: ${questionnaireAnswers.lottery3}`);
      assert(questionnaireAnswers.trust > 0 && questionnaireAnswers.trust <= 5,
        `/new: trust expected in [1,2,3,4,5]; found: ${questionnaireAnswers.trust}`);
      assert(questionnaireAnswers.altruism > 0 && questionnaireAnswers.altruism <= 5,
        `/new: altruism expected in [1,2,3,4,5]; found: ${questionnaireAnswers.altruism}`);

      assert(demographicData.age in [0,1,2,3,4]);
      assert(demographicData.gender in [0,1,2,3]);
      assert(demographicData.education in [0,1,2,3,4]);
      assert(demographicData.robot in [0,1,2,3,4]);
    }
    try {
      validateRequestBody(req.body);  
    } catch (err) {
      res.status(404).send(`Body of the request not as expected: ${err.message}`);
      return;
    }

    /** collect questionnaire answers from the body */
    const demographicData = req.body.demographic;
    const questionnaireAnswers = req.body.questionnaire;
    const timeSeries = req.body.timeSeries;

    // generate unique id for the participant
    const userId = aux.makeid(10);
    const lookAhead = parseInt(process.env.LOOKAHEAD) || params.LOOKAHEAD;
    // initialise the game for participant based on their questionnaire answers
    const result = gameInit(questionnaireAnswers, { lookAhead });
    const condition = result.condition;

    const botSetup = {
      params: result.params,
      initialState: result.initialState
    }
    // gameSetup is to be sent back to the user so game can be initialised
    const gameSetup = {
      k: params.K,
      unitToDollarRatio: params.UNIT_TO_DOLLAR_RATIO,
      horizon: condition.horizonDisclosed ? HORIZON : undefined,
      role: condition.role,
      endowments: {
        investor: params.INVESTOR_ENDOWMENT,
        investee: params.INVESTEE_ENDOWMENT
      }
    }
    // setup is 'internal', gets saved in database
    const setup = { ...gameSetup, horizon: HORIZON}
    /** initialise new participant */
    /** first, save to database
     * - questionnaire + demographics of participant
     * - game setup for this participant
     * - condition for that participant
     * - timestamp when submitted */
    const participantSetup = {
      botSetup,
      condition,
      gameSetup: setup
    }
    const botType = aux.getBotType(condition.botCoeffs);
    const belief = result.initialState.belief;
    const trust = result.initialState.trust;
    console.log(`User ${userId} will play against a ${botType} bot whose ` +
      `belief is ${belief} and estimates participant's trust to be ${trust}`);
    // delete initJobs[jobId];
    const docRef = collection.doc(userId);
    const now = aux.now();
    docRef.set({
      ...participantSetup,
      timestamps: {
        gotSetup: timestamp(),
        comprehension: []
      },
      comprehension: [],
      preQuestionnaire: {
        answers: questionnaireAnswers,
        timeSeries: timeSeries
      },
      demographic: demographicData,
      status: 'gotSetup'
    }, {merge: true})
      .then(() => {
        record[userId] = {
          botState: botSetup.initialState,
          botParams: botSetup.params,
          setup: gameSetup,
          history: [],
          gotSetup: now
        };
        res.json({ userId, setup: gameSetup });
      })
      .catch(error => {
        console.log(`Unable to initialise user ${userId} in the 
        database: write failed; ${error.message}`);
        res.status(500).send("Sorry, something went wrong on our side. " +
          "Please try again. If the problem persists, get in touch and we'll" +
          " approve your assignment.");
      });
  });

  /** -----------------------
   *    API: /comprehension
   *  ----------------------*/
  app.post("/comprehension", async (req, res) => {
    const userId = req.query.userId;
    console.log(`POST /comprehension from user ${userId}`);
    const answers = req.body.answers;
    const answersAsInt = 100 * answers[0] + 10 * answers[1] + answers[2];
    const correct = answersAsInt === 684
    const attempt = req.body.attempts;
    // console.log(`attempt: ${attempt} of type ${typeof attempt}, limit: ${COMPREHENSION_LIMIT}`)
    const last = attempt === COMPREHENSION_LIMIT
    const progress = correct ? 'passed' : (last ? 'failed' : 'lastChance')
    const now = aux.now();
    const started = record[userId].gotSetup;
    const secondsElapsedComprehending = (now - started) / 1000;
    const bonus = aux.comprehensionBonus(correct, last, secondsElapsedComprehending)
    const docRef = collection.doc(userId);
    try {
      await docRef.set({
        comprehension: Firestore.FieldValue.arrayUnion(answersAsInt),
        timestamps: {
          comprehension: Firestore.FieldValue.arrayUnion(timestamp())
        },
        status: progress,
        comprehensionBonus: bonus
      }, {merge: true});
      const status = {
        correct, last, bonus
      }
      res.json(status);
    } catch (error) {
      console.log(`Failed to save demographic and questionnaire answers to database
       for user ${userId}: ${error}`);
      res.status(500).send("Sorry, something went wrong on our side. " +
        "Please try again. If the problem persists, get in touch and we'll" +
        " approve your assignment.");
    }
  });

  /** -----------------------
   *    API: /play inform play is started
   *  ----------------------*/
  app.post("/play", async (req, res) => {
    const userId = req.query.userId;
    console.log(`POST /play from user ${userId}`);
    const docRef = collection.doc(userId);
    try {
      await docRef.set({
        status: 'playStarted',
        timestamps: {
          playStart: Firestore.Timestamp.now()
        }
      }, {merge: true});
    } catch (err) {
      const msg = `Database write failed: ${err.message}`
      console.log(msg);
      res.status(500).send(msg);
    }
    res.sendStatus(200);
  });

  /** -----------------------
   *    API: /finish inform proceeded to post game questionnaire
   *  ----------------------*/
  app.post("/finish", async (req, res) => {
    const userId = req.query.userId;
    console.log(`POST /finish from user ${userId}`);
    const docRef = collection.doc(userId);
    try {
      await docRef.set({
        status: 'postQuestionnaire',
        timestamps: {
          proceed: Firestore.Timestamp.now()
        }
      }, {merge:true});
    } catch (err) {
      const msg = `Database write failed: ${err.message}`
      console.log(msg);
      res.status(500).send(msg);
    }
    res.sendStatus(200);
  });

  /** -----------------------
   *      API: /invest
   *  ----------------------*/
  app.post('/invest',  async (req, res) => {
    const userId = req.query.userId;
    const invested = parseInt(req.query.amount);
    const time = parseInt(req.query.time);
    console.log(`POST /invest ${invested} from user ${userId}`);
    if (userId === undefined) {
      res.status(400).send("User ID must be given");
      return;
    }
    if (invested === undefined) {
      res.status(400).send("Invested amount must be given " +
        "(as request parameter)");
      return;
    }
    if (record[userId] === undefined) {
      res.status(400).send("User ID unrecognised. Make sure to GET /new.");
      return;
    }
    if (!participantsInvestment[userId]) {
      let job = await actionQueue.add('return', {
        record: record[userId],
        userId,
        investment: invested
      });
      const jobId = job.id
      participantsInvestment[userId] = {
        amount: invested,
        time: time,
        returnJob: jobId
      };
      // computedBotsTransfer[userId] = null;
      actionJobs[jobId] = {
        userId,
        started: aux.now()
      };
      res.json({ id: jobId });
      return;
    }
    const jobId = participantsInvestment[userId].returnJob;
    res.json({ id: jobId });
  });

  app.get('/invest/:jobId', async (req, res) => {
    let jobId = req.params.jobId;
    let userId = req.query.userId;
    log(`POST /invest/${jobId} from user ${userId}`);
    if (jobId === undefined) {
      res.status(400).send("Job ID must be given");
      return;
    }
    if (userId === undefined) {
      res.status(400).send("User ID must be given");
      return;
    }
    if (record[userId] === undefined) {
      res.status(400).send("User ID unrecognised. Make sure to GET /new.");
      return;
    }
    let job = await actionQueue.getJob(jobId);
    if (job === null) {
      res.status(404).end();
    } else {
      let state = await job.getState();
      let reason = job.failedReason;
      let amount = computedBotsTransfer[userId]?.value;
      const finished = record[userId].history.length >= HORIZON;
      const ready = !(jobId in actionJobs);
      const error = failure[userId];
      const result = {
        finished,
        amount
      };
      log(`POST /invest/${jobId} returning job ${jobId} with state 
      ${state}, ready: ${ready}, amount: ${amount}`);
      res.json({ id: jobId, state, reason, ready, result, error });
    }
  });

  /** -----------------------
   *      API: /query
   *  ----------------------*/
  app.get('/query', async (req,res) => {
    const userId = req.query.userId;
    console.log("GET /query from user " + userId);
    if (userId === undefined) {
      res.status(400).send("User ID must be given");
      return;
    }
    if (record[userId] === undefined) {
      res.status(400).send("User ID unrecognised. Make sure to GET /new.");
      return;
    }
    let job = await actionQueue.add('invest', {
      userId,
      record: record[userId]
    });
    computedBotsTransfer[userId] = null;
    const started = aux.now();
    actionJobs[job.id] = {
      userId,
      started
    };
    res.json({ id: job.id });
  });

  // Allows the client to query the state of a background job
  app.get('/query/:jobId', async (req, res) => {
    let jobId = req.params.jobId;
    let userId = req.query.userId;
    log(`GET /query/${jobId} from user ${userId}`);
    if (jobId === undefined) {
      res.status(400).send("User ID must be given");
      return;
    }
    if (userId === undefined) {
      res.status(400).send("User ID must be given");
      return;
    }
    if (record[userId] === undefined) {
      res.status(400).send("User ID unrecognised. Make sure to GET /new.");
      return;
    }
    let job = await actionQueue.getJob(jobId);
    if (job === null) {
      res.status(404).end();
    } else {
      let state = await job.getState();
      let reason = job.failedReason;
      let ready = !(jobId in actionJobs);
      let amount = computedBotsTransfer[userId]?.value;
      let result = { amount };
      res.json({ id: jobId, state, reason, ready, result});
    }
  });

  /** -----------------------
   *      API: /return
   *  ----------------------*/
  app.post('/return', async (req, res) => {
    const userId = req.body.userId;
    const returned = req.body.returned;
    const time = req.body.time;
    console.log(`GET /return ${returned} from user ${userId}`);
    if (userId === undefined) {
      res.status(400).send("User ID must be given");
      return;
    }
    if (returned === undefined) {
      res.status(400).send("Returned amount must be given");
      return;
    }
    if (record[userId] === undefined) {
      res.status(400).send("User ID unrecognised. Make sure to GET /new.");
      return;
    }
    /** detect if /return came after /query, if not, ignore */
    if (computedBotsTransfer[userId]) {
      record[userId].history.push({
        invested: computedBotsTransfer[userId].value,
        returned: returned,
        took: {
          bot: computedBotsTransfer[userId].took,
          human: time
        }
      });
      delete computedBotsTransfer[userId];
    }
    const finished = record[userId].history.length >= HORIZON;
    console.log("GET /return OK");
    res.json({finished: finished});
  });

  /** -----------------------
   *      API: /submit POST
   *  ----------------------*/
  app.post('/submit', async (req,res) => {
    const userId = req.query.userId;
    console.log("POST /submit from user " + userId);
    const feedback = req.body.feedback;
    const postQuestionnaire = req.body.answers;
    const docRef = collection.doc(userId);
    const userRecord = record[userId];
    const gameSetup = userRecord.setup
    const finished = timestamp()
    const history = userRecord.history;
    const earned = aux.computeEarnings(history, gameSetup);
    const requestToken = aux.makeid(20);
    const data = {
      history,
      feedback,
      postQuestionnaire,
      earned,
      requestToken,
      timestamps: {
        finished
      },
      status: 'submitted'
    }
    docRef.set(data, {merge: true})
      .then(() => {
        console.log("POST /submit OK");
        delete record[userId];
        res.status(200).end();
      })
      .catch(err => {
        console.log("Failed to save interaction data for user " + userId,
          err, err.message);
        res.status(500);
        return res.send(err.message);
      });
  });

  /** -----------------------
   *      API: /offload DELETE
   *  ----------------------*/
  app.delete('/offload', function (req, res) {
    const userId = req.query.userId;
    console.log("DELETE /offload for user " + userId);
    if (record[userId] !== undefined) {
      delete record[userId];
      console.log("DELETE /offload OK")
      res.status(200).send("Offloaded successfully");
    } else {
      res.status(404).send("User " + userId + " not found");
    }
  });

// All other GET requests not handled before will return our React app
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

function main() {
  testConnectivity()
    .then(() => {
      aux.setupPeriodicDebugLogs(printServerState);
      return mturk.createHIT();
    })
    .then((HITId) => {
      const collection = firestore.collection(HITId);
      initQueues();
      initAPI(app, collection);
      mturk.setupPeriodicChecksForHIT(HITId);
      app.listen(PORT, () => {
        console.log(`Server listening on ${PORT}`);
      });
    })
    .catch(err => {
      console.log(err);
      console.log("Exiting...");
      process.exit(1);
    });
}

main();

