import {useState, useEffect, useRef, useContext, useMemo} from "react";
import '../css/App.css';
import {EnvContext} from "../env-context";

// ordered questions that we want to display go here
const selectedQuestions = ['moneyRequest', 'lottery1', 'lottery2', 'lottery3', 'trust', 'altruism'];


function Questionnaire(props) {

  const env = useContext(EnvContext);

  const [answers, setAnswers] =
    useState({
      moneyRequest: env.debug ? 15 : '',
      lottery1: 1,
      lottery2: 1,
      lottery3: 1,
      trust: env.debug ? 5 : '',
      altruism: env.debug ? 3 : ''
    });

  const [questionsDisplayed, setQuestionsDisplayed] = useState([]);
  const [bootTime, setBootTime] = useState(null);
  /** stores time series of participant's interaction with the questionnaire
   *  objective is to see how long it takes participants to answer
   *  questions and whether they read the introduction
   *  'events' are stored as following objects
   *  {
   *    event: string [one of 'start', 'moneyRequest', 'lottery1', 'lottery2', 'lottery3', 'trust', 'altriusm']
   *    elapsed: number | time elapsed from boottime in seconds
   *  }
   *  */
  const [timeSeries, setTimeSeries] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [submitEnabled, setSubmitEnabled] = useState(false);
  const [previewMessage, setPreviewMessage] = useState(null);

  const [invalid, setInvalid] = useState([]);
  const errorRef = useRef(null);

  const requirements = useMemo(() => {
    return {
      moneyRequest: {
        validate: (v) => Number.isInteger(v) && v >= 11 && v <= 20,
        req: "Answer must be an integer between 11 and 20.",
        time: env.debug ? 2 : 25
        // time: 3
      },
      lottery1: {
        validate: () => true,
        req: "",
        // setState: setLottery1,
        time: env.debug ? 2 : 15
        // time: 3
      },
      lottery2: {
        validate: () => true,
        req: "",
        time: env.debug ? 2 : 20
        // time: 3
      },
      lottery3: {
        validate: () => true,
        req: "",
        time: env.debug ? 2 : 25
        // time: 3
      },
      trust: {
        validate: (t) => Number.isInteger(t) && t >= 1 && t <= 5,
        req: "Trust value must be between 1 and 5",
        time: env.debug ? 2 : 10,
        // time: 3
      },
      altruism: {
        validate: (v) => Number.isInteger(v) && v >= 1 && v <= 5,
        req: "Answer must be between 1 and 5",
        time: env.debug ? 2 : 10,
        // time: 3
      }
    }
  }, [env])

  useEffect(() => {
    function updateDisplay() {
      if (startTime !== null) {
        const now = new Date().getTime();
        // elapsed time in seconds
        const elapsed = (now - startTime) / 1000;
        const nextReveal = questionsDisplayed.map(name => {
          return requirements[name].time;
        }).reduce((a,b) => a+b,0);
        const diff = nextReveal - elapsed;
        const rounded = Math.round(diff);
        const lastQuestion = selectedQuestions.length === questionsDisplayed.length;
        if (elapsed < nextReveal) {
          setPreviewMessage(lastQuestion ? 'You will be able to submit in '
            + rounded + ' seconds' :
            'Next question will appear in ' + rounded + ' seconds.');
        } else {
          if (lastQuestion) {
            setSubmitEnabled(true);
            setPreviewMessage(null);
          } else {
            setQuestionsDisplayed(questionsDisplayed.concat(selectedQuestions[questionsDisplayed.length]));
          }
        }
      }
    }
    updateDisplay();
    let intervalID;
    if (startTime && !submitEnabled) {
      intervalID = setInterval(updateDisplay, 1000);
    }
    return () => {
      if (intervalID) {
        clearInterval(intervalID);
      }
    }
  }, [startTime, questionsDisplayed, submitEnabled, requirements]);

  useEffect(() => {
    errorRef.current?.scrollIntoView({ behavior: "smooth" });
  },[invalid]);

  useEffect(() => {
    setBootTime(new Date().getTime());
  }, []);

  const questionsElements = {
  moneyRequest:
      <label>
        Imagine a following game: There are two players and each
        requests an integer amount of money between &#36;11 and &#36;20.
        Each player will receive the amount they requested but a player
        will receive an additional amount of &#36;20 if they request exactly
        one dollar less than their opponent. What amount would you select in
        such a game?
        <br/>
        <input
          type="number"
          name="moneyRequest"
          value={answers.moneyRequest}
          onChange={handleInputChange}
          /**required minLength="1" maxLength="3" size="5"*/
        />
      </label>,

    lottery1:
      <label>
        Imagine you're offered two lotteries defined as follows: <br/>
        <ul>
          {/*EU=80*/}<li>A: you receive &#36;100 with probability 0.6 and $50 with probability 0.4</li>
          {/*EU=70*/}<li>B: you receive &#36;100 with probability 0.4 and $50 with probability 0.6</li>
        </ul>
        Drag a slider below to express your preference between the two lotteries.
        <br/>
        A
        <input type="range" name="lottery1" min="0" max="2" value={answers.lottery1} onChange={handleInputChange}/>
        B
        <br/>
      </label>,

    lottery2:
      <label>
        This time, consider the following lotteries: <br/>
        <ul>
          {/*EU=8*/}<li>A: you receive &#36;15 with probability 0.2, &#36;10 with probability 0.2 and &#36;5 with probability 0.6</li>
          {/*EU=9*/}<li>B: you receive &#36;10 with probability 0.8 and &#36;5 with probability 0.2</li>
        </ul>
        Drag a slider below to express your preference between the two lotteries.
        <br/>
        A
        <input type="range" name="lottery2" min="0" max="2" value={answers.lottery2} onChange={handleInputChange}/>
        B
        <br/>
      </label>,

    lottery3:
      <label>
        Finally, consider two lotteries: <br/>
        <ul>
          {/*EU=40*/}<li>A: you receive &#36;100 with probability 0.2, &#36;50 with probability 0.3 and &#36;10 with probability 0.5</li>
          {/*EU=40*/}<li>B: you receive &#36;40 with certainty</li>
        </ul>
        Drag a slider below to express your preference between the two lotteries.
        <br/>
        A
        <input type="range" name="lottery3" min="0" max="2" value={answers.lottery3} onChange={handleInputChange}/>
        B
        <br/>
      </label>,

    trust:
      <label>
        On a scale from 1 to 5, how would you describe your overall trust towards robots? (1 - no trust, 5 - full trust)
        <br/>
        <input
          type="number"
          name="trust"
          value={answers.trust}
          onChange={handleInputChange}
          /**required minLength="1" maxLength="3" size="5"*/
        />
      </label>,

    altruism:
      <label>
        On a scale from 1 to 5, how concerned are you with the way the robot
        perceives you? (1 - not at all, 5 - very concerned)
        <br/>
        <input
          type="number"
          name="altruism"
          value={answers.altruism}
          onChange={handleInputChange}
          /**required minLength="1" maxLength="3" size="5"*/
        />
      </label>
  }

  function /** string */ elapsedSince(/** number */ timeEpoch) {
    const now = new Date().getTime();
    return ((now - timeEpoch) / 1000).toFixed(2);
  }

  function handleInputChange(event) {
    const target = event.target;

    const value = target.value;
    const name = target.name;

    /** update time series */
    const newItem = {
      event: name,
      elapsed: elapsedSince(bootTime)
    }
    const lastItem = timeSeries[timeSeries.length -1];
    if (lastItem.event === name) {
      setTimeSeries(timeSeries.slice(0, -1).concat([newItem]));
    } else {
      setTimeSeries(timeSeries.concat([newItem]));
    }

    let updatedAnswers = {
      ...answers
    }
    updatedAnswers[name] = value && parseInt(value);
    setAnswers(updatedAnswers);
    // const process = requirements[name].process;
    // requirements[name].setState(process(value));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setInvalid([]);
    let s = new Set();

    selectedQuestions.forEach((name, index) => {
      if (!requirements[name].validate(answers[name])) {
        s.add([index, name]);
      }
    });
    if (s.size === 0) {
      const submitEvent = {
        event: 'submit',
        elapsed: elapsedSince(bootTime)
      }
      const finalTimeSeries = timeSeries.concat([submitEvent]);
      props.handleSubmit(answers, finalTimeSeries);
    } else {
      setTimeout(() => {
        setInvalid(Array.from(s));
      }, 100);
    }
  }

  const form =
    <form onSubmit={handleSubmit}>
      <div className='questions'>
      {
        questionsDisplayed.map((question, index) => {
        return (<div key={question}>
          <h3>Question {index+1}</h3>
          {questionsElements[question]}
          <br/>
        </div>);
        })
      }
      </div>
      <p>{previewMessage}</p>
      <button disabled={!submitEnabled} type="submit">Submit</button>
    </form>

  const invalidAnswersElement =
    <div className="error" ref={errorRef}>
      {invalid.map(qn => <p key={qn[1]}>Question {qn[0]+1}: {requirements[qn[1]].req}</p>)}
    </div>

  function startQuestions() {
    setStartTime(new Date().getTime());
    setQuestionsDisplayed(questionsDisplayed.concat([selectedQuestions[0]]));
    setTimeSeries(timeSeries.concat([{
      event: 'start',
      elapsed: elapsedSince(bootTime)
    }]));
  }

  const startButton =
    <button onClick={() => startQuestions()}>
      Get started
    </button>

  return (
    <div>
    <Intro/>
      <br/>
      {startTime !== null ? form : startButton}
      {invalidAnswersElement}
    </div>);
}

function Intro() {
  return (
    <p>
      Thank you for providing this information. <br/>
      We will now ask you a set of questions, some of which are
      designed to get you thinking hard. Please <b>don't rush</b> through
      them - you will be allocated a fairly generous amount of time
      for each question and your remuneration reflects that.
      You won't see the next question before this time elapses, but don't
      worry if you haven't picked an answer by then - you
      can carry on working on any given question even once the next
      question appears. <br/>
      Note that this is not a test - there are no right or
      wrong answers and it does not matter how long it takes you to
      answer the questions. However, your choices will be used to adapt the
      behaviour of the bot.
    </p>
  );
}

export default Questionnaire;