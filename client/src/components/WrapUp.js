import {useContext, useEffect, useRef, useState} from "react";
import {notifyProceededToPostQ, submit} from "../services";
import {EnvContext} from "../env-context";
import Loader from "react-loader-spinner";

function WrapUp(props) {

  const env = useContext(EnvContext);

  const userId = props.userId;
  const notify = props.notify;

  const reportError = props.reportError;

  const [displayAll, setDisplayAll] = useState(false);
  const [awaitingSubmit, setAwaitingSubmit] = useState(false);

  const submitRef = useRef(null);
  const proceedRef = useRef(null);

  /**  EFFECTS */
  // useEffect(() => {
  //   console.log('WrapUp mounting');
  //   return () => { console.log('WrapUp unmounting') };
  // }, []);

  useEffect(() => {
    if (displayAll || awaitingSubmit) {
      submitRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      proceedRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayAll, awaitingSubmit]);

  /** FEEDBACK */
  const [feedback, setFeedback] = useState('');

  const [answers, setAnswers] = useState({
    human: env.debug ? 2 : -1,
    trustSpecific: env.debug ? 1 : -1,
    trustGeneral: env.debug ? 1 : -1
  });

  const [missingAnswer, setMissingAnswer] = useState(false);

  const [awaitingServerResponse, setAwaitingServerResponse] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitDisabled, setSubmitDisabled] = useState(false);

  /** HANDLERS */
  function handleFeedbackChange(event) {
    setFeedback(event.target.value);
  }

  function updateAnswer(question) {
    function update(event) {
      let updated = {
        ...answers
      };
      updated[question] = parseInt(event.target.value);
      setAnswers(updated);
    }
    return update;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (answers.human >= 0 && answers.trustSpecific >= 0 && answers.trustGeneral >= 0) {
      setMissingAnswer(false);
      setSubmitDisabled(true);
      setAwaitingSubmit(true)
      submit(userId, answers, feedback)
        .then(() => {
          notify();
          setSubmitSuccess(true);
          submitRef.current?.scrollIntoView({behavior: "smooth"});
        })
        .catch(error => {
          reportError(error);
          setSubmitDisabled(false);
        })
        .finally(() => {
          setAwaitingSubmit(false);
        });
    } else {
      setMissingAnswer(true);
    }
  }

  function handleProceed() {
    setAwaitingServerResponse(true);
    notifyProceededToPostQ(userId)
      .then(() => {
        setDisplayAll(true);
      })
      .catch(err => {
        reportError(err);
      })
      .finally(() => {
        setAwaitingServerResponse(false);
      });
  }

  return (
    <div>
      <p>
        You're almost done. Before submitting, please answer
        a few questions about your game experience. You'll also
        get a chance to provide any other feedback (e.g., did you
        enjoy the game? was the description clear?).
      </p>
      <button disabled={awaitingServerResponse} onClick={handleProceed} ref={proceedRef}>
        Proceed
      </button>
      {displayAll &&
        <div>
          <PostQuestionnaire
            answers={answers}
            updateAnswer={updateAnswer}
            missingAnswer={missingAnswer}
          />
          <form onSubmit={handleSubmit}>
        <FeedbackBox
          feedback={feedback}
          handleChange={handleFeedbackChange}
        />
        <br/>
        <p>
        By clicking 'Submit' below you're agreeing for all the data you provided
        to be securely stored in our database. Upon submitting, you will
        receive a unique code which you will have to enter on the MTurk task page
        (if applicable).
        </p>
        <input disabled={submitDisabled} type="submit" value="Submit" />
        </form>
          <div ref={submitRef}>
            {awaitingSubmit && <Loader type="TailSpin" color="#00BFFF" height={50} width={50}/>}
            {submitSuccess && <SubmitMessage userId={userId}/>}
          </div>
        </div>
      }
    </div>
  );
}

function SubmitMessage({userId}) {
  return (
    <div className="success">
      Thank you for participating. The data has been successfully saved.
      Your unique identification code is:
      <div className="code-highlight">
        {userId}
      </div>
      If you're an MTurk worker, please copy it and include it in your
      submission so that your assignment is accepted and you receive the
      bonus. You may now leave this page.
    </div>
  );
}

function PostQuestionnaire(props) {
  const answers = props.answers;
  const updateAnswer = props.updateAnswer;
  const missingAnswer = props.missingAnswer;
  // const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(null);
  // const [human, setHuman] = useState(-1);
  // const [human, setHuman] = useState(1);
  function RobotHuman() {
    return (
      <div key="human">
        <label htmlFor="human">1. To what extent do you agree with the following
          statement:
        </label>
        <br/>
        <em>Playing with the bot felt like playing with another human</em>
        <br/>
        <select name="human" id="human" value={answers.human} onChange={updateAnswer('human')}>
          <option value="-1">--</option>
          <option value="1">Completely disagree</option>
          <option value="2">Partially disagree</option>
          <option value="3">Neither agree nor disagree</option>
          <option value="4">Partially agree</option>
          <option value="5">Completely agree</option>
        </select>
      </div>
    );
  }

  // const [trustChange, setTrustChange] = useState(-1);
  // const [trustChange, setTrustChange] = useState(1);
  function TrustChangeSpecific() {
    return (
      <div key="trustChange">
        <label htmlFor="trustChange">2. Has your trust towards this
          particular bot changed after playing the game?
        </label>
        <br/>
        <select name="trustChange" id="trustChange" value={answers.trustSpecific} onChange={updateAnswer('trustSpecific')}>
          <option value="-1">--</option>
          <option value="0">Yes, it decreased</option>
          <option value="1">No change</option>
          <option value="2">Yes, it increased</option>
        </select>
      </div>
    );
  }

  // const [trustChangeGeneral, setTrustChangeGeneral] = useState(-1);
  // const [trustChangeGeneral, setTrustChangeGeneral] = useState(1);
  function TrustChangeGeneral() {
    return (
      <div key="trustChangeGeneral">
        <label htmlFor="trustChangeGeneral">
          3. Has your general perception of robots changed?
        </label>
        <br/>
        <select name="trustChangeGeneral" id="trustChangeGeneral"
                value={answers.trustGeneral} onChange={updateAnswer('trustGeneral')}>
          <option value="-1">--</option>
          <option value="0">I'm less likely to trust a robot in the future</option>
          <option value="1">No change</option>
          <option value="2">I'm more likely to trust a robot in the future</option>
        </select>
      </div>
    );
  }
  return (
    <div>
      <h3>Questions</h3>
      <RobotHuman/>
      <TrustChangeSpecific/>
      <TrustChangeGeneral/>
      {missingAnswer && <IncompleteAnswer/>}
    </div>
  );
}

function IncompleteAnswer() {
  return (
    <div className="error">
      Please answer all the questions!
    </div>
  );
}

function FeedbackBox(props) {
  const handleChange = props.handleChange;
  const feedback = props.feedback;

  return (
    <div>
      <h3>Any feedback?</h3>
      <textarea value={feedback} onChange={handleChange} rows="5" cols="80"/>
    </div>
  );
}

export default WrapUp;