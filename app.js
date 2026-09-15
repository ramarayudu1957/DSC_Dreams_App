// State Management
let masterQuestions = [];
let activeSessionQuestions = [];
let currentIndex = 0;
let userAnswers = {}; 
let currentMode = "practice"; // 'practice', 'test', 'remedial', 'review'
let timerInterval = null;
let secondsRemaining = 0;
let initialTimeSeconds = 0; 
let isSessionActive = false;

// Review State
let reviewSequence = [];
let reviewIndex = 0;

// LocalStorage Keys
const MISTAKES_KEY = "DSC_SGT_MISTAKES";
const SKIP_WELCOME_KEY = "DSC_SGT_SKIP_WELCOME";

document.addEventListener("DOMContentLoaded", async () => {
  await loadQuestionBank();
  setupRouting();
  populateDropdowns();
  updateDatasetSummary();
  updateRemedialCount();
  
  // Decide which screen to show on load
  const skipWelcome = localStorage.getItem(SKIP_WELCOME_KEY) === "true";
  if (skipWelcome) {
    switchPanel("panel-menu");
  } else {
    switchPanel("panel-welcome");
  }
});

async function loadQuestionBank() {
  try {
    const res = await fetch("question_bank.json");
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Question bank is empty or invalid");
    }
    masterQuestions = data;
  } catch (err) {
    console.error("Could not load question_bank.json", err);
  }
}


function getQuestionId(question) {
  return String(question.Question_ID || question.Question_ID_new || "").trim();
}

function getDifficultyBand(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") {
    return normalized;
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return "";
  if (numericValue <= 3) return "LOW";
  if (numericValue <= 7) return "MEDIUM";
  return "HIGH";
}

function updateDatasetSummary() {
  const paperSets = new Set();
  masterQuestions.forEach(question => {
    const parts = getQuestionId(question).split("_");
    if (parts.length >= 4) paperSets.add(parts.slice(0, 4).join("_"));
  });

  const questionCount = document.getElementById("dataset-question-count");
  const paperCount = document.getElementById("dataset-paper-count");
  if (questionCount) questionCount.innerText = masterQuestions.length.toLocaleString();
  if (paperCount) paperCount.innerText = paperSets.size.toLocaleString();
}

// Global Navigation Routing
function setupRouting() {
  
  // Welcome Screen "Continue" Button
  document.getElementById("btn-continue-app")?.addEventListener("click", () => {
    const skipChecked = document.getElementById("skip-welcome-cb").checked;
    if (skipChecked) {
      localStorage.setItem(SKIP_WELCOME_KEY, "true");
    }
    switchPanel("panel-menu");
  });

  // Open Instructions from Welcome
  document.getElementById("btn-open-instructions")?.addEventListener("click", () => {
    switchPanel("panel-instructions");
  });

  // Open Welcome from Main Menu (About link)
  document.getElementById("btn-about-app")?.addEventListener("click", () => {
    switchPanel("panel-welcome");
  });

  // 5 Flat Menu Cards
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const target = card.dataset.target;
      currentMode = card.dataset.mode; // 'practice' or 'test'
      
      if (target === "panel-topic") {
        document.getElementById("topic-panel-title").innerText = currentMode === "practice" ? "Grammar/Vocab Topic (Practice Mode)" : "Grammar/Vocab Topic (Testing Mode)";
        document.getElementById("topic-time-wrap").classList.toggle("hidden", currentMode === "practice");
      } else if (target === "panel-previous") {
        document.getElementById("prev-panel-title").innerText = currentMode === "practice" ? "Previous Paper (Practice Mode)" : "Previous Paper (Testing Mode)";
        document.getElementById("prev-time-wrap").classList.toggle("hidden", currentMode === "practice");
      }
      
      switchPanel(target);
    });
  });

  // Home/Menu Buttons
  document.querySelectorAll(".btn-home").forEach(btn => {
    btn.addEventListener("click", () => {
      if (isSessionActive) {
        if (!confirm("Do you really want to discontinue this session? You will lose all progress in this attempt.")) {
          return;
        }
        isSessionActive = false;
        clearInterval(timerInterval);
      }
      switchPanel("panel-menu");
    });
  });
}

function switchPanel(panelId) {
  document.querySelectorAll(".dashboard-view, .config-panel, .quiz-container, .result-screen").forEach(el => {
    el.classList.add("hidden");
  });
  document.getElementById(panelId).classList.remove("hidden");
  
  if (panelId === "panel-previous") {
    document.getElementById("prev-exam")?.dispatchEvent(new Event("change"));
  } else if (panelId === "panel-topic") {
    updateTopicFilterLiveCount(true);
  } else if (panelId === "panel-remedial") {
    updateRemedialCount();
  }
}

function populateDropdowns() {
  const broadAreas = new Set();
  masterQuestions.forEach(q => {
    if (q.Broad_Area) broadAreas.add(q.Broad_Area);
  });

  const topicBroad = document.getElementById("topic-broad");
  if(topicBroad) {
    topicBroad.innerHTML = '<option value="ALL">All Topics</option>';
    [...broadAreas].sort().forEach(ba => topicBroad.innerHTML += `<option value="${ba}">${ba}</option>`);
  }

  setTimeout(() => {
    document.getElementById("prev-exam")?.dispatchEvent(new Event("change"));
    document.getElementById("topic-broad")?.dispatchEvent(new Event("change"));
  }, 100);
}

// Previous Paper Logic
document.getElementById("prev-exam")?.addEventListener("change", (e) => {
  const selExam = e.target.value;
  const categorySelect = document.getElementById("prev-category");
  const yearSelect = document.getElementById("prev-year");
  const setSelect = document.getElementById("prev-set");

  categorySelect.innerHTML = '<option value="">Select Category</option>';
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  setSelect.innerHTML = '<option value="">Select Set</option>';
  yearSelect.disabled = true;
  setSelect.disabled = true;

  const categories = new Set();
  masterQuestions.forEach(q => {
    const parts = getQuestionId(q).split("_");
    if (parts[0] === selExam && parts[1]) categories.add(parts[1]);
  });

  [...categories].sort().forEach(category => {
    categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
  });
  categorySelect.disabled = categories.size === 0;
  categorySelect.dispatchEvent(new Event("change"));
});

document.getElementById("prev-category")?.addEventListener("change", (e) => {
  const selExam = document.getElementById("prev-exam").value;
  const selCategory = e.target.value;
  const yearSelect = document.getElementById("prev-year");
  const setSelect = document.getElementById("prev-set");

  yearSelect.innerHTML = '<option value="">Select Year</option>';
  setSelect.innerHTML = '<option value="">Select Set</option>';
  setSelect.disabled = true;
  if (!selCategory) {
    yearSelect.disabled = true;
    return;
  }

  const years = new Set();
  masterQuestions.forEach(q => {
    const parts = getQuestionId(q).split("_");
    if (parts[0] === selExam && parts[1] === selCategory && parts[2]) {
      years.add(parts[2]);
    }
  });

  [...years].sort((a, b) => Number(a) - Number(b)).forEach(year => {
    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
  });
  yearSelect.disabled = years.size === 0;
  yearSelect.dispatchEvent(new Event("change"));
});

document.getElementById("prev-year")?.addEventListener("change", (e) => {
  const selExam = document.getElementById("prev-exam").value;
  const selCategory = document.getElementById("prev-category").value;
  const selYear = e.target.value;
  const setSelect = document.getElementById("prev-set");

  setSelect.innerHTML = '<option value="">Select Set</option>';
  if (!selYear) {
    setSelect.disabled = true;
    return;
  }

  const sets = new Set();
  masterQuestions.forEach(q => {
    const parts = getQuestionId(q).split("_");
    if (parts[0] === selExam && parts[1] === selCategory && parts[2] === selYear && parts[3]) {
      sets.add(parts[3]);
    }
  });

  [...sets].sort((a, b) => Number(a) - Number(b)).forEach(setNumber => {
    setSelect.innerHTML += `<option value="${setNumber}">Set ${setNumber}</option>`;
  });
  setSelect.disabled = sets.size === 0;
  setSelect.dispatchEvent(new Event("change"));
});

document.getElementById("prev-set")?.addEventListener("change", (e) => {
  const selExam = document.getElementById("prev-exam").value;
  const selCategory = document.getElementById("prev-category").value;
  const selYear = document.getElementById("prev-year").value;
  const selSet = e.target.value;

  if (!selSet) {
    document.getElementById("prev-start").disabled = true;
    return;
  }

  const matching = masterQuestions.filter(q => {
    const parts = getQuestionId(q).split("_");
    return parts[0] === selExam && parts[1] === selCategory &&
      parts[2] === selYear && parts[3] === selSet;
  });

  document.getElementById("prev-count").innerText = matching.length;
  const totalSecs = matching.length * 55;
  document.getElementById("prev-time").innerText = `${Math.ceil(totalSecs / 60)} mins`;
  document.getElementById("prev-start").disabled = matching.length === 0;
});

// Topic Panel Logic
document.getElementById("topic-broad")?.addEventListener("change", (e) => {
  const broad = e.target.value;
  const subSelect = document.getElementById("topic-sub");
  subSelect.innerHTML = '<option value="ALL">All Subtopics</option>';

  if (broad === "ALL") {
    subSelect.disabled = true;
  } else {
    const subsCounts = {};
    masterQuestions.filter(q => q.Broad_Area === broad).forEach(q => {
      if (q.Main_Area) {
        subsCounts[q.Main_Area] = (subsCounts[q.Main_Area] || 0) + 1;
      }
    });
    
    Object.keys(subsCounts).sort().forEach(s => {
      if(subsCounts[s] >= 10) {
        subSelect.innerHTML += `<option value="${s}">${s} (${subsCounts[s]} qns)</option>`;
      }
    });
    subSelect.disabled = false;
  }
  updateTopicFilterLiveCount(true);
});

["topic-exam", "topic-sub", "topic-diff"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => updateTopicFilterLiveCount(true));
});
document.getElementById("topic-qcount")?.addEventListener("change", () => updateTopicFilterLiveCount(false));
document.getElementById("topic-qcount")?.addEventListener("keyup", () => updateTopicFilterLiveCount(false));

// Stepper Logic
document.getElementById("btn-q-down")?.addEventListener("click", () => {
  const el = document.getElementById("topic-qcount");
  let val = parseInt(el.value) || 1;
  if (val > 1) { el.value = val - 1; updateTopicFilterLiveCount(false); }
});
document.getElementById("btn-q-up")?.addEventListener("click", () => {
  const el = document.getElementById("topic-qcount");
  let val = parseInt(el.value) || 1;
  let max = parseInt(el.max) || 1;
  if (val < max) { el.value = val + 1; updateTopicFilterLiveCount(false); }
});

function getFilteredTopicQuestions() {
  const ex = document.getElementById("topic-exam").value;
  const broad = document.getElementById("topic-broad").value;
  const sub = document.getElementById("topic-sub").value;
  const diff = document.getElementById("topic-diff").value;

  return masterQuestions.filter(q => {
    if (ex !== "ALL" && !getQuestionId(q).startsWith(`${ex}_`)) return false;
    if (broad !== "ALL" && q.Broad_Area !== broad) return false;
    if (sub !== "ALL" && q.Main_Area !== sub) return false;
    if (diff !== "ALL") {
      const selectedBand = diff === "MED" ? "MEDIUM" : diff;
      if (getDifficultyBand(q.Difficulty) !== selectedBand) return false;
    }
    return true;
  });
}

function updateTopicFilterLiveCount(resetCount = false) {
  const list = getFilteredTopicQuestions();
  const count = list.length;
  document.getElementById("topic-avail-count").innerText = count;
  
  const qInput = document.getElementById("topic-qcount");
  qInput.max = count;
  if (resetCount || !qInput.value || parseInt(qInput.value) > count) {
      qInput.value = count;
  }
  
  document.getElementById("topic-start").disabled = count === 0;

  const maxQ = parseInt(qInput.value) || count;
  const totalSecs = maxQ * 55;
  document.getElementById("topic-time").innerText = `${Math.ceil(totalSecs / 60)} mins`;
}

// Start Buttons
document.getElementById("prev-start")?.addEventListener("click", () => {
  const selExam = document.getElementById("prev-exam").value;
  const selCategory = document.getElementById("prev-category").value;
  const selYear = document.getElementById("prev-year").value;
  const selSet = document.getElementById("prev-set").value;

  activeSessionQuestions = masterQuestions.filter(q => {
    const parts = getQuestionId(q).split("_");
    return parts[0] === selExam && parts[1] === selCategory &&
      parts[2] === selYear && parts[3] === selSet;
  });
  startSession(currentMode === "test");
});

document.getElementById("topic-start")?.addEventListener("click", () => {
  let list = getFilteredTopicQuestions();
  const maxQ = parseInt(document.getElementById("topic-qcount").value) || list.length;
  activeSessionQuestions = list.slice(0, maxQ);
  startSession(currentMode === "test"); 
});

document.getElementById("remedial-start")?.addEventListener("click", () => {
  const mistakeIds = getStoredMistakes();
  activeSessionQuestions = masterQuestions.filter(q => mistakeIds.includes(getQuestionId(q)));
  
  if (document.getElementById("remedial-ignore-opt").checked) {
    localStorage.removeItem(MISTAKES_KEY);
    updateRemedialCount();
  }
  startSession(true); 
});

// Quiz Engine
function startSession(isTimed) {
  currentIndex = 0;
  userAnswers = {};
  isSessionActive = true;
  
  document.querySelectorAll(".config-panel, .dashboard-view").forEach(p => p.classList.add("hidden"));
  document.getElementById("quiz-container").classList.remove("hidden");
  document.getElementById("instant-feedback").classList.add("hidden");

  const timerElem = document.getElementById("quiz-timer");
  if (isTimed) {
    timerElem.classList.remove("hidden");
    initialTimeSeconds = activeSessionQuestions.length * 55;
    secondsRemaining = initialTimeSeconds;
    runTimer();
  } else {
    initialTimeSeconds = 0;
    timerElem.classList.add("hidden");
    clearInterval(timerInterval);
  }

  renderQuestion(currentIndex);
}

function runTimer() {
  clearInterval(timerInterval);
  const timerElem = document.getElementById("quiz-timer");
  
  function updateTimer() {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    timerElem.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Time is up! Submitting your test automatically.");
      submitTest();
    }
    secondsRemaining--;
  }
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function renderQuestion(idx) {
  const actualIdx = currentMode === "review" ? reviewSequence[idx] : idx;
  const q = activeSessionQuestions[actualIdx];
  
  document.getElementById("q-counter").innerText = currentMode === "review" 
    ? `Reviewing Question ${idx + 1} of ${reviewSequence.length} (Orig Q${actualIdx + 1})`
    : `Question ${idx + 1} of ${activeSessionQuestions.length}`;
    
  document.getElementById("q-id").innerText = `ID: ${getQuestionId(q) || '-'}`;
  document.getElementById("q-text").innerHTML = q.Question;

  const optionsWrap = document.getElementById("options-list");
  optionsWrap.innerHTML = "";
  const feedbackCard = document.getElementById("instant-feedback");
  feedbackCard.classList.add("hidden");

  const opts = ["A", "B", "C", "D"];
  opts.forEach(letter => {
    const optVal = q[`Option ${letter}`];
    if (!optVal) return;

    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<strong>(${letter})</strong> <span>${optVal}</span>`;

    if (userAnswers[actualIdx] === letter) {
      btn.classList.add("selected");
    }

    if (currentMode === "review") {
      if (letter === q.Answer) btn.classList.add("correct");
      if (userAnswers[actualIdx] === letter && letter !== q.Answer) btn.classList.add("wrong");
      btn.disabled = true; 
    } else {
      btn.addEventListener("click", () => handleSelectOption(letter, actualIdx));
    }
    
    optionsWrap.appendChild(btn);
  });

  if ((currentMode === "practice" && userAnswers[actualIdx]) || currentMode === "review") {
    showPracticeFeedback(userAnswers[actualIdx] || "Unanswered", actualIdx);
  }

  // Handle Bottom Navigation buttons state
  document.getElementById("btn-prev").disabled = idx === 0;
  
  if (currentMode === "review") {
    document.getElementById("btn-next").disabled = idx === reviewSequence.length - 1;
    document.getElementById("btn-submit").classList.add("hidden");
  } else {
    document.getElementById("btn-next").disabled = idx === activeSessionQuestions.length - 1;
    document.getElementById("btn-submit").classList.remove("hidden");
  }
}

function handleSelectOption(letter, actualIdx) {
  userAnswers[actualIdx] = letter;
  const q = activeSessionQuestions[actualIdx];

  if (currentMode === "practice") {
    if (letter !== q.Answer) logMistake(getQuestionId(q));
    renderQuestion(currentIndex);
  } else {
    renderQuestion(currentIndex);
  }
}

function showPracticeFeedback(letter, actualIdx) {
  const q = activeSessionQuestions[actualIdx];
  const fbCard = document.getElementById("instant-feedback");
  
  let fbText = "";
  if (letter === "Unanswered") {
      fbText = `You did not answer this question. The correct answer was <strong>${q.Answer}</strong>.`;
  } else {
      fbText = q[`Feedback ${letter}`] || (letter === q.Answer ? "Correct!" : "Incorrect option.");
  }
  
  fbCard.innerHTML = `<strong>Feedback:</strong> ${fbText}`;
  fbCard.classList.remove("hidden");
}

// Navigation Events
document.getElementById("btn-prev")?.addEventListener("click", () => {
  if (currentMode === "review") {
    if (reviewIndex > 0) { reviewIndex--; renderQuestion(reviewIndex); }
  } else {
    if (currentIndex > 0) { currentIndex--; renderQuestion(currentIndex); }
  }
});

document.getElementById("btn-next")?.addEventListener("click", () => {
  if (currentMode === "review") {
    if (reviewIndex < reviewSequence.length - 1) { reviewIndex++; renderQuestion(reviewIndex); }
  } else {
    if (currentIndex < activeSessionQuestions.length - 1) { currentIndex++; renderQuestion(currentIndex); }
  }
});

document.getElementById("btn-review-modal")?.addEventListener("click", () => {
  const pal = document.getElementById("review-palette");
  pal.innerHTML = "";
  
  const seq = currentMode === "review" ? reviewSequence : activeSessionQuestions.map((_, i) => i);
  
  seq.forEach((actualIdx, i) => {
    const b = document.createElement("button");
    b.className = "pal-btn";
    b.innerText = actualIdx + 1;
    if (userAnswers[actualIdx]) b.classList.add("answered");
    
    if (currentMode === "review" && i === reviewIndex) b.classList.add("current");
    if (currentMode !== "review" && actualIdx === currentIndex) b.classList.add("current");
    
    b.addEventListener("click", () => {
      if (currentMode === "review") {
        reviewIndex = i;
        renderQuestion(reviewIndex);
      } else {
        currentIndex = actualIdx;
        renderQuestion(currentIndex);
      }
      document.getElementById("review-modal").classList.add("hidden");
    });
    pal.appendChild(b);
  });
  document.getElementById("review-modal").classList.remove("hidden");
});

document.getElementById("close-review")?.addEventListener("click", () => {
  document.getElementById("review-modal").classList.add("hidden");
});

// Submit & Scoring
document.getElementById("btn-submit")?.addEventListener("click", () => {
  const answeredCount = Object.keys(userAnswers).length;
  const total = activeSessionQuestions.length;
  if (confirm(`You have answered ${answeredCount} of ${total} questions. Are you ready to submit?`)) {
    submitTest();
  }
});

function submitTest() {
  isSessionActive = false;
  clearInterval(timerInterval);
  document.getElementById("quiz-container").classList.add("hidden");
  document.getElementById("result-screen").classList.remove("hidden");

  let correct = 0;
  let wrong = 0;

  activeSessionQuestions.forEach((q, idx) => {
    const userPick = userAnswers[idx];
    if (userPick) {
      if (userPick === q.Answer) correct++;
      else { wrong++; logMistake(getQuestionId(q)); }
    } else {
      logMistake(getQuestionId(q));
    }
  });

  const total = activeSessionQuestions.length;
  const unanswered = total - (correct + wrong);
  const pct = Math.round((correct / total) * 100) || 0;

  document.getElementById("res-score").innerText = `${correct} / ${total}`;
  document.getElementById("res-percentage").innerText = `${pct}% Accuracy`;
  document.getElementById("res-correct").innerText = correct;
  document.getElementById("res-wrong").innerText = wrong;
  document.getElementById("res-unanswered").innerText = unanswered;

  let feedbackMsg = "";
  
  if (initialTimeSeconds > 0) {
    const timeTaken = initialTimeSeconds - secondsRemaining;
    const timePctRemaining = (secondsRemaining / initialTimeSeconds) * 100;
    const timeTakenPct = (timeTaken / initialTimeSeconds) * 100;

    let speedBand = "";
    if (timeTakenPct <= 50) speedBand = "Blazing";
    else if (timePctRemaining >= 25) speedBand = "Fast";
    else speedBand = "On time";

    let scoreBand = 0;
    if (pct >= 90) scoreBand = 1;
    else if (pct >= 81) scoreBand = 2;
    else if (pct >= 61) scoreBand = 3;
    else if (pct >= 41) scoreBand = 4;
    else if (pct >= 21) scoreBand = 5;
    else scoreBand = 6;

    if (scoreBand === 1) {
        if (speedBand === "Blazing") feedbackMsg = "Outstanding! Top score and you flew through it.";
        else if (speedBand === "Fast") feedbackMsg = "Brilliant work — excellent score with time to spare.";
        else feedbackMsg = "Exceptional performance. You nailed it.";
    } else if (scoreBand === 2) {
        if (speedBand === "Blazing") feedbackMsg = "Impressive! High score and finished super quick.";
        else if (speedBand === "Fast") feedbackMsg = "Great job — strong score and nice pace.";
        else feedbackMsg = "Very solid result. Well done.";
    } else if (scoreBand === 3) {
        if (speedBand === "Blazing") feedbackMsg = "Nice work! Good score and you were really quick.";
        else if (speedBand === "Fast") feedbackMsg = "Solid performance with time left on the clock.";
        else feedbackMsg = "Good effort. Steady and complete.";
    } else if (scoreBand === 4) {
        if (speedBand === "Blazing") feedbackMsg = "You moved fast — decent score for the speed.";
        else if (speedBand === "Fast") feedbackMsg = "Fair result and you finished with time remaining.";
        else feedbackMsg = "You got through it. Room to improve the score.";
    } else if (scoreBand === 5) {
        if (speedBand === "Blazing") feedbackMsg = "Quick finish, but the score needs attention.";
        else if (speedBand === "Fast") feedbackMsg = "Finished early — let’s work on accuracy next time.";
        else feedbackMsg = "Completed on time. Focus on improving the score.";
    } else {
        feedbackMsg = "You finished the test. Let’s review and come back stronger.";
    }
  } else {
    if (pct >= 81) feedbackMsg = "Excellent accuracy! Keep up the great work.";
    else if (pct >= 61) feedbackMsg = "Good job. Review your mistakes and try again.";
    else feedbackMsg = "Practice makes perfect. Let's review the explanations.";
  }

  document.getElementById("res-feedback-text").innerText = feedbackMsg;

  const btnReviewMisses = document.getElementById("btn-review-misses");
  if (wrong > 0 || unanswered > 0) {
    btnReviewMisses.classList.remove("hidden");
  } else {
    btnReviewMisses.classList.add("hidden");
  }
}

// Targeted Review Buttons
document.getElementById("btn-review-answers")?.addEventListener("click", () => {
  reviewSequence = activeSessionQuestions.map((_, i) => i);
  startReview();
});

document.getElementById("btn-review-misses")?.addEventListener("click", () => {
  reviewSequence = activeSessionQuestions.map((q, i) => i).filter(i => userAnswers[i] !== activeSessionQuestions[i].Answer);
  startReview();
});

function startReview() {
  document.getElementById("result-screen").classList.add("hidden");
  document.getElementById("quiz-container").classList.remove("hidden");
  currentMode = "review"; 
  reviewIndex = 0;
  renderQuestion(reviewIndex);
}

// Mistake Logging
function getStoredMistakes() { return JSON.parse(localStorage.getItem(MISTAKES_KEY) || "[]"); }

function logMistake(qId) {
  if (!qId) return;
  const mistakes = getStoredMistakes();
  if (!mistakes.includes(qId)) {
    mistakes.push(qId);
    localStorage.setItem(MISTAKES_KEY, JSON.stringify(mistakes));
  }
  updateRemedialCount();
}

function updateRemedialCount() {
  const count = getStoredMistakes().length;
  const el = document.getElementById("remedial-count");
  if (el) el.innerText = count;
  const startBtn = document.getElementById("remedial-start");
  if (startBtn) startBtn.disabled = count === 0;
}

document.getElementById("remedial-clear")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear your mistakes log?")) {
    localStorage.removeItem(MISTAKES_KEY);
    updateRemedialCount();
  }
});