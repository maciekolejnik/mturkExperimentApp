import {useState, useContext} from "react";

import {reportComprehensionSubmit} from "../services";
import {EnvContext} from "../env-context";

/** expects
 * - props.userId
 * - props.isInvestor
 * - props.outcome (null, true, false)
 * - props.reportPass
 * - props.reportFail
*/
function ComprehensionCheck(props) {
  const env = useContext(EnvContext);

  const userId = props.userId;
  const isInvestor = props.isInvestor;
  const outcome = props.outcome;
  const reportPass = props.reportPass;
  const reportFail = props.reportFail;
  const reportError = props.reportError;

  const [q1, setQ1] = useState(env.debug ? 6 : -1);
  const [q2, setQ2] = useState(env.debug ? 8 : -1);
  const [q3, setQ3] = useState(env.debug ? 4 : -1);

  const [attempts, setAttempts] = useState(0);
  const [failBonus, setFailBonus] = useState(null);
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // useEffect(() => {
  //   console.log('comprehensionCheck mounting');
  //
  //   return () => { console.log('comprehensionCheck unmounting') };
  // }, []);

  function handleComprehensionCheckSubmit(event) {
    event.preventDefault();
    setAwaitingResponse(true);
    reportComprehensionSubmit(userId, [q1,q2,q3], attempts+1)
      .then(status => {
        setAwaitingResponse(false);
        if (status.correct) {
          // PASS
          reportPass();
          // setPassedComprehension(true);
        } else {
          if (status.last) {
            // FAIL
            setFailBonus(status.bonus);
            reportFail();
            // setPassedComprehension(false);
          } else {
            // LAST CHANCE
            setQ1(env.debug ? 6 : -1);
            setQ2(env.debug ? 8 : -1);
            setQ3(env.debug ? 4 : -1);
          }
        }
      })
      .catch(error => {
        reportError(error);
      })
      .finally(() => {
        setAttempts(attempts + 1);
      });
  }

  function InvestorComprehensionQuestions() {
    return (
      <div>
        <label className="question">
          1. Suppose you invested 3 units. How many units will the bot receive?
          <br/>
          <select value={q1} name="q1" onChange={event => setQ1(parseInt(event.target.value))}>
            <option value="-1">--</option>
            <option value="0">0</option>
            <option value="3">3</option>
            <option value="6">6</option>
            <option value="9">9</option>
          </select>
        </label>
        <br/>
        <label className="question">
          2. Suppose the bot received 8 units. What's the maximum number of units they can share?
          <br/>
          <select value={q2} name="q2" onChange={event => setQ2(parseInt(event.target.value))}>
            <option value="-1">--</option>
            <option value="0">0</option>
            <option value="4">4</option>
            <option value="6">6</option>
            <option value="8">8</option>
          </select>
        </label>
        <br/>
        <label className="question">
          3. Suppose you earned 3 units in the first round.
          What amount will you have available for investment in the second round?
          <br/>
          <select value={q3} name="q3" onChange={event => setQ3(parseInt(event.target.value))}>
            <option value="-1">--</option>
            <option value="0">0</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="7">7</option>
          </select>
        </label>
      </div>
    );
  }

  function InvesteeComprehensionQuestions() {
    return (
      <div>
        <label>
          1. Suppose the bot invested 3 units. How many units will you receive?
          <br/>
          <select value={q1} name="q1" onChange={event => setQ1(parseInt(event.target.value))}>
            <option value="">--</option>
            <option value="0">0</option>
            <option value="3">3</option>
            <option value="6">6</option>
            <option value="9">9</option>
          </select>
        </label>
        <br/>
        <label className="question">
          2. Suppose you've received 8 units.
          What's the maximum number of units you can return to the bot?
          <br/>
          <select value={q2} name="q2" onChange={event => setQ2(parseInt(event.target.value))}>
            <option value="">--</option>
            <option value="0">0</option>
            <option value="4">4</option>
            <option value="6">6</option>
            <option value="8">8</option>
          </select>
        </label>
        <br/>
        <label className="question">
          3. Suppose the bot earned 3 units in the first round.
          How many units will they have available to invest in the second round?
          <br/>
          <select value={q3} name="q3" onChange={event => setQ3(parseInt(event.target.value))}>
            <option value="">--</option>
            <option value="0">0</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="7">7</option>
          </select>
        </label>
      </div>
    );
  }

  function Pass() {
    return (
      <div className="success">
        Congratulations, you've passed the attention check and you can
        continue with the game.
      </div>
    );
  }

  // pass props.bonus
  function Fail(props) {
    const bonus = props.bonus;
    const bonusMsg = bonus > 0 &&
      <p>
        We will additionally pay you ${bonus} as bonus for the
        effort you put in attempting to answer comprehension questions correctly.
      </p>

    return (
      <div className="error">
        Unfortunately, you have failed the comprehension test and you can't
        proceed to the game. However, to compensate you for the time you
        spent on the task, we will approve your assignment if you enter
        this code:
        <div className="code-highlight">
          {userId}
        </div>
        on the task page and submit the task.
        {bonusMsg}
      </div>
    );
  }

  function TryAgain() {
    return (
      <div className="error">
        Some of your answers were not correct. Please try again.
        This is your last chance.
      </div>
    );
  }

  function Questions() {
    const questions =
      isInvestor ? <InvestorComprehensionQuestions/> :
        <InvesteeComprehensionQuestions/>
    return (
      <form onSubmit={handleComprehensionCheckSubmit}>
        <h2>Comprehension Questions</h2>
        <div className='questions'>
          {questions}
          <br/>
          <input disabled={awaitingResponse} type="submit" value="Submit" />
        </div>
      </form>
    );
  }

  if (outcome === true) return <Pass/>;
  if (outcome === false) return <Fail bonus={failBonus}/>
  return (
    <div>
      <Questions/>
      {attempts > 0 && <TryAgain/>}
    </div>
  )
}

export default ComprehensionCheck;