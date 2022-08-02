export function reportInvestment(userId, amount, time) {
  const userIdEncoded = encodeURIComponent(userId);
  const amountEncoded = encodeURIComponent(amount);
  const timeEncoded = encodeURIComponent(time);
  return fetch(`/invest/?userId=${userIdEncoded}&amount=${amountEncoded}&time=${timeEncoded}`, {
    method: 'POST'
  })
    .then(res => {
      if (res.ok) return res.json();
      return res.text().then(text => {
        throw new Error(text);
      })
    })
}

// queries if the return amount is available
export function checkReturn(userId, jobId) {
  const jobIdEncoded = encodeURIComponent(jobId);
  const userIdEncoded = encodeURIComponent(userId);
  return fetch(`/invest/${jobIdEncoded}?userId=${userIdEncoded}`)
    .then(res => {
      if (res.ok) return res.json();
      return res.text().then(text => {
        throw new Error(text);
      })
    })
}

export function notifyPlayStart(userId) {
  const userIdEncoded = encodeURIComponent(userId);
  return fetch(`/play?userId=${userIdEncoded}`, {
    method: 'POST'
  })
    .then(res => {
      if (res.ok) return true;
      return res.text().then(text => {
        throw new Error(text);
      })
    })
}

export function notifyProceededToPostQ(userId) {
  const userIdEncoded = encodeURIComponent(userId);
  return fetch(`/finish?userId=${userIdEncoded}`, {
    method: 'POST'
  })
    .then(res => {
      if (res.ok) return true;
      return res.text().then(text => {
        throw new Error(text);
      })
    })
}

export function reportComprehensionSubmit(userId, answers, attempts) {
  const userIdEncoded = encodeURIComponent(userId);
  return fetch(`/comprehension?userId=${userIdEncoded}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      answers, attempts
    })
  })
    .then(res => {
      if (res.ok) return res.json();
      return res.text().then(text => {
        throw new Error(text);
      })
    })
}

export function reportReturn(userId, amount, time) {
  const data = {
    userId: userId,
    returned: amount,
    time: time
  };
  return fetch("/return", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then(res => {
      if (res.ok) return res.json();
      return res.text().then(text => {
        throw new Error(text);
      })
    });
}

export function offload(userId) {
  return fetch(`/offload?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  }).then(res => {
    if (res.ok) return res.text();
    return res.text().then(text => {
      throw new Error("Status: " + res.status + ", message: " + text);
    });
  })
}

export function submit(userId, answers, feedback) {
  return fetch(`/submit?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      answers,
      feedback
    })
  }).then(res => {
    if (res.ok) return res;
    return res.text().then(text => {
      throw new Error("Failed to write data to database.\n " +
        " Request status: " + res.status +
        "\nError details: " + text +
      "\nPlease try again, but if the problem persists, contact the developer")
    })
  })
}

export function getUserId(participantAnswers) {
  return fetch("/new", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(participantAnswers)
  }).then(res => {
    if (res.ok) return res.json()
    return res.text().then(text => {
      throw new Error("Status: " + res.status + ", message: " + text);
    });
  });
}

export function checkForInvestment(userId, jobId) {
  const userIdEncoded = encodeURIComponent(userId);
  const jobIdEncoded = encodeURIComponent(jobId);
  return fetch(`/query/${jobIdEncoded}?userId=${userIdEncoded}`, {
    method: 'GET'
    // headers: {
    //   'Content-Type': 'application/json'
    // }
  }).then(res => {
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(text)
      });
    }
    return res.json();
  })
}

export function queryInvestment(userId) {
  return fetch(`/query?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
    // , body: JSON.stringify({ userId })
  }).then(res => {
    if (!res.ok) {
      return res.text()
        .then(text => {
          throw new Error(text);
        });
    }
    return res.json();
  })
    .catch(err => {
      throw err;
    });
}