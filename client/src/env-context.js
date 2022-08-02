import React from 'react';

const envs = {
  debug: {
    debug: true,
    stage: 0
  },
  prod: {
    debug: false,
    stage: 0
  }
};

// use debug by default, overwrite it in index.js for prod
const EnvContext = React.createContext(envs.debug);

export { EnvContext, envs };