/** Game component
 * This is the most important component of our webapp, representing
 * the Trust Game. Parameters of the game are passed in props:
 * - 'role' specifies whether participant plays as investor/investee
 * - 'investorEndowment' - specifies endowment of the investor
 * - 'k' - specifies the multiplication factor
 * - 'userId' - unique identifier of participant playing this game
 *
 * The game proceeds in several stages:
 * 0. Before the game is started, rules and setup are explained.
 * Participant must complete comprehension check to proceed.
 * There are two outcomes:
 *   1. Participant fails comprehension check. Game is finished.
 *   2. Participant passes comprehension check, payment info is displayed
 *   and game can be started
 * 3. Play is underway
 * 4. Play is finished, summary is printed and participant can proceed
 * to post-game questionnaire
 *  Questionnaire is displayed and feedback box, participant must fill it
 * in and submit
 * 5. Experiment is complete after submission
 * */

import {useState, useRef} from "react";

import ComprehensionCheck from './ComprehensionCheck'
import GameDescription from './GameDescription'
import PaymentInfo from "./PaymentInfo";
import Play from './Play/Play';
import WrapUp from './WrapUp';
import {notifyPlayStart} from "../services";

function Game(props) {
  /** PROPS */
  const endowments = props.endowments;
  const k = props.k;
  const userId = props.userId;
  const role = props.role;
  const isInvestor = role === 'investor';
  const gender = props.gender; // female=1, male=2
  const horizon = props.horizon;
  const unitToDollarRatio = props.unitToDollarRatio;

  const reportGameComplete = props.reportGameComplete;
  const reportErrorToParent = props.reportError;

  /** STATE OF THE GAME */

  /** is the game finished (server decides) */
  // const [playFinished, setPlayFinished] = useState(false);
  const [stage, setStage] = useState(0);
  const playFinished = stage > 3;
  const passedComprehension = stage === 0 ? null : stage > 1;
  /** has participant passed comprehension check */
  // const [passedComprehension, setPassedComprehension] = useState(null);
  /** which round we're in */
  const [round, setRound] = useState(null);
  /** what is current investment, should be defined only
   *  between investment and subsequent return */
  const [history, setHistory] = useState([]);

  const [awaiting, setAwaiting] = useState(false);
  const [error, setError] = useState(null);

  const currentRoundRef = useRef(null);

  /** COMPONENTS */
  const reportComprehensionPass = () => setStage(2);
  const reportComprehensionFail = () => {
    setStage(1);
    reportGameComplete();
  }

  const reportPlayFinished = () => setStage(4);
  const reportRoundComplete = (invested, returned) => {
    setHistory(history.concat([{invested, returned}]));
    setRound(r => r+1)
  }

  const nextRound = () => setRound(r => r+1);

  function StartPlayButton() {
    function startPlay() {
      notifyPlayStart(userId)
        .then(() => {
          setRound(1);
        })
        .catch(err => {
          reportError(err);
        })
        .finally(() => {
          setAwaiting(false);
        });
      setAwaiting(true);
    }

    const buttonDisabled = !passedComprehension || awaiting;
    return !round && (
      <button disabled={buttonDisabled} onClick={startPlay}>
        Start Game!
      </button>
    );
  }

  /** passed to components when something goes wrong */
  function reportError(error) {
    setError(error);
    reportErrorToParent();
  }

  function ErrorReport(props) {
    const error = props.error;

    return error && (
      <div className="error">
        {error.message}
      </div>
    );
  }

  return (
    <div className="game">
      <h1>Trust Game</h1>
      <GameDescription
        horizon={horizon}
        isInvestor={isInvestor}
        gender={gender}
        endowments={endowments}
        k={k}
      />
      <ComprehensionCheck
        userId={userId}
        isInvestor={isInvestor}
        outcome={passedComprehension}
        reportPass={reportComprehensionPass}
        reportFail={reportComprehensionFail}
        reportError={reportError}
      />
      <PaymentInfo
        display={passedComprehension}
      />
      <StartPlayButton/>
      <Play
        userId={userId}
        history={history}
        horizon={horizon}
        endowments={endowments}
        role={role}
        unitToDollarRatio={unitToDollarRatio}
        k={k}
        round={round}
        finished={playFinished}
        currentRoundRef={currentRoundRef}
        reportPlayFinished={reportPlayFinished}
        reportRoundComplete={reportRoundComplete}
        reportNextRoundStarted={nextRound}
        reportError={reportError}
      />
      {playFinished &&
      <WrapUp
        userId={userId}
        notify={reportGameComplete}
        finished={playFinished}
        reportError={reportError}
      />}
      <ErrorReport
        error={error}
      />
    </div>
  );
}

export default Game;