import PastRounds from "./PastRounds";
import PlaySummary from "./PlaySummary";
import CurrentRound from "./CurrentRound";

function Play(props) {
  const userId = props.userId;
  const history = props.history;
  const horizon = props.horizon;
  const endowments = props.endowments;
  const role = props.role;
  const unitToDollarRatio = props.unitToDollarRatio;
  const k = props.k;
  const round = props.round;
  const finished = props.finished;

  const currentRoundRef = props.currentRoundRef;

  const reportError = props.reportError;
  const reportRoundComplete = props.reportRoundComplete;
  const reportPlayFinished = props.reportPlayFinished;
  const reportNextRoundStarted = props.reportNextRoundStarted;

  const isInvestor = role === 'investor';

  return (round &&
    <div>
      <PastRounds
        history={history}
        endowments={endowments}
        isInvestor={isInvestor}
        horizon={horizon}
        k={k}
      />
      {finished ?
        <PlaySummary
          endowments={endowments}
          history={history}
          unitToDollarRatio={unitToDollarRatio}
          role={role}
          k={k}
        />
        :
        <CurrentRound
          userId={userId}
          round={round}
          horizon={horizon}
          endowments={endowments}
          role={role}
          k={k}
          currentRoundRef={currentRoundRef}
          reportRoundComplete={reportRoundComplete}
          reportPlayFinished={reportPlayFinished}
          reportNextRoundStarted={reportNextRoundStarted}
          reportError={reportError}
        />
      }
    </div>
  );
}

export default Play;