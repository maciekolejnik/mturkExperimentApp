import {useState, useEffect, useContext} from "react";
import Game from "./Game";
import Questionnaire from "./Questionnaire";
import Demographics from "./Demographics";
import '../css/App.css';
import {getUserId, offload} from "../services";
import { EnvContext } from '../env-context';

import "react-loader-spinner/dist/loader/css/react-spinner-loader.css";
import Loader from "react-loader-spinner";

/**
 * @typedef {{
 *            investor:number,
 *            investee:number
 *          }}
 */
let Endowments;

/** This is the main component for the MTurk Trust Game experiment
 *  The experiment consists of multiple stages (demographic
 *  questions -> questionnaire -> game play) which are all
 *  managed from the App component with *stage* state variable.
 */
function App() {

  const env = useContext(EnvContext);

  /** where we are in the experiment:
   * 0 - demographic
   * 1 - questionnaire
   * 2 - submitted, wait for config
   * 3 - game
   * 4 - game is finished & succesfully submitted
   * 5 - something went wrong, can't proceed */
  /** @type {number} */
  const [stage, setStage] = useState(env.stage);

  // game parameters that must be queried from the server
  /** @type {string} */
  const [userId, setUserId] = useState(null);
  /** @type {number} */
  const [horizon, setHorizon] = useState(null);
  const [role, setRole] = useState(null);
  /** @type {Endowments} */
  const [endowments, setEndowments] = useState(null);
  /** @type {number} */
  const [k, setK] = useState(null);
  /** @type {number} */
  const [unitToDollarRatio, setUnitToDollarRatio] = useState(null);

  /** @type {Error} */
  const [error, setError] = useState(null);

  // MARK: Effects
  /** Try to prevent the user from exiting the page before submitting */
  useEffect(() => {
    function alertUser(e) {
      if (stage < 4 && !error) {
        e.preventDefault();
        e.returnValue = true;
      }
    }
    function offloadUser() {
      offload(userId)
        .then(() => true);
    }
    window.addEventListener("beforeunload", alertUser);
    window.addEventListener("onpagehide", offloadUser);

    return () => {
      window.removeEventListener("beforeunload", alertUser);
      window.removeEventListener("onpagehide", offloadUser)
    }
  }, [userId, stage, error]);

  // game init effect. comment out unless testing!
  useEffect(() => {
    if (env.stage === 2) {
      const zeroTo4 = [0,1,2,3,4];
      const zeroTo3 = [0,1,2,3];
      const zeroTo2 = [0,1,2];
      const oneTo5 = [1,2,3,4,5];
      const participantData = {
        demographic: {
          age: uniformDraw(zeroTo4),
          gender: uniformDraw(zeroTo3),
          education: uniformDraw(zeroTo4),
          robot: uniformDraw(zeroTo4)
        },
        questionnaire: {
          moneyRequest: uniformDraw([...Array(21).keys()]),
          lottery1: uniformDraw(zeroTo2),
          lottery2: uniformDraw(zeroTo2),
          lottery3: uniformDraw(zeroTo2),
          trust: uniformDraw(oneTo5),
          altruism: uniformDraw(oneTo5)
        }
      }
      gameInit(participantData);
    }
  }, [env.stage]);

  useEffect(() => {
    if (env.stage === 1) {
      const zeroTo4 = [0,1,2,3,4];
      const zeroTo3 = [0,1,2,3];
      setDemographicData({
        age: uniformDraw(zeroTo4),
        gender: uniformDraw(zeroTo3),
        education: uniformDraw(zeroTo4),
        robot: uniformDraw(zeroTo4)
      });
    }
  }, [env.stage]);


  // MARK: Demographics stuff (stage 0)
  const [demographicData, setDemographicData] = useState(null);

  const demographicsElement =
    <Demographics
      handleSubmit={(answers) => handleDemographicsSubmit(answers)}
    />

  // pre: answers are valid
  function handleDemographicsSubmit(answers) {
    setDemographicData(answers);
    setStage(stage+1);
  }

  // MARK: Questionnaire stuff (stage 1)
  function handleQuestionnaireSubmit(answers, timeSeries) {
    setStage(stage => stage+1);
    // combine demographic data from before with just
    // collected questionnaire answers
    const participantData = {
      demographic: demographicData,
      questionnaire: answers,
      timeSeries: timeSeries
    };
    gameInit(participantData);
  }

  const questionnaireElement =
    <Questionnaire
      handleSubmit={handleQuestionnaireSubmit}
    />

  // MARK: Game stuff (stage 2 & 3)
  function gameInit(participantAnswers) {
    getUserId(participantAnswers)
      .then(data => {
        const userId = data.userId;
        setUserId(userId);
        const setup = data.setup;
        setRole(setup.role);
        setHorizon(setup.horizon);
        setK(setup.k);
        setEndowments(setup.endowments);
        setUnitToDollarRatio(setup.unitToDollarRatio);
        setStage(stage => stage + 1);
      })
      .catch(err => {
        setError(new Error("Could not get user id and game setup; " +
          "request failed:\n " + err.message));
      });
  }

  function gameComplete() {
    setStage(4);
  }

  function reportError() {
    setStage(5);
  }

  const gameElement = <Game
    endowments={endowments}
    k={k}
    unitToDollarRatio={unitToDollarRatio}
    userId={userId}
    role={role}
    horizon={horizon}
    reportGameComplete={gameComplete}
    gender={demographicData?.gender}
    reportError={reportError}
    // error={error}
    // setError={setError}
  />

  const spinner = <div className="loading">
    <p>Loading game configuration...</p>
    <Loader type="TailSpin" color="#00BFFF" height={40} width={40} />
  </div>

  // MARK: app top level
  const elementByStage =
    [demographicsElement, questionnaireElement, spinner, gameElement, gameElement, gameElement];

  return error !== null ? errorReport(error) : elementByStage[stage];
}

export function errorReport(error) {
  if (error) {
    return <div className="error">
      <p>
        An error occurred. <br/>
        Details: {error.message}.
      </p>
    </div>;
  }
  return null;
}

export default App;

function uniformDraw(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
