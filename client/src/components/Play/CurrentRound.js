import Loader from "react-loader-spinner";

import {useState, useEffect, useRef} from "react";
import {checkForInvestment, checkReturn, queryInvestment, reportInvestment, reportReturn} from "../../services";
import Investment from "./Investment";
import Return from "./Return";

const assert = require('assert');

function CurrentRound(props) {
  const userId = props.userId;
  const round = props.round;
  const horizon = props.horizon;
  const endowments = props.endowments;
  const role = props.role;
  const k = props.k;

  const reportRoundComplete = props.reportRoundComplete;
  const reportPlayFinished = props.reportPlayFinished;
  const reportError = props.reportError;

  const isInvestor = role === 'investor';

  const roundRef = useRef(null);

  /** when investee
   * 0 - start button
   * 1 - button clicked
   * 2 - queried investment from bot
   * 3 - git invest, query return
   * 4 - got return, sending back
   *
   * when investor
   * 0: round not started (start round btn displayed)
   * 1: choose investment (selectoir)
   * 3: got invest, query bot's return
   * 4: got bot return
   */
  const [stage, setStage] = useState(1);
  const [currentInvestment, setCurrentInvestment] = useState(null);
  const [lastReturn, setLastReturn] = useState(null);
  const [startThinking, setStartThinking] = useState(null);


  /** EFFECTS */
  // logging
  // useEffect(() => {
  //   console.log('CurrentRound mounting');
  //   return () => { console.log('CurrentRound unmounting') };
  // }, []);

  useEffect(() => {
      roundRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  /** When participant plays as investee, we fire off a request for bot's
   * investment as soon as a new round is started
   */
  useEffect(() => {
    // assert(round === null || stage <= 0, "when round changes, stage must be <=0, found: " + stage + ", " + round);
    if (!isInvestor && round && stage === 1) {
      setStage(s => s+1);
      queryInvestment(userId)
        .then(result => {
          const jobId = result.id
          const intervalId = setInterval(function() {
            checkForInvestment(userId, jobId)
              .then(job => {
                if (job.state === 'completed' && job.ready) {
                  clearInterval(intervalId);
                  const result = job.result;
                  const amount = result.amount;
                  assert(typeof amount == "number",
                    `Job ${jobId} completed and ready but result.amount 
                    not as expected: ${amount}`);
                  setCurrentInvestment(amount);
                  setStage(s => s+1);
                  setStartThinking(new Date().getTime());
                } else if (job.state === 'failed') {
                  clearInterval(intervalId);
                  console.log(`Job ${jobId}: failed: ${job.reason}`);
                  reportError(new Error("Failed to compute bot's investment: "
                    + job.reason));
                  setStage(s => s+1);
                } else if (job.ready) {
                  // job is ready, but not completed so something went
                  // wrong (eg stalled)
                  clearInterval(intervalId);
                  console.log(`Job ${jobId} ready but not completed: ${job.state}`);
                  reportError(new Error(job.error));
                  setStage(s => s+1);
                }
              })
              .catch(err => {
                clearInterval(intervalId);
                console.log("could not retrieve bot's investment: request failed ", err, err.message);
                reportError(err);
                setStage(s => s+1);
              })
          }, 1000);
        })
        .catch(error => {
          reportError(error);
          setStage(s => s+1);
        });
    }
  },[round, stage, userId, isInvestor, reportError]);

  useEffect(() => {
    if (stage === 1 && isInvestor) {
      setStartThinking(new Date().getTime());
    }
  }, [stage, isInvestor]);


  /** handlers */
  function selectedTransfer(amount) {
    function selectedReturn(returned, time) {
      reportReturn(userId, returned, time)
        .then(
          result => {
            const isFinished = result.finished;
            // setStage(s => s + 1);
            // setRound(round + 1);
            reportRoundComplete(currentInvestment, returned);
            setStage(0);
            // setHistory(history.concat([{invested: currentInvestment, returned: returned}]));
            setCurrentInvestment(null);
            if (isFinished) reportPlayFinished();
            // setFinished(isFinished);
          }
        )
        .catch(error => {
          reportError(error);
        });
      setLastReturn(returned);
      setStage(s => s + 1);
    }
    function selectedInvestment(amount, time) {
      setCurrentInvestment(amount);
      setStage(s => s+2);
      reportInvestment(userId, amount, time)
        .then(
          result => {
            const jobId = result.id
            const intervalId = setInterval(function() {
              checkReturn(userId, jobId)
                .then(job => {
                  if (job.state === 'completed' && job.ready) {
                    clearInterval(intervalId);
                    const result = job.result;
                    const isFinished = result.finished;
                    assert(typeof isFinished == "boolean",
                      `Job ${jobId} completed and ready but result.finished 
                    not as expected: ${isFinished}`);
                    const returned = result.amount;
                    assert(typeof returned == "number",
                      `Job ${jobId} completed and ready but result.amount 
                    not as expected: ${returned}`);
                    setCurrentInvestment(null);
                    reportRoundComplete(amount, returned);
                    setStage(0)
                    if (isFinished) reportPlayFinished();
                    // setHistory(history.concat([{invested: amount, returned: returned}]));
                  } else if (job.state === 'failed') {
                    clearInterval(intervalId);
                    console.log(`Job ${jobId} failed: ${job.reason}`);
                    reportError(new Error("failed to compute bot's return: " + job.reason));
                    setStage(s => s + 1);
                  } else if (job.ready) {
                    // job is ready, but not completed so something went
                    // wrong (eg stalled)
                    clearInterval(intervalId);
                    console.log(`Job ${jobId} ready but not completed: ${job.state}`);
                    reportError(new Error(job.error));
                    setStage(s => s + 1);
                  }
                })
                .catch(err => {
                  clearInterval(intervalId);
                  console.log("could not retrieve bot's return: request failed ", err, err.message);
                  reportError(err);
                  setStage(s => s + 1);
                });
            }, 1000);
          }
        )
        .catch(error => {
          reportError(error);
          setStage(s => s + 1);
        });
    }
    const now = new Date().getTime();
    assert(now > startThinking);
    const timeInSec = Math.trunc((now - startThinking) / 1000);
    if (isInvestor) {
      selectedInvestment(amount, timeInSec);
    } else {
      selectedReturn(amount, timeInSec);
    }
  }

  function startRound() {
    setStage(s => s+1);
  }

  const investor = isInvestor ? "You" : "The bot";

  return (
    <div className="round" ref={roundRef}>
      {stage === 0 && round > 1 &&
        <StartRoundButton handleClick={startRound}/>}
      {stage > 0 &&
        <RoundTitle horizon={horizon} round={round}/>}
      {stage > 0 && horizon && round === horizon &&
        <LastRoundWarning/>}
      {isInvestor && stage === 1 &&
        <InvestmentSelector
          endowment={endowments.investor}
          transferHandler={selectedTransfer}/>}
      {stage > 2 && currentInvestment >= 0 &&
        <Investment
          player={investor}
          investment={currentInvestment}/>}
      {((stage === 3 && isInvestor) || (stage >= 1 && stage <= 2 && !isInvestor)) &&
        <BotThinking/>}
      {stage === 3 && !isInvestor &&
      <ReturnSelector
        investment={currentInvestment}
        endowments={endowments}
        k={k}
        transferHandler={selectedTransfer}/> }
      {stage === 4 && !isInvestor &&
        <Return player={"You"} returned={lastReturn}/>}
    </div>
  );
}

/** renders buttons allowing to transfer up to *limit* units */
function renderButtons(limit, transferHandler) {
  const range = Array(limit+1).fill(null).map((x,i)=>i)
  return range.map(i => {
    return <TransferButton key={i} amount={i} onClick={() => transferHandler(i)}/>
  })
}

function InvestmentSelector({endowment, transferHandler}) {

  return (
    <div>
      <p>Please choose your investment amount:</p>
      <div className="buttons">
        {renderButtons(endowment, transferHandler)}
      </div>
    </div>
  );
}

function ReturnSelector({investment, endowments, transferHandler, k}) {
  assert(investment !== null, "current investment is null");
  const received = endowments.investee + k * investment;
  return (
    <div>
      <p>Please select how many units you want to return:</p>
      <div className="buttons">
        {renderButtons(received, transferHandler)}
      </div>
    </div>
  );
}

function RoundTitle(props) {
  const horizon = props.horizon;
  const outOf = horizon && ` (out of ${horizon})`;
  return (
    <h2>
      Round {props.round}{outOf}
    </h2>
  )
}

function TransferButton(props) {
  return (
    <button className="transfer" onClick={props.onClick}>
      {props.amount}
    </button>
  )
}

function StartRoundButton(props) {
  const handleClick = props.handleClick;

  return (
    <button onClick={handleClick}>
      Next round
    </button>
  );
}

function BotThinking() {
  return (
    <div>
      <p>The bot is thinking.</p>
      <Loader type="TailSpin" color="#00BFFF" height={80} width={80} />
    </div>
  );
}

function LastRoundWarning() {
  return (
    <p className="important">
      This is the last round.
    </p>
  );
}

export default CurrentRound;