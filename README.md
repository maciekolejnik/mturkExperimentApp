# Overview
This is a simple webapp implementing a trust game [1] played between a user
and a bot. It is implemented using React for frontend, Node.js backend
(using Express), Firestore database and Redis for queue management.

The bot is implemented in a probabilistic programming language WebPPL that
compiles into Javascript. 
Since out experiment was run using Amazon Mechanical Turk, plenty of code is 
present that automates management of tasks on that platform. Majority of that
code should be fully reusable.

The code expects the following environment variables to be set:
- GOOGLE_APPLICATION_CREDENTIALS (required) - string - path of a json file with
authentication credentials for GCloud (via service account)
- TLS (optional) - true/false - should we connect to redis using TLS?
- DEBUG (optional) - number - specifies logging level in webppl-cognitive-agents 
  (if set), also enables various debugging aids (in practice, more stuff gets 
  logged) if set (to any value)
- AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY - specify credentials for AWS -
  this is needed for MTurk. Locally, a credentials file in ~/.aws can
  be given instead. If MTurk is not used (see below) this is not needed.
  Also, locally one may use AWS_PROFILE to select between profiles defined
  in 'credentials' file located in ~/.aws. 
- MTURK (optional) - true/false - set to true to run with MTURK
- HITID (optional) - when MTURK is true, when server is started, it by 
  default creates a new HIT. however, HITId can be set to prevent that 
  (when set, no new HITs are created)
- MTURK_PROD (optional) - true/false - !!CAREFUL!!
  if this is set to true, then MTurk will run in production mode.
  Be super careful with this one, as this might publish a HIT and lead
  to monetary loss if that was not intended!
- NAME (optional) - name of the session; if present, and MTURK is not 
  false, it will be used as collection ID in the database 
  (otherwise, it gets saved in the 'sessions' collection)
- LOOKAHEAD (optional) (defaults to 3) - lookahead for the bot
- HORIZON (optional) (defaults to 7) - number of rounds to play

# Deployment
Note: Instructions below assume that the app is hosted on Heroku.

Deployment happens by *git pushing* to heroku. For that to work, a 
remote has to be added using the following command:
```
heroku git:remote -a <app-name>
```
The above command is part of Heroku CLI, which can be installed with
```
brew tap heroku/brew && brew install heroku
```
You then create a deploy branch:
```
git checkout -B deploy
```
and add your production database credentials file (if needed).
```
git add <db-cred-file> && git commit -m <msg>
```
You can now deploy the app by pushing to heroku:
```
git push heroku deploy:main
```

# Implementation
We mention a few implementation details below.

## Server
The server exposes an API with basic operations for playing the 
Trust Game. In particular, the following requests are supported:
- POST /new - creates a new user (player). Player's demographic
  data and questionnaire answers must be passed in the body of 
  the request.
- DELETE /offload?userId=<id> - offloads, i.e., removes from 
  local storage, a user identified by id
- POST /return - records a return, where the amount and userId are 
  passed in the body; returns { finished: <true/false> }, 
  specifying whether the game is over 
- POST /invest - as above but for an investment; additionally 
  returns the amount returned by the bot
- GET /query?userId=<id> - queries investment from the bot; 
  returns { investment: <amount> }
- POST /submit?userId=<id> - submits the game; this is essentially
  confirmation that game play should be saved in the database;
  optional feedback may be passed in the body of the request
  
Internally, we maintain an object that maintains game setup and 
current game state for each user. It's a dictionary where userId's
are used as keys and to each userId a following object is 
associated:
{
  setup: {
    k, 
    unitToDollarRatio, 
    horizon,
    role,
    endowments: {
      investor,
      investee
    }
  },
  botParams: {
    goalCoeffs,
    metaParams: {
      alpha, discountFactor, lookAhead
    }
  },
  botState: {
    belief,
    mentalEstimations,
    metaParamsEstimations: {
      alpha, lookAhead, discountFactor
    }
  },
  history (array of { investment, returned } objects)
}

### Workers
Due to low performance of WebPPL and high complexity of the decision-making
mechanism, computation of bot's actions is carried out in separate worker
processes. Each such computation is wrapped as a job and placed in a queue.
Subsequently, an idle worker will collect that job and upon completion, the
result will be available to the main process. 


# References
[1] Joyce Berg, John Dickhaut, Kevin McCabe, "Trust, Reciprocity, and Social History,
Games and Economic Behavior", Volume 10, Issue 1, 1995.