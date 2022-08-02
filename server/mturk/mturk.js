const path = require('path');
const fs = require('fs');
const parseString = require('xml2js').parseString;
const assert = require('assert').strict;
const params = require('../params');

const {Firestore} = require('@google-cloud/firestore');
const firestore = new Firestore();

const aux = require('../util/auxiliary');
const log = aux.log;

/** initialise and test MTurk */
const AWS = require('aws-sdk');

const region_name = 'us-east-1';
const endpoint = process.env.MTURK_PROD === 'true' ?
  'https://mturk-requester.us-east-1.amazonaws.com' :
  'https://mturk-requester-sandbox.us-east-1.amazonaws.com';

AWS.config.update({
  region: region_name,
  endpoint: endpoint
});

const mturk = new AWS.MTurk();

const filePath = path.resolve(__dirname, 'mturk_question.xml');
const mturkQuestion = fs.readFileSync(filePath, 'utf8');
const HITSetupDev = {
  Title: 'Earn at least $2 by playing a money-exchange game with a bot',
  Description: 'Participate in a research study by taking a short questionnaire ' +
    'followed by playing a simple investment game with an artificial agent. ' +
  'Note: to qualify for the game and earn upwards of $2 you must first pass a comprehension check.',
  Question: mturkQuestion,
  Reward: '0.2',
  AssignmentDurationInSeconds: 1*60*60, // 1 hours
  LifetimeInSeconds: 2*60*60, // 2 hours
  Keywords: 'game,trust,investment,robot,AI',
  MaxAssignments: 15,
  AutoApprovalDelayInSeconds: 12*60*60, // 12 hours
  QualificationRequirements: [
    {
      Comparator: 'GreaterThan',
      QualificationTypeId: '000000000000000000L0',
      IntegerValues: [95]
    }
  ]
}
const HITSetupProd = {
  Title: 'Earn at least $2 by playing a money-exchange game with a bot',
  Description: 'Participate in a research study by taking a short questionnaire ' +
    'followed by playing a simple investment game with an artificial agent. ' +
    'Note: to qualify for the game and earn upwards of $2 you must first pass a comprehension check.',
  Question: mturkQuestion,
  Reward: '0.2',
  AssignmentDurationInSeconds: 2*60*60, // 2 hours
  LifetimeInSeconds: 48*60*60, // 48 hours
  Keywords: 'game,trust,investment,robot,AI',
  MaxAssignments: 150,
  AutoApprovalDelayInSeconds: 24*60*60, // 24 hours
  QualificationRequirements: [
    { // master qualification
      Comparator: 'Exists',
      QualificationTypeId: '2F1QJWKUDD8XADTFD2Q0G6UTO95ALH'
    },
    {
      Comparator: 'GreaterThan',
      QualificationTypeId: '000000000000000000L0',
      IntegerValues: [95]
    }
  ]
}

/** this function attempts to create a HIT (unless MTURK is set to 'false')
 * and, if successful, calls callback function passing it the HIT data
 * structure for the created HIT
 * @return {Promise<string>}
 */
async function createHIT() {
  return new Promise((resolve, reject) => {
    if (process.env.MTURK != 'true') {
      // slightly hacky - if MTURK not true, use sessions collection
      return resolve(process.env.NAME || 'sessions');
    }
    console.log("About to create an MTurk HIT.");
    console.log("Check account balance first");
    mturk.getAccountBalance({}, function (err, data) {
      if (err) {
        console.log(`createHIT(): failed to get account balance: ${err}`);
        reject(err);
      } else {
        const balance = data.AvailableBalance;
        assert(parseFloat(balance) > 0, `createHIT(): balance 
          not positive: ${parseFloat(balance)}`);
        console.log("Balance: " + balance + " > 0. Proceeding...");
        const existingHIT = process.env.HITId;
        if (existingHIT) {
          mturk.getHIT({ HITId: existingHIT }, function(err, data) {
            if (err) {
              console.log(`Failed to retrieve the HIT  ${existingHIT}: ${err}`);
              reject(err)
            } else {
              console.log("Recovered existing HIT " + existingHIT);
              resolve(data.HIT.HITId);
            }
          });
        } else {
          const HITSetup = process.env.MTURK_PROD === 'true' ?
            HITSetupProd : HITSetupDev
          mturk.createHIT(HITSetup, function (err, data) {
            if (err) {
              console.log(`Failed to create a HIT: ${err}`);
              reject(err);
            } else {
              console.log("Successfully created a HIT (" + data.HIT.HITId + ")!");
              resolve(data.HIT.HITId);
            }
          });
        }
      }
    });
  });
}

/** pre: data.comprehensionBonus > 0 */
function sendBonus(assignmentID, workerID, data,
                   participantDocRef, assignmentDocRef) {
  const requestToken = data.requestToken;
  let parameters = {
    AssignmentId: assignmentID,
    WorkerId: workerID,
    UniqueRequestToken: requestToken
  };
  const role = data.gameSetup.role;
  if (data.status == 'failed') {
    parameters.BonusAmount = data.comprehensionBonus.toFixed(2);
    parameters.Reason = "Sorry you weren't able to pass the comprehension " +
      "check. Thanks for the effort though."
  } else {
    // const earned = data.earned ? data.earned[role] : null;
    const earningsBonus = data.earned &&
      data.earned[role] / params.UNIT_TO_DOLLAR_RATIO;
    const totalEarnings = data.comprehensionBonus + earningsBonus
    parameters.BonusAmount = totalEarnings.toFixed(2);
    parameters.Reason = 'Your bonus reflects your earnings in the game ' +
    'and the fact that you completed the game.';
  }
  mturk.sendBonus(parameters, function(err, data) {
    if (err) {
      const msg = `Failed to send bonus: ${err.message}`;
      assignmentDocRef.set({
        error: msg
      }, { merge: true })
    } else {
      const bonusMsg = `${parameters.BonusAmount} sent successfully`;
      participantDocRef.set({
        bonus: bonusMsg
      }, { merge: true });
      assignmentDocRef.set({
        bonus: parameters.BonusAmount
      }, { merge: true });
    }
  });
}

function approveAssignment(assignmentID, workerID, data,
                           participantDocRef, assignmentDocRef) {
  mturk.approveAssignment({
    AssignmentId: assignmentID,
    RequesterFeedback: 'Thanks for participating. You should have received your bonus by now.'
  }, function (err) {
    if (err) {
      return assignmentDocRef.set({
        error: `Failed to approve: ${err.message}`
      }, { merge: true })
    }
    const approved = Firestore.Timestamp.now();
    assignmentDocRef.set({
      approved
    }, { merge: true })
    participantDocRef.set({
      timestamps: {
        approved
      }
    }, {merge: true})
      .catch(err => {
        log("Failed to write approval confirmation to database:", err, err.message);
      })
      .finally(() => {
        if (data.comprehensionBonus > 0) {
          sendBonus(assignmentID, workerID, data,
            participantDocRef, assignmentDocRef);
        }
      })
  });
}

function rejectAssignment(assignmentID, workerID, reason, assignmentDocRef) {
  const params = {
    AssignmentId: assignmentID,
    RequesterFeedback: reason
  };
  mturk.rejectAssignment(params, function(err, data) {
    if (err) {
      assignmentDocRef.set({
        error: `Rejecting assignment failed: ${err.message}`
      }, {merge: true });
    } else {
      assignmentDocRef.set({
        rejected: Firestore.Timestamp.now(),
        reason: reason
      }, {merge: true });
    }
  });
}
/** pre: answer is not null */
function processAnswer(answer, workerID, assignmentID, HITId, assignmentDocRef) {
  // answer is an XML string, so need to parse
  parseString(answer, function (err, result) {
    if (err) {
      assignmentDocRef.set({
        error: `XML parsing failed: ${err.message}`
      }, { merge: true });
      return;
    }
    // retrieve participant input (userID, provided to them on game completion)
    const code = result.QuestionFormAnswers.Answer[3].FreeText[0];
    log("Successfully parsed XML. Retrieved code: ", code);
    assignmentDocRef.set({ code }, { merge: true });
    const participantDocRef = firestore.collection(HITId).doc(code);
    participantDocRef.get().then(documentSnapshot => {
      if (documentSnapshot.exists) {
        const data = documentSnapshot.data();
        log("Database entry for the user found");
        approveAssignment(assignmentID, workerID, data,
          participantDocRef, assignmentDocRef);
      } else {
        console.log("User " + code + " not found in the " +
          "database; rejecting assignment");
        const reason = `You've submitted ${code} as your unique code ` +
          'but our records show that no such code has been generated by our server. ' +
          'If you think this is an error on our side, please get in touch.'
        rejectAssignment(assignmentID, workerID, reason, assignmentDocRef);
      }
    });
  });
}

function processAssignments(assignments, HITId) {
  console.log(assignments.NumResults + ' new assignments found.');
  for (let i = 0; i < assignments.NumResults; i++) {
    const assignment = assignments.Assignments[i];
    const assignmentID = assignment.AssignmentId;
    const workerID = assignment.WorkerId;
    const answer = assignment.Answer;
    const assignmentDocRef = firestore.collection(HITId + 'assign').doc(assignmentID);
    console.log((i+1) + '. Assignment ' + assignmentID + ' from worker ' + workerID);
    assignmentDocRef.set({
        found: Firestore.Timestamp.now(),
        workerID: workerID
    });
    /** first check if worker participated before */
    const workerDocRef = firestore.collection('workers').doc(workerID);
    workerDocRef.get()
      .then(doc => {
        if (!doc.exists) {
          if (process.env.MTURK_PROD === 'true') {
            workerDocRef.set({
              HITId: HITId,
              AssignmentId: assignmentID
            })
            .catch(err => {
              console.log(`Failed to save document to 'workers' database: ${err.message}`);
            });
          }
          if (answer) {
            processAnswer(answer, workerID, assignmentID, HITId, assignmentDocRef);
          }
        } else {
          const worker = doc.data();
          const reason = `You have already participated in our experiment; ` +
            `in particular HIT ${worker.HITId} and your assignment was ` +
            `${worker.AssignmentId}.`
          rejectAssignment(assignmentID, workerID, reason, assignmentDocRef);
        }
      })
      .catch(err => {
        console.log(`Failed to access 'workers' collection: ${err.message}`);
        if (answer) {
          processAnswer(answer, workerID, assignmentID, HITId, assignmentDocRef)
        }
      });
  }
}

function checkAssignmentsForHIT(HITId) {
  console.log(`Checking assignments for HIT ${HITId}`);
  const params = {
    HITId,
    AssignmentStatuses: [ 'Submitted' ],
    MaxResults: 50
  }
  function recurse(token) {
    if (token) {
      console.log(`recurse with token ${token}`);
      const paramsWithToken = {
        ...params,
        NextToken: token
      }
      mturk.listAssignmentsForHIT(paramsWithToken, function(err, assignments) {
        if (err) {
          console.log("Couldn't retrieve assignments. ", err.message);
        } else {
          // console.log(`${assignments.NumResults} assignments found`);
          processAssignments(assignments, HITId);
          recurse(assignments.NextToken);
        }
      })
    }
  }
  log("Check for submitted assignments.");
  mturk.listAssignmentsForHIT(params, function (err, assignmentsForHIT) {
    if (err) {
      console.log("Couldn't retrieve assignments. ", err.message);
    } else {
      // console.log(`${assignmentsForHIT.NumResults} assignments found`);
      processAssignments(assignmentsForHIT, HITId);
      recurse(assignmentsForHIT.NextToken);
    }
  });
}

function setupPeriodicChecksForHIT(HITId) {
  if (process.env.MTURK === 'true') {
    const interval = 5 * 60 * 1000; // 5 minutes
    setInterval(function () {
      return checkAssignmentsForHIT(HITId);
    }, interval);
  }
}

/** ExTERNAL */

function printBalance() {
  mturk.getAccountBalance({}, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function listHITs() {
  function printHITSummary(HIT) {
    console.log(`HIT ${HIT.HITId}`);
    console.log(HIT.Title);
    console.log(`Created on: ${HIT.CreationTime}`);
    console.log(`Status: ${HIT.HITStatus}`);
  }
  mturk.listHITs({}, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      console.log(`Found ${data.NumResults} HITs:`);
      data.HITs.forEach((HIT, i) => {
        process.stdout.write(`${i+1}. `);
        printHITSummary(HIT);
      })
    }
  });
}

function listAssignmentsForHIT(HITId, status) {
  let params = {
    HITId: HITId,
    MaxResults: 100
  }
  if (status) {
    params.AssignmentStatuses = [status]
  }
  const desc = status || 'Completed'
  mturk.listAssignmentsForHIT(params, function (err, assignmentsForHIT) {
    if (err) {
      console.log(err.message);
    } else {
      console.log(`${assignmentsForHIT.NumResults} ${desc} assignments found`);
      for (var i = 0; i < assignmentsForHIT.NumResults; i++) {
        const assignment = assignmentsForHIT.Assignments[i];
        const statusDesc = status ? '' : `\nStatus: ${assignment.AssignmentStatus}`;
        const answer = assignmentsForHIT.Assignments[i].Answer
        parseString(answer, function (err, result) {
          if (err) {
            log("XML parsing failed: ", err.message);
          } else {
            // retrieve participant input (userID, provided to them on game completion)
            const code = result.QuestionFormAnswers.Answer[2].FreeText[0];
            console.log(`${i+1}. ${assignment.AssignmentId} from worker ${assignment.WorkerId}` +
              `.\nAnswer: ${code}${statusDesc}`);
          }
        })
      }
    }
  });
}

function approveAllAssignmentsForHIT(HITId) {
  mturk.listAssignmentsForHIT({HITId: HITId}, function (err, assignmentsForHIT) {
    if (err) {
      console.log(err.message);
    } else {
      console.log('Completed Assignments found: ' + assignmentsForHIT.NumResults);
      for (var i = 0; i < assignmentsForHIT.NumResults; i++) {
        console.log('Answer from Worker with ID - ' + assignmentsForHIT.Assignments[i].WorkerId + ': ', assignmentsForHIT.Assignments[i].Answer);
        // Approve the work so the Worker is paid with and optional feedback message
        mturk.approveAssignment({
          AssignmentId: assignmentsForHIT.Assignments[i].AssignmentId,
          RequesterFeedback: 'Thanks for the great work!',
        }, function (err) {
          if (err) {
            console.log(err, err.stack);
          }
        });
      }
    }
  });
}

function checkHITStatus(HITId) {
  const params = {
    HITId
  };
  mturk.getHIT(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      const HIT = data.HIT
      console.log(`HIT ${HIT.HITId}`);
      console.log(`Status: ${HIT.HITStatus}`);
      console.log(`Created: ${HIT.CreationTime}`);
      console.log(`Expires: ${HIT.Expiration}`);
      console.log('Assignments:');
      console.log(`  Completed: ${HIT.NumberOfAssignmentsCompleted}`);
      console.log(`  Available: ${HIT.NumberOfAssignmentsAvailable}`);
      console.log(`  Pending: ${HIT.NumberOfAssignmentsPending}`);
      console.log(`out of ${HIT.MaxAssignments} released`);
    }
  });
}

function overrideRejection(assignmentID, message) {
  mturk.approveAssignment({
    AssignmentId: assignmentID,
    RequesterFeedback: message,
    OverrideRejection: true
  }, function(err) {
    if (err) {
      console.log(`Failed to override rejection: ${err.message}`);
    }
  })
}

function sendBonusExternal(assignmentID, workerID, amount, reason, tokenOpt) {
  const token = tokenOpt || aux.makeid(10)
  let parameters = {
    AssignmentId: assignmentID,
    WorkerId: workerID,
    UniqueRequestToken: token,
    BonusAmount: '' + amount,
    Reason: reason
  };
  mturk.sendBonus(parameters, function(err, data) {
    if (err) {
      console.log(`Failed to send bonus: ${err.message}`);
      console.log(`To try again, use this request token: ${token}`);
    } else {
      console.log(`Bonus $${amount} sent successfully.`);
    }
  });
}

function listBonusPayments(HITId, assignmentID, token) {
  // console.log(`listBonusPayments(${HITId}, ${assignmentID}, ${token}`);
  assert(HITId || assignmentID, "either of HITId or assignmentID must be passed!")
  const params = {
    HITId: HITId,
    AssignmentId: assignmentID,
    NextToken: token,
    MaxResults: 100
  }
  mturk.listBonusPayments(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log(`${data.NumResults} bonus payments found:`);
      for (let i = 0; i < data.NumResults; i++) {
        const bonusPayment = data.BonusPayments[i];
        console.log(`${i+1}. ${bonusPayment.BonusAmount} to worker ` +
        `${bonusPayment.WorkerId} paid on ${bonusPayment.GrantTime}`);
      }
      if (data.NextToken) {
        console.log(`To retrieve more results, use token ${data.NextToken}`)
      }
    }
  });
}

module.exports = {
  // internal
  createHIT,
  sendBonus,
  approveAssignment,
  setupPeriodicChecksForHIT,
  // external
  listAssignmentsForHIT,
  printBalance,
  listHITs,
  checkHITStatus,
  overrideRejection,
  sendBonusExternal,
  listBonusPayments
}

// checkAssignmentsForHIT('3CMIQF80HSFSW60FZC19IWGQQAG6Q8');



