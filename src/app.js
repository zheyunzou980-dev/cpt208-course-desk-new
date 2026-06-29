const KB_STORAGE_KEY = "cpt208.qa.knowledge";
const KB_VERSION_STORAGE_KEY = "cpt208.qa.knowledgeVersion";
const INQUIRY_LOG_STORAGE_KEY = "cpt208.qa.inquiryLogs";
const SESSION_STORAGE_KEY = "cpt208.qa.session";
const CHAT_SESSION_STORAGE_KEY = "cpt208.qa.chatSessions";
const USER_STORAGE_KEY = "cpt208.qa.users";
const MATERIAL_LIBRARY_STORAGE_KEY = "cpt208.qa.materialLibrary";
const QUESTION_CARD_GROUPS_STORAGE_KEY = "cpt208.qa.questionCardGroups";
const EXTRACTED_TEXT_LIBRARY = {
  "all_qa_information": { sourceDocument: "ALL_QA_information.txt", text: window.CPT208_EXTRACTED_ALL_QA_INFORMATION || "" },
  "cpt20825-26handbook": { sourceDocument: "CPT20825-26handbook.txt", text: window.CPT208_EXTRACTED_CPT20825_26_HANDBOOK || "" },
  "cpt208.coursework.group.24-25week8": { sourceDocument: "CPT208.Coursework.Group.24-25Week8.txt", text: window.CPT208_EXTRACTED_GROUP_WEEK8 || "" },
  "cpt208.ay2024-25.modulehandbook": { sourceDocument: "CPT208.AY2024-25.ModuleHandbook.txt", text: window.CPT208_EXTRACTED_AY2024_25_HANDBOOK || "" },
  "cpt208.ay2526.coursework.project": { sourceDocument: "CPT208.AY2526.Coursework.Project.txt", text: window.CPT208_EXTRACTED_AY2526_PROJECT || "" },
  "cpt208_posterprintingtemplate": { sourceDocument: "CPT208_PosterPrintingTemplate.txt", text: window.CPT208_EXTRACTED_POSTER_TEMPLATE || "" },
};
const KB_VERSION = "2026-06-16-static-morandi-alerts";
const MIN_CONFIDENCE_SCORE = 2.6;
const MIN_TOKEN_COVERAGE = 0.34;
const STRONG_MATCH_SCORE = 4.2;
const STRONG_MATCH_COVERAGE = 0.45;
const TEACHER_REGISTRATION_CODE = "cpt208-admin";

const DEFAULT_USERS = [
  { id: "user_demo_student", username: "student", password: "cpt208", role: "student", name: "Student Demo", source: "demo" },
  { id: "user_demo_teacher", username: "teacher", password: "cpt208-admin", role: "teacher", name: "Teacher Demo", source: "demo" },
];

const DEFAULT_QUICK_CARDS = [
  {
    id: "card_001",
    week_label: "Core FAQs",
    status: "published",
    category: "Backend",
    question: "Do I need to deploy my system to a cloud server?",
    answer: "No",
    detail: "A cloud server is not a must-have. Students can run locally and record the video demo.",
  },
  {
    id: "card_002",
    week_label: "Core FAQs",
    status: "published",
    category: "Video",
    question: "Can the demo video be longer than 2 minutes?",
    answer: "No",
    detail: "The demo video should be a concise 2-minute system demo.",
  },
  {
    id: "card_003",
    week_label: "Core FAQs",
    status: "published",
    category: "Portfolio",
    question: "Should the portfolio use a horizontal layout?",
    answer: "Yes",
    detail: "The portfolio should be horizontal rather than a vertical A4 layout.",
  },
  {
    id: "card_004",
    week_label: "Core FAQs",
    status: "published",
    category: "Poster",
    question: "Is the poster size A1?",
    answer: "Yes",
    detail: "The poster should be A1. If using the school stand, follow the provided 80 x 180 cm printing template.",
  },
  {
    id: "card_005",
    week_label: "Core FAQs",
    status: "published",
    category: "AI policy",
    question: "Can I use AI-generated voiceover for the demo video?",
    answer: "No",
    detail: "Please record your own voiceover. If AI is used elsewhere, acknowledge and reference it clearly.",
  },
  {
    id: "card_006",
    week_label: "Core FAQs",
    status: "published",
    category: "Presentation",
    question: "Will a projector be provided for the poster presentation?",
    answer: "No",
    detail: "No projector is provided. Bring your own iPad or laptop if you want to show slides or supporting materials.",
  },
  {
    id: "card_007",
    week_label: "Core FAQs",
    status: "published",
    category: "Language",
    question: "If our app is in Chinese, should non-Chinese speakers still be able to understand the poster?",
    answer: "Yes",
    detail: "Add English captions, annotations, or translations so non-Chinese speakers can understand the project.",
  },
  {
    id: "card_008",
    week_label: "Core FAQs",
    status: "published",
    category: "Submission",
    question: "Should the final submission include three files?",
    answer: "Yes",
    detail: "Submit the portfolio ZIP, demo system ZIP, and 2-minute demo video using the required naming convention.",
  },
];

const DEFAULT_LATEST_UPDATES = [];
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "about", "can", "do", "does", "for", "from", "have", "how",
  "i", "is", "need", "of", "on", "or", "should", "student", "students", "that", "the",
  "this", "to", "what", "when", "where", "which", "who", "with", "cpt208",
]);

const state = {
  items: [],
  inquiryLogs: [],
  questionCards: [],
  latestUpdates: [],
  qaHistory: [],
  inquiryHistory: [],
  integrations: {
    database_mode: "local-json",
    openai_configured: false,
    pinecone_configured: false,
    retrieval_mode: "local-json",
    answer_mode: "extractive",
  },
  answerSettings: {
    onlyAnswerFromUploadedMaterials: true,
    showSourceAfterAnswer: true,
    sendToTeacherReviewIfNoSource: true,
  },
  users: [],
  userCount: 0,
  backendReady: false,
  session: null,
  mode: "student",
  chatSessions: [],
  activeSessionId: "",
  activeSources: [],
  activeFlipIndex: 0,
  cardAnswers: {},
  showResolvedInquiries: false,
  pendingIngestFiles: [],
  teacherPage: "overview",
  materials: [],
  questionCardGroups: [],
};

const $ = (selector) => document.querySelector(selector);

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function apiRequest(path, options = {}) {
  if (!state.backendReady && path !== "/api/bootstrap" && path !== "/api/health") {
    throw new Error("Backend is not active.");
  }
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.session?.token ? { Authorization: `Bearer ${state.session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "API request failed.");
  return payload;
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function materialLookupKey(name) {
  return String(name || "").toLowerCase().replace(/\.pdf$/i, "").replace(/\.txt$/i, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

function findExistingExtractedText(fileName) {
  const key = materialLookupKey(fileName);
  return EXTRACTED_TEXT_LIBRARY[key] && EXTRACTED_TEXT_LIBRARY[key].text
    ? EXTRACTED_TEXT_LIBRARY[key]
    : null;
}

function isDuplicateOfficialAnswer(pair) {
  return state.items.some((item) => {
    const sameQuestion = normalizeWhitespace(item.question).toLowerCase() === normalizeWhitespace(pair.question).toLowerCase();
    const sameAnswer = normalizeWhitespace(item.answer).toLowerCase() === normalizeWhitespace(pair.answer).toLowerCase();
    return item.status === "approved" && (sameQuestion || (sameQuestion && sameAnswer));
  });
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeItem(item) {
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : String(item.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    embedding: item.embedding || "[vector generated during ingestion]",
    status: item.status || "draft",
    source: item.source || "teacher",
  };
}

function normalizeQuickCard(card, index = 0) {
  return {
    id: card.id || `card_${String(index + 1).padStart(3, "0")}`,
    week_label: String(card.week_label || card.weekLabel || "Core FAQs").trim(),
    category: String(card.category || "Coursework").trim(),
    question: String(card.question || "").trim(),
    answer: String(card.answer || card.correctAnswer || "").trim(),
    options: Array.isArray(card.options) && card.options.length ? card.options : ["Yes", "No"],
    detail: String(card.detail || "").trim(),
    status: card.status === "draft" || card.status === "archived" ? card.status : "published",
    updated_at: card.updated_at || new Date().toISOString(),
  };
}

function normalizeUser(user) {
  return {
    id: user.id || uid("user"),
    username: String(user.username || "").trim(),
    password: String(user.password || ""),
    role: user.role === "teacher" ? "teacher" : "student",
    name: String(user.name || user.username || "").trim(),
    source: user.source || "registered",
    created_at: user.created_at || new Date().toISOString(),
  };
}

function normalizeQuestionCard(card) {
  const now = new Date().toISOString();
  return {
    id: card.id || uid("card"),
    question: normalizeWhitespace(card.question),
    correctAnswer: card.correctAnswer === "No" ? "No" : "Yes",
    explanation: normalizeWhitespace(card.explanation),
    source: String(card.source || "").trim(),
    status: card.status === "published" ? "published" : "draft",
    groupId: String(card.groupId || "").trim(),
    createdAt: card.createdAt || now,
    updatedAt: card.updatedAt || now,
  };
}

function publishedQuickCards() {
  const teacherCards = (state.questionCards || [])
    .filter((card) => card.status === "published")
    .map((card, index) => normalizeQuickCard({
      ...card,
      week_label: state.questionCardGroups.find((group) => group.id === card.groupId)?.name || "Core FAQs",
      category: card.category || "Coursework",
      answer: card.correctAnswer,
      detail: card.explanation,
      updated_at: card.updatedAt,
    }, index));
  return teacherCards.length ? teacherCards : DEFAULT_QUICK_CARDS.map(normalizeQuickCard);
}

function isCardCorrect(card, answer) {
  return String(answer || "").trim().toLowerCase() === String(card.answer || "").trim().toLowerCase();
}

function completedCardCount() {
  const cards = publishedQuickCards();
  return cards.filter((card) => state.cardAnswers[card.id]).length;
}

function allCardsCompleted() {
  const cards = publishedQuickCards();
  return cards.length > 0 && completedCardCount() === cards.length;
}

function loadUsers() {
  const storedUsers = readJson(USER_STORAGE_KEY, []).map(normalizeUser);
  const storedNames = new Set(storedUsers.map((user) => user.username.toLowerCase()));
  state.users = [
    ...DEFAULT_USERS.filter((user) => !storedNames.has(user.username.toLowerCase())).map(normalizeUser),
    ...storedUsers,
  ];
  persistUsers();
}

function persistUsers() {
  writeJson(USER_STORAGE_KEY, state.users);
}

function findUser(username) {
  const normalized = String(username || "").trim().toLowerCase();
  return state.users.find((user) => user.username.toLowerCase() === normalized) || null;
}

function normalizeQuestionCardGroup(group = {}) {
  const now = new Date().toISOString();
  return {
    id: group.id || uid("card_group"),
    name: normalizeWhitespace(group.name || "Untitled Group"),
    description: normalizeWhitespace(group.description || ""),
    pinned: Boolean(group.pinned),
    createdAt: group.createdAt || now,
    updatedAt: group.updatedAt || now,
  };
}

function normalizeAnswerSettings(settings = {}) {
  return {
    onlyAnswerFromUploadedMaterials: settings.onlyAnswerFromUploadedMaterials !== false,
    showSourceAfterAnswer: settings.showSourceAfterAnswer !== false,
    sendToTeacherReviewIfNoSource: settings.sendToTeacherReviewIfNoSource !== false,
  };
}

function normalizeInquiryLog(log = {}) {
  const now = new Date().toISOString();
  return {
    ...log,
    id: log.id || uid("log"),
    question: normalizeWhitespace(log.question),
    draftAnswer: normalizeWhitespace(log.draftAnswer || log.answer_preview || ""),
    source: normalizeWhitespace(log.source || (Array.isArray(log.source_documents) ? log.source_documents.join("; ") : "")),
    status: log.status || "pending",
    teacherDecision: log.teacherDecision || log.review_status || "pending",
    createdAt: log.createdAt || log.asked_at || now,
    updatedAt: log.updatedAt || now,
    review_status: log.review_status || log.teacherDecision || "pending",
    reviewed: Boolean(log.reviewed),
    source_ids: Array.isArray(log.source_ids) ? log.source_ids : [],
    source_documents: Array.isArray(log.source_documents) ? log.source_documents : [],
  };
}

function normalizeLatestUpdate(update = {}, index = 0) {
  return {
    id: update.id || `update_${String(index + 1).padStart(3, "0")}`,
    question: normalizeWhitespace(update.question),
    answer: normalizeWhitespace(update.answer),
    explanation: normalizeWhitespace(update.explanation),
    source: normalizeWhitespace(update.source || "teacher_review"),
    publishedAt: update.publishedAt || update.published_at || new Date().toISOString(),
    published_at: update.published_at || update.publishedAt || new Date().toISOString(),
    visibleToStudents: update.visibleToStudents !== false,
  };
}

async function loadBackendData() {
  if (!["http:", "https:"].includes(window.location.protocol)) return false;
  try {
    const data = await apiRequest("/api/bootstrap");
    state.backendReady = true;
    state.userCount = data.user_count || 0;
    if (data.user && state.session) {
      state.session = { ...state.session, ...data.user, token: state.session.token };
      persistSession();
    } else if (state.session?.token) {
      state.session = null;
      persistSession();
    }
    state.items = (data.qa_items || []).map(normalizeItem);
    state.qaHistory = data.qa_history || [];
    state.inquiryLogs = (data.inquiry_logs || []).map(normalizeInquiryLog);
    state.questionCards = (data.questionCards || []).map(normalizeQuestionCard);
    state.inquiryHistory = data.inquiry_history || [];
    state.latestUpdates = (data.latestUpdates || data.latest_updates || DEFAULT_LATEST_UPDATES).map(normalizeLatestUpdate);
    state.integrations = data.integrations || state.integrations;
    state.answerSettings = normalizeAnswerSettings(data.answerSettings || state.answerSettings);
    writeJson(KB_STORAGE_KEY, state.items);
    writeJson(INQUIRY_LOG_STORAGE_KEY, state.inquiryLogs);
    return true;
  } catch (error) {
    console.warn(`Backend unavailable: ${error.message}`);
    state.backendReady = false;
    return false;
  }
}

function loadKnowledgeBase() {
  const cached = localStorage.getItem(KB_STORAGE_KEY);
  const cachedVersion = localStorage.getItem(KB_VERSION_STORAGE_KEY);
  const defaults = (window.CPT208_KNOWLEDGE_BASE || []).map(normalizeItem);
  if (cached && cachedVersion === KB_VERSION) {
    const cachedItems = JSON.parse(cached).map(normalizeItem);
    const cachedIds = new Set(cachedItems.map((item) => item.id));
    state.items = [...cachedItems, ...defaults.filter((item) => !cachedIds.has(item.id))];
  } else {
    state.items = defaults;
  }
  persistKnowledgeBase();
}

function persistKnowledgeBase() {
  writeJson(KB_STORAGE_KEY, state.items);
  localStorage.setItem(KB_VERSION_STORAGE_KEY, KB_VERSION);
  if (state.backendReady) {
    apiRequest("/api/qa", {
      method: "PUT",
      body: JSON.stringify({ qa_items: state.items }),
    }).then((data) => {
      state.qaHistory = data.qa_history || state.qaHistory;
      renderKnowledgeActivity();
    }).catch((error) => console.warn(error.message));
  }
}

function loadInquiryLogs() {
  state.inquiryLogs = readJson(INQUIRY_LOG_STORAGE_KEY, []).map(normalizeInquiryLog);
  deriveConfidenceForOldLogs();
}

function persistInquiryLogs() {
  writeJson(INQUIRY_LOG_STORAGE_KEY, state.inquiryLogs);
  if (state.backendReady && isTeacher()) {
    apiRequest("/api/inquiries", {
      method: "PUT",
      body: JSON.stringify({ inquiry_logs: state.inquiryLogs }),
    }).then((data) => {
      state.inquiryHistory = data.inquiry_history || state.inquiryHistory;
    }).catch((error) => console.warn(error.message));
  }
}

function loadChatSessions() {
  state.chatSessions = readJson(CHAT_SESSION_STORAGE_KEY, []);
  if (!state.chatSessions.length) createChatSession(false);
  state.activeSessionId = state.chatSessions[0].id;
}

function loadMaterialLibrary() {
  state.materials = readJson(MATERIAL_LIBRARY_STORAGE_KEY, []);
}

function persistMaterialLibrary() {
  writeJson(MATERIAL_LIBRARY_STORAGE_KEY, state.materials);
}

function loadQuestionCardGroups() {
  const stored = readJson(QUESTION_CARD_GROUPS_STORAGE_KEY, []);
  state.questionCardGroups = stored.map(normalizeQuestionCardGroup);
}

function persistQuestionCardGroups() {
  const pinnedId = state.questionCardGroups.find((group) => group.pinned)?.id || "";
  state.questionCardGroups = state.questionCardGroups.map((group) => normalizeQuestionCardGroup({ ...group, pinned: group.id === pinnedId }));
  writeJson(QUESTION_CARD_GROUPS_STORAGE_KEY, state.questionCardGroups);
}

function persistChatSessions() {
  writeJson(CHAT_SESSION_STORAGE_KEY, state.chatSessions);
}

function loadSession() {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  state.session = raw ? JSON.parse(raw) : null;
}

function persistSession() {
  if (state.session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.session));
  else sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function isTeacher() {
  return state.session?.role === "teacher";
}

function openTeacherAuth(mode = "login") {
  showAuthMode(mode);
  document.body.classList.add("auth-panel-open");
  $("#login-username").focus();
}

function closeTeacherAuth() {
  document.body.classList.remove("auth-panel-open");
}

function showAuthMode(mode) {
  const isRegister = mode === "register";
  $("#login-form").classList.toggle("is-hidden", isRegister);
  $("#register-form").classList.toggle("is-hidden", !isRegister);
  $("#login-error").textContent = "";
  $("#register-error").textContent = "";
}

function startSessionForUser(user, token = "") {
  state.session = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    token: token || user.token || "",
  };
  state.mode = user.role === "teacher" ? "teacher" : "student";
  persistSession();
  closeTeacherAuth();
  renderAuthState();
}

function searchKnowledge(query, includeDrafts = false) {
  const querySet = new Set(tokenize(query));
  if (!querySet.size) return [];

  const onlyUploadedMaterials = state.answerSettings?.onlyAnswerFromUploadedMaterials;
  const visibleItems = state.items.filter((item) => {
    const matchesStatus = includeDrafts || item.status === "approved";
    if (!matchesStatus) return false;
    if (!onlyUploadedMaterials) return true;
    return item.source === "teacher-upload";
  });

  return visibleItems
    .filter((item) => includeDrafts || item.status === "approved")
    .map((item) => {
      const questionText = [item.question, ...(item.aliases || [])].join(" ");
      const questionSet = new Set(tokenize(questionText));
      const answerSet = new Set(tokenize(item.answer));
      const tagSet = new Set(tokenize((item.tags || []).join(" ")));
      const questionOverlap = [...querySet].filter((token) => questionSet.has(token)).length;
      const answerOverlap = [...querySet].filter((token) => answerSet.has(token)).length;
      const tagOverlap = [...querySet].filter((token) => tagSet.has(token)).length;
      const coverage = Math.max(questionOverlap + tagOverlap, questionOverlap + answerOverlap * 0.45) / querySet.size;
      const exactQuestionBonus = questionText.toLowerCase().includes(query.toLowerCase()) ? 5 : 0;
      const compactQuery = [...querySet].join(" ");
      const compactQuestion = tokenize(questionText).join(" ");
      const compactAnswer = tokenize(item.answer).join(" ");
      const phraseBonus = compactQuestion.includes(compactQuery) ? 4 : compactAnswer.includes(compactQuery) ? 3 : 0;
      const currentYearBonus = String(item.source_year || "").includes("2025-26") ? 0.6 : 0;
      const historicalPenalty = String(item.source_year || "").includes("historical") ? 0.35 : 0;
      const score = questionOverlap * 3 + tagOverlap * 2 + answerOverlap * 0.85 + exactQuestionBonus + phraseBonus + currentYearBonus - historicalPenalty;
      return { item, score, coverage, questionOverlap, tagOverlap, answerOverlap, exactQuestionBonus, phraseBonus, querySize: querySet.size };
    })
    .filter((result) => {
      const strongQuestionMatch = result.questionOverlap >= Math.min(3, Math.max(1, Math.ceil(result.querySize * 0.35)));
      const exactIntentMatch = result.exactQuestionBonus > 0 || result.phraseBonus >= 4;
      const scoreMatch = result.score >= Math.max(MIN_CONFIDENCE_SCORE, STRONG_MATCH_SCORE);
      const coverageMatch = result.coverage >= Math.max(MIN_TOKEN_COVERAGE, STRONG_MATCH_COVERAGE);
      const topicalMatch = result.questionOverlap >= 2 && result.tagOverlap >= 1 && result.coverage >= 0.5;
      return exactIntentMatch || (strongQuestionMatch && scoreMatch && coverageMatch) || topicalMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function answerQuestion(question) {
  const hits = searchKnowledge(question);
  const primaryHit = hits[0];
  const isReliable = primaryHit && (
    primaryHit.exactQuestionBonus > 0 ||
    primaryHit.phraseBonus >= 4 ||
    (primaryHit.score >= STRONG_MATCH_SCORE && primaryHit.coverage >= STRONG_MATCH_COVERAGE && primaryHit.questionOverlap >= 2)
  );
  if (!hits.length || !isReliable) {
    return {
      answer: state.answerSettings.sendToTeacherReviewIfNoSource
        ? "I could not verify this from the uploaded course materials yet. Your question has been sent to teacher review so the teaching team can add or confirm an official answer."
        : "I could not verify this from the uploaded course materials yet.",
      sources: [],
      confidence: "low",
      unanswered: true,
    };
  }
  const primary = primaryHit.item;
  const sources = state.answerSettings.showSourceAfterAnswer ? hits.slice(0, 3).map(({ item }) => item) : [];
  return {
    answer: primary.answer,
    sources,
    confidence: primaryHit.score >= 5 || primaryHit.coverage >= 0.58 ? "high" : "medium",
    unanswered: false,
  };
}

async function askQuestion(question) {
  if (state.backendReady) {
    return apiRequest("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  }
  return answerQuestion(question);
}

function createChatSession(render = true) {
  const session = {
    id: uid("session"),
    title: "Course Question Desk",
    updatedAt: "Just now",
    messages: [
      {
        id: uid("message"),
        role: "assistant",
        content: "Welcome. Ask about CPT208 coursework, poster requirements, portfolio, video demo, attendance, or module contacts.",
        sources: [],
      },
    ],
  };
  state.chatSessions.unshift(session);
  state.activeSessionId = session.id;
  persistChatSessions();
  if (render) renderStudent();
}

function activeSession() {
  return state.chatSessions.find((session) => session.id === state.activeSessionId) || state.chatSessions[0];
}

function addMessageToActive(role, content, sources = []) {
  const session = activeSession();
  session.messages.push({ id: uid("message"), role, content, sources });
  session.updatedAt = "Just now";
  if (role === "user") session.title = content.slice(0, 44);
  persistChatSessions();
}

function setTeacherPage(page) {
  const allowed = new Set(["overview", "review-queue", "question-cards", "materials", "official-answers", "latest-updates", "settings"]);
  state.teacherPage = allowed.has(page) ? page : "overview";
  document.querySelectorAll(".teacher-subnav-button").forEach((button) => button.classList.toggle("active", button.dataset.teacherPage === state.teacherPage));
  document.querySelectorAll(".teacher-page").forEach((section) => section.classList.toggle("active", section.dataset.teacherPageView === state.teacherPage));
}

function setMode(mode) {
  if ((mode === "teacher" || mode === "analytics") && !isTeacher()) {
    openTeacherAuth("login");
    return;
  }
  const nextMode = mode === "teacher" || mode === "analytics" ? mode : "student";
  state.mode = nextMode;
  document.querySelectorAll(".mode-button").forEach((button) => button.classList.toggle("active", button.dataset.mode === nextMode));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${nextMode}-view`));
  if (nextMode === "teacher") setTeacherPage(state.teacherPage || "overview");
  renderAll();
}

function renderAuthState() {
  document.body.classList.toggle("is-authenticated", Boolean(state.session));
  document.querySelectorAll(".teacher-only").forEach((node) => node.classList.toggle("is-hidden", !isTeacher()));
  $("#account-chip").classList.toggle("is-hidden", !state.session);
  $("#logout-button").classList.toggle("is-hidden", !state.session);
  $("#account-chip").textContent = state.session ? `${state.session.name} · ${state.session.role}` : "";
  setMode(isTeacher() ? state.mode : "student");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderStudent() {
  const session = activeSession();
  renderFlipCards();
  renderStudentLatestUpdates();
  $("#active-session-title").textContent = "Ask a new question";
  if ($("#session-list")) {
    $("#session-list").innerHTML = state.chatSessions.map((item) => `
      <button type="button" class="${item.id === state.activeSessionId ? "active" : ""}" data-session="${item.id}">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.updatedAt)}</small>
      </button>
    `).join("");
  }

  $("#chat-log").innerHTML = (session?.messages || []).map((message) => `
    <article class="message ${message.role === "user" ? "user" : "assistant"}">
      <div class="message-role">${message.role === "user" ? "You" : "CPT208 Course Desk"}</div>
      <div class="message-body">${escapeHtml(message.content)}</div>
      ${message.sources?.length ? `<div class="message-sources">${message.sources.map((source) => `<button class="citation" type="button" data-source="${source.id}">${source.id}</button>`).join("")}</div>` : ""}
    </article>
  `).join("");

  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  state.activeSources = (session?.messages || []).flatMap((message) => message.sources || []);
  renderSources();
}

function renderFlipCards() {
  const cards = publishedQuickCards();
  if (state.activeFlipIndex >= cards.length) state.activeFlipIndex = 0;
  const card = cards[state.activeFlipIndex] || cards[0];
  if (!$("#flip-card")) return;
  if (!card) {
    $("#flip-counter").textContent = "0 / 0";
    $("#flip-card").innerHTML = '<div class="empty-state">Question cards are being updated. Please check back soon.</div>';
    $("#flip-strip").innerHTML = "";
    renderOfficialAnswerHub(cards);
    return;
  }
  const selected = state.cardAnswers[card.id] || "";
  const completed = completedCardCount();
  const progress = cards.length ? Math.round((completed / cards.length) * 100) : 0;
  $("#flip-counter").textContent = `${state.activeFlipIndex + 1} / ${cards.length}`;
  $("#card-progress-label").textContent = `${completed} of ${cards.length} completed`;
  $("#card-progress-fill").style.width = `${progress}%`;
  $("#flip-card").classList.toggle("is-revealed", Boolean(selected));
  $("#flip-card").innerHTML = `
    <div class="flip-card-stage">
      <div class="card-tools" aria-hidden="true">
        <span class="tool-icon">
          <svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M16 9.5a4 4 0 0 1 0 5" /></svg>
        </span>
        <span class="tool-icon">
          <svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>
        </span>
      </div>
      ${selected ? `
        <article class="question-card-body card-face answer-face">
          <div class="card-face-label">
            <p class="eyebrow">${escapeHtml(card.category)}</p>
            <span>Official answer</span>
          </div>
          <div class="card-feedback" id="card-feedback" aria-live="polite">
            <strong class="${isCardCorrect(card, selected) ? "correct-text" : "incorrect-text"}">
              ${isCardCorrect(card, selected) ? "Correct" : "Incorrect"}
            </strong>
            <span>Your answer: ${escapeHtml(selected)}</span>
            <span>Official answer: ${escapeHtml(card.answer)}</span>
            <p>${escapeHtml(card.detail)}</p>
          </div>
          <button class="secondary-action change-answer" type="button" data-card-change-answer>Change answer</button>
        </article>
      ` : `
        <article class="question-card-body card-face question-face">
          <div class="card-face-label">
            <p class="eyebrow" id="flip-category">${escapeHtml(card.category)}</p>
            <span>Question</span>
          </div>
          <h3 id="flip-question">${escapeHtml(card.question)}</h3>
          <div class="answer-options" id="card-options" aria-label="Answer options">
            ${card.options.map((option) => {
    const isSelected = selected === option;
    const isCorrect = selected && isCardCorrect(card, option);
    const className = [
      isSelected ? "selected" : "",
      selected && isCorrect ? "correct" : "",
      selected && isSelected && !isCorrect ? "incorrect" : "",
    ].filter(Boolean).join(" ");
    return `<button type="button" class="${className}" data-card-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
  }).join("")}
          </div>
          <span class="muted-text">Choose Yes or No. The card will flip to the official answer.</span>
        </article>
      `}
    </div>
  `;
  $("#flip-strip").innerHTML = cards.map((item, index) => `
    <button type="button" class="${index === state.activeFlipIndex ? "active" : ""} ${state.cardAnswers[item.id] ? "done" : ""}" data-flip-index="${index}" aria-label="Go to card ${index + 1}: ${escapeHtml(item.category)}">
      <span>${escapeHtml(index + 1)}</span>
    </button>
  `).join("");
  renderOfficialAnswerHub(cards);
}

function showFlipCard(index) {
  const cards = publishedQuickCards();
  if (!cards.length) return;
  state.activeFlipIndex = (index + cards.length) % cards.length;
  renderFlipCards();
}

function chooseCardAnswer(answer) {
  const cards = publishedQuickCards();
  const card = cards[state.activeFlipIndex];
  if (!card) return;
  state.cardAnswers = { ...state.cardAnswers, [card.id]: answer };
  renderFlipCards();
}

function clearCardAnswer() {
  const cards = publishedQuickCards();
  const card = cards[state.activeFlipIndex];
  if (!card) return;
  const nextAnswers = { ...state.cardAnswers };
  delete nextAnswers[card.id];
  state.cardAnswers = nextAnswers;
  renderFlipCards();
}

function resetQuestionCards() {
  state.cardAnswers = {};
  state.activeFlipIndex = 0;
  renderFlipCards();
}

function exportOfficialAnswerHubPdf() {
  const cards = publishedQuickCards();
  if (!allCardsCompleted()) return;
  const generatedAt = new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const pdfBlob = buildOfficialAnswersPdf(cards, generatedAt);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "CPT208_Official_Answer_Hub.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfText(value) {
  return String(value || "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "-")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfLine(text, max = 88) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function buildOfficialAnswersPdf(cards, generatedAt) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 62;
  const bottom = 68;
  const contentWidth = pageWidth - margin * 2;
  const pages = [];
  let commands = [];
  let y = pageHeight - margin;

  const startNewPage = () => {
    pages.push(commands);
    commands = [];
    y = pageHeight - margin;
  };
  const ensureSpace = (height = 42) => {
    if (y - height < bottom) {
      startNewPage();
    }
  };
  const addLine = (text, size = 11, bold = false, color = "0 0 0", lineHeight = 17) => {
    ensureSpace(lineHeight);
    const font = bold ? "F2" : "F1";
    commands.push(`BT /${font} ${size} Tf ${color} rg ${margin} ${y} Td (${pdfText(text)}) Tj ET`);
    y -= lineHeight;
  };
  const addGap = (height = 10) => {
    y -= height;
    if (y < bottom) {
      pages.push(commands);
      commands = [];
      y = pageHeight - margin;
    }
  };
  const addDivider = () => {
    ensureSpace(10);
    commands.push(`0.82 0.86 0.81 RG 0.6 w ${margin} ${y} m ${margin + contentWidth} ${y} l S`);
    y -= 16;
  };

  addLine("CPT208 Human-Centric Computing", 10, true, "0.24 0.34 0.27", 28);
  addLine("Official Answer Hub", 24, true, "0 0 0", 34);
  addGap(2);
  addLine(`Generated from completed classroom question cards - ${generatedAt}`, 10, false, "0.42 0.47 0.43", 20);
  addGap(22);

  cards.forEach((card, index) => {
    ensureSpace(128);
    addLine(`${index + 1}. ${card.category}`, 10, true, "0.24 0.34 0.27", 19);
    wrapPdfLine(card.question, 68).forEach((line, lineIndex) => {
      addLine(line, 13, lineIndex === 0, "0 0 0", 18);
    });
    addGap(3);
    addLine(`Official answer: ${card.answer}`, 11, true, "0.24 0.34 0.27", 18);
    wrapPdfLine(card.detail, 82).forEach((line) => addLine(line, 10, false, "0.25 0.31 0.27", 16));
    addGap(9);
    if (index < cards.length - 1) {
      addDivider();
      addGap(2);
    }
  });
  pages.push(commands);

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];
  pages.forEach((pageCommands) => {
    const stream = pageCommands.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function renderOfficialAnswerHub(cards = publishedQuickCards()) {
  if (!$("#official-answer-hub")) return;
  const unlocked = allCardsCompleted();
  $("#official-answer-hub").classList.toggle("is-locked", !unlocked);
  $("#export-answer-hub").disabled = !unlocked;
  $("#answer-hub-note").textContent = unlocked
    ? "All question cards are complete. Review the official answers and explanations below."
    : "Complete all question cards to review the official answers and explanations.";
  $("#answer-hub-list").innerHTML = unlocked
    ? cards.map((card, index) => `
      <article class="answer-hub-item">
        <small>${index + 1}. ${escapeHtml(card.category)}</small>
        <h4>${escapeHtml(card.question)}</h4>
        <strong>${escapeHtml(card.answer)}</strong>
        <p>${escapeHtml(card.detail)}</p>
      </article>
    `).join("")
    : '<div class="empty-state">The official answer list is locked until all cards are completed.</div>';
}

function renderStudentLatestUpdates() {
  if (!$("#latest-update-list")) return;
  const updates = state.latestUpdates.map(normalizeLatestUpdate).filter((update) => update.visibleToStudents && update.question && update.answer);
  $("#latest-update-list").innerHTML = updates.length
    ? updates.map((update) => `
      <article class="latest-update-item">
        <small>${escapeHtml(update.published_at || "Published by teacher")} · ${escapeHtml(update.source)}</small>
        <h4>${escapeHtml(update.question)}</h4>
        <p>${escapeHtml(update.answer)}</p>
        ${update.explanation ? `<span>${escapeHtml(update.explanation)}</span>` : ""}
      </article>
    `).join("")
    : '<div class="empty-state">No teacher-published updates yet. New official answers will appear here after teacher review.</div>';
}

function renderSources(activeId = "") {
  const unique = new Map();
  state.activeSources.forEach((source) => unique.set(source.id, source));
  const sources = [...unique.values()];
  $("#source-list").innerHTML = sources.length
    ? sources.map((source) => `
      <article class="source-card ${source.id === activeId ? "open" : ""}">
        <button type="button" data-source-card="${source.id}">
          <strong>${escapeHtml(source.question)}</strong>
          <small>${escapeHtml(source.id)} · ${escapeHtml(source.source_document || source.source)}</small>
        </button>
        <div class="source-detail">${escapeHtml(source.answer)}</div>
      </article>
    `).join("")
    : '<div class="empty-state">Citation sources will appear after an answer is retrieved.</div>';
}

function recordInquiry(question, response) {
  const now = new Date().toISOString();
  const log = normalizeInquiryLog({
    id: uid("log"),
    question,
    draftAnswer: response.answer.slice(0, 220),
    answer_preview: response.answer.slice(0, 220),
    matched: response.sources.length > 0,
    confidence: response.confidence,
    unanswered: response.unanswered || response.confidence === "low" || response.sources.length === 0,
    reviewed: false,
    source_ids: response.sources.map((source) => source.id),
    source_documents: [...new Set(response.sources.map((source) => source.source_document || source.source).filter(Boolean))],
    source: [...new Set(response.sources.map((source) => source.source_document || source.source).filter(Boolean))].join("; "),
    teacherDecision: "pending",
    review_status: "pending",
    status: "pending",
    asked_at: now,
    createdAt: now,
    updatedAt: now,
  });
  state.inquiryLogs.unshift(log);
  state.inquiryLogs = state.inquiryLogs.slice(0, 500);
  persistInquiryLogs();
  if (state.backendReady) {
    apiRequest("/api/inquiries", {
      method: "POST",
      body: JSON.stringify({ log }),
    }).catch((error) => console.warn(error.message));
  }
}

async function submitQuestion(questionText) {
  const question = questionText.trim();
  if (!question) return;
  addMessageToActive("user", question);
  $("#question-input").value = "";
  renderAll();
  try {
    const response = await askQuestion(question);
    addMessageToActive("assistant", response.answer, response.sources || []);
    recordInquiry(question, response);
  } catch (error) {
    const response = {
      answer: "The QA service is temporarily unavailable. Your question has not been answered yet, so please try again or contact the teaching team.",
      sources: [],
      confidence: "low",
      unanswered: true,
    };
    addMessageToActive("assistant", response.answer, []);
    recordInquiry(question, response);
  }
  renderAll();
}

function categoryCounts() {
  const counts = {};
  state.items.forEach((item) => (item.tags || []).slice(0, 2).forEach((tag) => {
    counts[tag] = (counts[tag] || 0) + 1;
  }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
}

function questionCounts() {
  const counts = {};
  state.inquiryLogs.forEach((log) => {
    counts[log.question] = (counts[log.question] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
}

function topicCounts() {
  const topics = ["poster", "video", "portfolio", "submission", "ai", "backend", "attendance"];
  const rows = topics.map((topic) => ({
    label: topic,
    value: state.inquiryLogs.filter((log) => log.question.toLowerCase().includes(topic)).length,
  })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  return rows;
}

function renderRankList(selector, rows) {
  $(selector).innerHTML = rows.length ? rows.map((row, index) => `
    <div class="rank-item">
      <span>${index + 1}</span>
      <strong>${escapeHtml(row.label)}</strong>
      <small>${row.value}</small>
    </div>
  `).join("") : '<div class="empty-state">No data yet.</div>';
}

function renderBars(selector, rows) {
  if (!rows.length) {
    $(selector).innerHTML = '<div class="empty-state">No data yet.</div>';
    return;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  $(selector).innerHTML = rows.map((row) => `
    <div class="bar-row">
      <span>${escapeHtml(row.label)}</span>
      <div><i style="width:${(row.value / max) * 100}%"></i></div>
      <strong>${row.value}</strong>
    </div>
  `).join("");
}

function renderTrend() {
  const dateCounts = {};
  state.inquiryLogs.forEach((log) => {
    const key = new Date(log.asked_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    dateCounts[key] = (dateCounts[key] || 0) + 1;
  });
  const rows = Object.entries(dateCounts).slice(-7).map(([label, value]) => ({ label, value }));
  if (!rows.length) {
    $("#usage-trend").innerHTML = '<div class="empty-state">No usage data yet.</div>';
    return;
  }
  const max = Math.max(...rows.map((row) => row.value));
  $("#usage-trend").innerHTML = rows.map((row) => `
    <div class="trend-bar">
      <i style="height:${(row.value / max) * 100}%"></i>
      <span>${row.label}</span>
    </div>
  `).join("");
}

function renderMetrics() {
  const unanswered = state.inquiryLogs.filter((log) => log.unanswered && log.review_status !== "approved_response");
  const reviewQueue = state.inquiryLogs.filter((log) => requiresTeacherAction(log));
  $("#metric-total-questions").textContent = state.questionCards.length;
  $("#metric-unanswered").textContent = reviewQueue.length;
  $("#metric-approved").textContent = state.items.filter((item) => item.status === "approved").length;
  $("#metric-draft").textContent = state.latestUpdates.length;
  $("#analytics-total").textContent = state.inquiryLogs.length;
  $("#analytics-review").textContent = reviewQueue.length;
  const high = state.inquiryLogs.filter((log) => log.confidence === "high").length;
  $("#analytics-accuracy").textContent = state.inquiryLogs.length ? `${Math.round((high / state.inquiryLogs.length) * 100)}%` : "No data";
  $("#analytics-users").textContent = state.backendReady ? state.userCount : "Open access";

  renderRankList("#teacher-frequency-list", questionCounts());
  renderBars("#teacher-category-bars", categoryCounts());
  renderBars("#hot-topic-bars", topicCounts());
  renderRankList("#top-question-list", questionCounts());
  renderBars("#accuracy-bars", [
    { label: "High confidence", value: state.inquiryLogs.filter((log) => log.confidence === "high").length },
    { label: "Needs review", value: state.inquiryLogs.filter((log) => log.confidence === "medium").length },
    { label: "Unanswered", value: unanswered.length },
  ].filter((row) => row.value > 0));
  renderTrend();
}

function renderIntegrationStatus() {
  if (!$("#integration-database")) return;
  const integrations = state.integrations || {};
  $("#integration-database").textContent = state.answerSettings.onlyAnswerFromUploadedMaterials ? "uploaded-materials-only" : (integrations.database_mode || "local-json");
  $("#integration-retrieval").textContent = integrations.retrieval_mode || "local-json";
  $("#integration-answer").textContent = "Source-based";
  $("#integration-note").textContent = "Student answers follow your source rules and teacher review settings shown below.";
}

function renderUploadedMaterials() {
  if (!$("#uploaded-materials-list")) return;
  const rows = state.materials || [];
  $("#uploaded-materials-list").innerHTML = rows.length
    ? rows.map((row) => `
      <article class="activity-item">
        <span class="status ${row.kind === "extracted-text" ? "draft" : "approved"}">${escapeHtml(row.kind === "extracted-text" ? "Extracted Text" : "Material")}</span>
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <small>${escapeHtml(row.summary || "Saved in Materials and ready for teacher review workflow.")}</small>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state compact">No uploaded materials yet.</div>';
}

function renderAnswerSettings() {
  if (!$("#setting-only-materials")) return;
  const settings = normalizeAnswerSettings(state.answerSettings);
  $("#setting-only-materials").checked = settings.onlyAnswerFromUploadedMaterials;
  $("#setting-show-source").checked = settings.showSourceAfterAnswer;
  $("#setting-send-review").checked = settings.sendToTeacherReviewIfNoSource;
}

async function saveAnswerSettings() {
  const nextSettings = normalizeAnswerSettings({
    onlyAnswerFromUploadedMaterials: $("#setting-only-materials").checked,
    showSourceAfterAnswer: $("#setting-show-source").checked,
    sendToTeacherReviewIfNoSource: $("#setting-send-review").checked,
  });
  state.answerSettings = nextSettings;
  if (!state.backendReady) {
    renderAnswerSettings();
    return;
  }
  const data = await apiRequest("/api/answer-settings", {
    method: "PUT",
    body: JSON.stringify(nextSettings),
  });
  state.answerSettings = normalizeAnswerSettings(data.answerSettings || nextSettings);
  renderAnswerSettings();
}

function deriveConfidenceForOldLogs() {
  state.inquiryLogs = state.inquiryLogs.map((log) => normalizeInquiryLog({
    ...log,
    confidence: log.confidence || "unknown",
    reviewed: Boolean(log.reviewed),
    unanswered: typeof log.unanswered === "boolean" ? log.unanswered : !log.matched,
    review_status: log.review_status || log.teacherDecision || "pending",
    teacherDecision: log.teacherDecision || log.review_status || "pending",
    status: log.status || "pending",
  }));
  persistInquiryLogs();
}

function inquiryConfidenceLabel(log) {
  if (log.unanswered) return "No verified answer found";
  if (log.confidence === "high") return "High-confidence match";
  if (log.confidence === "medium") return "Needs teacher review";
  return "Confidence not scored";
}

function inquiryDecisionLabel(log) {
  if (log.review_status === "approved_response") return "Teacher decision: Approved response";
  if (log.review_status === "needs_kb_update") return "Teacher decision: Needs KB update";
  if (log.review_status === "teacher_follow_up") return "Teacher decision: Teacher follow-up required";
  return "Teacher decision: Pending decision";
}

function inquirySeenLabel(log) {
  return log.reviewed ? "Seen status: Seen by teacher" : "Seen status: Not seen yet";
}

function requiresTeacherAction(log) {
  return log.status !== "deleted" && log.status !== "published" && log.status !== "converted_to_card";
}

function syncReviewButtonLabel() {
  const button = $("#clear-logs");
  if (!button) return;
  const hasPending = state.inquiryLogs.some((log) => !log.reviewed);
  button.textContent = hasPending ? "Mark All as Seen" : "Undo Seen Status";
}

function syncInquiryViewButton() {
  const button = $("#toggle-inquiry-view");
  if (!button) return;
  button.textContent = state.showResolvedInquiries ? "Show Active Only" : "Show Resolved";
}

function syncQuestionCardGroupOptions(selectedGroupId = "") {
  const select = $("#card-group");
  if (!select) return;
  const options = ['<option value="">No group yet</option>']
    .concat((state.questionCardGroups || []).map((group) => `<option value="${group.id}">${escapeHtml(group.name)}${group.pinned ? " (Pinned)" : ""}</option>`));
  select.innerHTML = options.join("");
  select.value = selectedGroupId || "";
}

function pinnedQuestionCardGroup() {
  return (state.questionCardGroups || []).find((group) => group.pinned) || null;
}

function cardsForGroup(groupId) {
  return (state.questionCards || []).filter((card) => card.groupId === groupId);
}

function openCardEditor(card = null) {
  const editor = $("#question-card-editor");
  editor.classList.remove("is-hidden");
  $("#card-id").value = card?.id || "";
  $("#card-question").value = card?.question || "";
  $("#card-correct-answer").value = card?.correctAnswer || "Yes";
  $("#card-explanation").value = card?.explanation || "";
  $("#card-source").value = card?.source || "";
  $("#card-status").value = card?.status || "draft";
  syncQuestionCardGroupOptions(card?.groupId || "");
  $("#card-question").focus();
}

function closeCardEditor() {
  $("#question-card-editor").classList.add("is-hidden");
  $("#card-id").value = "";
  $("#card-question").value = "";
  $("#card-correct-answer").value = "Yes";
  $("#card-explanation").value = "";
  $("#card-source").value = "";
  $("#card-status").value = "draft";
  syncQuestionCardGroupOptions("");
}

function saveQuestionCardGroups() {
  persistQuestionCardGroups();
  renderQuestionCards();
}

function createQuestionCardGroup(name, description = "") {
  if (!name.trim()) return;
  state.questionCardGroups = [normalizeQuestionCardGroup({ name, description, pinned: !state.questionCardGroups.length }), ...state.questionCardGroups];
  saveQuestionCardGroups();
}

function pinQuestionCardGroup(groupId) {
  state.questionCardGroups = state.questionCardGroups.map((group) => normalizeQuestionCardGroup({ ...group, pinned: group.id === groupId, updatedAt: new Date().toISOString() }));
  saveQuestionCardGroups();
}

function deleteQuestionCardGroup(groupId) {
  state.questionCards = state.questionCards.map((card) => card.groupId === groupId ? normalizeQuestionCard({ ...card, groupId: "", updatedAt: new Date().toISOString() }) : card);
  const remaining = state.questionCardGroups.filter((group) => group.id !== groupId);
  if (remaining.length && !remaining.some((group) => group.pinned)) remaining[0].pinned = true;
  state.questionCardGroups = remaining.map(normalizeQuestionCardGroup);
  saveQuestionCardGroups();
}

function mergeQuestionCardGroupState(cards = []) {
  return cards.map((card) => {
    const localCard = state.questionCards.find((item) => item.id === card.id);
    return normalizeQuestionCard({ ...card, groupId: card.groupId || localCard?.groupId || "" });
  });
}

async function saveQuestionCard(card) {
  if (!state.backendReady) {
    state.questionCards = state.questionCards.some((item) => item.id === card.id)
      ? state.questionCards.map((item) => item.id === card.id ? card : item)
      : [card, ...state.questionCards];
    renderQuestionCards();
    return;
  }
  const isExisting = state.questionCards.some((item) => item.id === card.id);
  const data = await apiRequest(isExisting ? `/api/question-cards/${card.id}` : "/api/question-cards", {
    method: isExisting ? "PUT" : "POST",
    body: JSON.stringify(card),
  });
  state.questionCards = mergeQuestionCardGroupState(data.questionCards || []).map((item) => item.id === card.id ? normalizeQuestionCard({ ...item, groupId: card.groupId }) : item);
  renderQuestionCards();
}

async function deleteQuestionCard(cardId) {
  if (!state.backendReady) {
    state.questionCards = state.questionCards.filter((card) => card.id !== cardId);
    renderQuestionCards();
    return;
  }
  const data = await apiRequest(`/api/question-cards/${cardId}`, { method: "DELETE" });
  state.questionCards = mergeQuestionCardGroupState(data.questionCards || []).filter((card) => card.id !== cardId);
  renderQuestionCards();
}

async function setQuestionCardStatus(cardId, status) {
  if (!state.backendReady) {
    state.questionCards = state.questionCards.map((card) => card.id === cardId ? normalizeQuestionCard({ ...card, status, updatedAt: new Date().toISOString() }) : card);
    renderQuestionCards();
    return;
  }
  const currentCard = state.questionCards.find((card) => card.id === cardId);
  const data = await apiRequest(`/api/question-cards/${cardId}/${status === "published" ? "publish" : "unpublish"}`, { method: "POST", body: JSON.stringify({}) });
  state.questionCards = mergeQuestionCardGroupState(data.questionCards || []).map((card) => card.id === cardId ? normalizeQuestionCard({ ...card, groupId: currentCard?.groupId || card.groupId || "" }) : card);
  renderQuestionCards();
}

async function convertInquiryToCard(log) {
  const source = log.source_documents?.[0] || "Student inquiry";
  if (!state.backendReady) {
    const card = normalizeQuestionCard({
      question: log.question,
      correctAnswer: "Yes",
      explanation: log.draftAnswer || log.answer_preview || "Converted from a student question. Add the official explanation before publishing.",
      source,
      groupId: pinnedQuestionCardGroup()?.id || "",
      status: "draft",
    });
    state.questionCards = [card, ...state.questionCards];
    updateInquiryDecision(log.id, "converted_to_card", { status: "converted_to_card" });
    renderQuestionCards();
    return;
  }
  const data = await apiRequest(`/api/inquiries/${log.id}/convert-to-card`, {
    method: "POST",
    body: JSON.stringify({ correctAnswer: "Yes", explanation: log.answer_preview || "", source }),
  });
  state.questionCards = mergeQuestionCardGroupState(data.questionCards || []).map((card) => normalizeQuestionCard({ ...card, groupId: card.groupId || pinnedQuestionCardGroup()?.id || "" }));
  state.inquiryLogs = data.inquiry_logs || state.inquiryLogs;
  renderAll();
}

function renderQuestionCards() {
  if (!$("#question-card-list")) return;
  syncQuestionCardGroupOptions($("#card-group")?.value || "");
  const groups = state.questionCardGroups || [];
  const ungroupedCards = (state.questionCards || []).filter((card) => !card.groupId);
  const groupMarkup = groups.map((group) => {
    const cards = cardsForGroup(group.id);
    return `
      <section class="question-card-group">
        <header class="inquiry-header">
          <div>
            <h4>${escapeHtml(group.name)} ${group.pinned ? '<span class="status approved">Pinned</span>' : ''}</h4>
            <small>${escapeHtml(group.description || "No group description yet.")} · ${cards.length} card${cards.length === 1 ? "" : "s"}</small>
          </div>
          <div class="item-actions card-actions">
            ${group.pinned ? "" : `<button type="button" data-group-action="pin" data-group-id="${group.id}">Pin Group</button>`}
            <button type="button" class="danger-action" data-group-action="delete" data-group-id="${group.id}">Delete Group</button>
          </div>
        </header>
        <div class="question-card-list">
          ${cards.length ? cards.map((card) => `
            <article class="question-card-item">
              <div>
                <h4>${escapeHtml(card.question)}</h4>
                <dl class="card-fields">
                  <div><dt>Correct Answer</dt><dd>${escapeHtml(card.correctAnswer)}</dd></div>
                  <div><dt>Explanation</dt><dd>${escapeHtml(card.explanation || "No explanation yet")}</dd></div>
                  <div><dt>Source</dt><dd>${escapeHtml(card.source || "No source file")}</dd></div>
                  <div><dt>Status</dt><dd><span class="status ${card.status === "published" ? "approved" : "draft"}">${escapeHtml(card.status)}</span></dd></div>
                </dl>
              </div>
              <div class="item-actions card-actions">
                <button type="button" data-card-action="edit" data-card-id="${card.id}">Edit</button>
                <button type="button" class="danger-action" data-card-action="delete" data-card-id="${card.id}">Delete</button>
                ${card.status === "published"
                  ? `<button type="button" data-card-action="unpublish" data-card-id="${card.id}">Unpublish</button>`
                  : `<button type="button" data-card-action="publish" data-card-id="${card.id}">Publish</button>`}
              </div>
            </article>
          `).join("") : '<div class="empty-state">No cards in this group yet.</div>'}
        </div>
      </section>`;
  }).join("");

  const ungroupedMarkup = ungroupedCards.length ? `
    <section class="question-card-group">
      <header class="inquiry-header"><div><h4>Ungrouped Cards</h4><small>Cards waiting to be assigned to a week, topic, or classroom activity.</small></div></header>
      <div class="question-card-list">
        ${ungroupedCards.map((card) => `
          <article class="question-card-item">
            <div>
              <h4>${escapeHtml(card.question)}</h4>
              <dl class="card-fields">
                <div><dt>Correct Answer</dt><dd>${escapeHtml(card.correctAnswer)}</dd></div>
                <div><dt>Explanation</dt><dd>${escapeHtml(card.explanation || "No explanation yet")}</dd></div>
                <div><dt>Source</dt><dd>${escapeHtml(card.source || "No source file")}</dd></div>
                <div><dt>Status</dt><dd><span class="status ${card.status === "published" ? "approved" : "draft"}">${escapeHtml(card.status)}</span></dd></div>
              </dl>
            </div>
            <div class="item-actions card-actions">
              <button type="button" data-card-action="edit" data-card-id="${card.id}">Edit</button>
              <button type="button" class="danger-action" data-card-action="delete" data-card-id="${card.id}">Delete</button>
              ${card.status === "published"
                ? `<button type="button" data-card-action="unpublish" data-card-id="${card.id}">Unpublish</button>`
                : `<button type="button" data-card-action="publish" data-card-id="${card.id}">Publish</button>`}
            </div>
          </article>
        `).join("")}
      </div>
    </section>` : "";

  $("#question-card-list").innerHTML = `
    <section class="question-card-group">
      <header class="inquiry-header">
        <div><h4>Card Groups</h4><small>Create weekly, topical, or classroom activity groups and pin one for students.</small></div>
      </header>
      <form id="question-card-group-form" class="question-card-editor">
        <label>Group Name<input id="card-group-name" placeholder="Week 7 Poster & Video Demo" required /></label>
        <label>Description<textarea id="card-group-description" rows="2" placeholder="Optional lesson focus, topic, or classroom activity notes"></textarea></label>
        <div class="editor-actions"><button type="submit">Create Group</button></div>
      </form>
    </section>
    ${groupMarkup || ""}
    ${ungroupedMarkup || (!groups.length ? '<div class="empty-state">No question cards yet. Create one manually or convert a student question.</div>' : "")}
  `;
}

function renderTeacherLatestUpdates() {
  if (!$("#latest-updates-list")) return;
  const updates = state.latestUpdates || [];
  $("#latest-updates-list").innerHTML = updates.length ? updates.map((update) => `
    <article class="question-card-item">
      <div>
        <h4>Title / Question: ${escapeHtml(update.question)}</h4>
        <dl class="card-fields">
          <div><dt>Answer</dt><dd>${escapeHtml(update.answer || "No answer yet")}</dd></div>
          <div><dt>Source</dt><dd>${escapeHtml(update.source || "No source")}</dd></div>
          <div><dt>Published time</dt><dd>${escapeHtml(new Date(update.publishedAt).toLocaleString())}</dd></div>
          <div><dt>Visible to students</dt><dd>${update.visibleToStudents ? "Yes" : "No"}</dd></div>
        </dl>
      </div>
      <div class="item-actions card-actions">
        <button type="button" data-update-action="edit" data-update-id="${update.id}">Edit</button>
        <button type="button" data-update-action="hide" data-update-id="${update.id}">${update.visibleToStudents ? "Hide" : "Show"}</button>
        <button type="button" class="danger-action" data-update-action="delete" data-update-id="${update.id}">Delete</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No latest updates have been published yet.</div>';
}

async function saveLatestUpdate(update) {
  if (!state.backendReady) {
    state.latestUpdates = state.latestUpdates.some((item) => item.id === update.id)
      ? state.latestUpdates.map((item) => item.id === update.id ? update : item)
      : [update, ...state.latestUpdates];
    renderTeacherLatestUpdates();
    return;
  }
  const isExisting = state.latestUpdates.some((item) => item.id === update.id);
  const data = await apiRequest(isExisting ? `/api/latest-updates/${update.id}` : "/api/latest-updates", {
    method: isExisting ? "PUT" : "POST",
    body: JSON.stringify(update),
  });
  state.latestUpdates = (data.latestUpdates || []).map(normalizeLatestUpdate);
  renderTeacherLatestUpdates();
}

async function toggleLatestUpdateVisibility(updateId, visibleToStudents) {
  if (!state.backendReady) {
    state.latestUpdates = state.latestUpdates.map((update) => update.id === updateId ? normalizeLatestUpdate({ ...update, visibleToStudents }) : update);
    renderTeacherLatestUpdates();
    return;
  }
  const data = await apiRequest(`/api/latest-updates/${updateId}/${visibleToStudents ? "show" : "hide"}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  state.latestUpdates = (data.latestUpdates || []).map(normalizeLatestUpdate);
  renderTeacherLatestUpdates();
}

async function deleteLatestUpdate(updateId) {
  if (!state.backendReady) {
    state.latestUpdates = state.latestUpdates.filter((update) => update.id !== updateId);
    renderTeacherLatestUpdates();
    return;
  }
  const data = await apiRequest(`/api/latest-updates/${updateId}`, { method: "DELETE" });
  state.latestUpdates = (data.latestUpdates || []).map(normalizeLatestUpdate);
  renderTeacherLatestUpdates();
}

function renderTeacherList() {
  const query = $("#teacher-search").value.toLowerCase();
  const status = $("#status-filter").value;
  const items = state.items.filter((item) => {
    const matchesStatus = status === "all" || item.status === status;
    const blob = `${item.id} ${item.question} ${item.answer} ${(item.tags || []).join(" ")} ${item.source_document}`.toLowerCase();
    return matchesStatus && blob.includes(query);
  });
  $("#qa-list").innerHTML = items.map((item) => `
    <article class="qa-item">
      <header>
        <div>
          <h4>${escapeHtml(item.question)}</h4>
          <span class="status ${item.status}">${item.status}</span>
        </div>
        <div class="item-actions">
          <button type="button" data-edit="${item.id}">Edit</button>
          <button type="button" data-archive="${item.id}">Archive</button>
          <button type="button" data-convert-card="${item.id}">Convert to Card</button>
        </div>
      </header>
      <p>${escapeHtml(item.answer)}</p>
      <small>${escapeHtml(item.id)} · ${escapeHtml(item.source_document || item.source)} · ${(item.tags || []).map(escapeHtml).join(", ")}</small>
    </article>
  `).join("");
}

async function convertOfficialAnswerToCard(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  const card = normalizeQuestionCard({
    question: item.question,
    correctAnswer: "Yes",
    explanation: item.answer,
    source: item.source_document || item.source || "Official answer",
    groupId: pinnedQuestionCardGroup()?.id || "",
    status: "draft",
  });
  await saveQuestionCard(card);
  setTeacherPage("question-cards");
}

function actionLabel(action) {
  const labels = {
    created: "Created",
    updated: "Updated",
    approved: "Approved",
    archived: "Archived",
    removed: "Removed",
  };
  return labels[action] || "Changed";
}

function renderKnowledgeActivity() {
  if (!$("#qa-history-list")) return;
  const rows = (state.qaHistory || []).slice(0, 8);
  $("#qa-history-list").innerHTML = rows.length
    ? rows.map((entry) => `
      <article class="activity-item">
        <span class="status">${escapeHtml(actionLabel(entry.action))}</span>
        <div>
          <strong>${escapeHtml(entry.question || entry.qa_id)}</strong>
          <small>${escapeHtml(entry.actor_name || "Teacher")} · ${escapeHtml(new Date(entry.changed_at).toLocaleString())}</small>
          ${entry.previous_status !== entry.next_status ? `<p>${escapeHtml(entry.previous_status || "none")} -> ${escapeHtml(entry.next_status || "none")}</p>` : ""}
        </div>
      </article>
    `).join("")
    : '<div class="empty-state compact">No knowledge changes recorded yet.</div>';
}

function renderInquiryLogs() {
  if (!$("#inquiry-list")) return;
  const reviewQueue = state.inquiryLogs.filter((log) => requiresTeacherAction(log));
  const visibleLogs = state.showResolvedInquiries
    ? state.inquiryLogs
    : reviewQueue;
  const html = visibleLogs.length
    ? visibleLogs.map((log) => `
      <article class="inquiry-item">
        <div>
          <h4>Student Question: ${escapeHtml(log.question)}</h4>
          <p><strong>Draft Answer:</strong> ${escapeHtml(log.draftAnswer || log.answer_preview || "No draft answer yet")}</p>
          <p><strong>Source:</strong> ${escapeHtml(log.source || "No source found")}</p>
          <div class="item-actions inquiry-actions">
            <button type="button" data-inquiry-action="approve-publish" data-log-id="${log.id}">Approve & Publish</button>
            <button type="button" data-inquiry-action="edit-answer" data-log-id="${log.id}">Edit Answer</button>
            <button type="button" data-inquiry-action="publish-update" data-log-id="${log.id}">Publish to Latest Updates</button>
            <button type="button" data-inquiry-action="convert-card" data-log-id="${log.id}">Convert to Card</button>
            <button type="button" class="danger-action" data-inquiry-action="delete" data-log-id="${log.id}">Delete</button>
          </div>
        </div>
        <div class="inquiry-meta">
          <div>System Match: ${escapeHtml(inquiryConfidenceLabel(log))}</div>
          <div>Teacher Decision: ${escapeHtml(log.teacherDecision || log.review_status || "pending")}</div>
          <div>Status: <span class="status ${escapeHtml(log.status || "pending")}">${escapeHtml(log.status || "pending")}</span></div>
        </div>
      </article>
    `).join("")
    : `<div class="empty-state">${state.showResolvedInquiries ? "No student inquiries have been recorded yet." : "No active review items right now."}</div>`;
  $("#inquiry-list").innerHTML = html;
  if ($("#overview-inquiry-list")) {
    $("#overview-inquiry-list").innerHTML = `
      <article class="activity-item overview-action-item">
        <span class="status pending overview-action-index">1</span>
        <div class="overview-action-content">
          <strong>Review student questions</strong>
          <small>${reviewQueue.length ? `${reviewQueue.length} item${reviewQueue.length === 1 ? "" : "s"} waiting for action` : "No pending review items"}</small>
          <button type="button" class="teacher-subnav-link" data-teacher-page-target="review-queue">Open Review Queue</button>
        </div>
      </article>
      <article class="activity-item overview-action-item">
        <span class="status draft overview-action-index">2</span>
        <div class="overview-action-content">
          <strong>Create or edit classroom question cards</strong>
          <small>${state.questionCards.length} card${state.questionCards.length === 1 ? "" : "s"} in the library</small>
          <button type="button" class="teacher-subnav-link" data-teacher-page-target="question-cards">Manage Question Cards</button>
        </div>
      </article>
      <article class="activity-item overview-action-item">
        <span class="status approved overview-action-index">3</span>
        <div class="overview-action-content">
          <strong>Publish new answers for all students</strong>
          <small>${state.latestUpdates.length} update${state.latestUpdates.length === 1 ? "" : "s"} currently published</small>
          <button type="button" class="teacher-subnav-link" data-teacher-page-target="latest-updates">Manage Latest Updates</button>
        </div>
      </article>
    `;
    $("#overview-inquiry-list").querySelectorAll(".teacher-subnav-link").forEach((button) => button.addEventListener("click", () => setTeacherPage(button.dataset.teacherPageTarget)));
  }
  syncReviewButtonLabel();
  syncInquiryViewButton();
}

function buildDraftFromInquiry(log) {
  const sourceItem = log.source_ids?.length ? state.items.find((item) => item.id === log.source_ids[0]) : null;
  return {
    question: log.question,
    answer: log.unanswered ? "" : (sourceItem?.answer || ""),
    status: "draft",
    source: "teacher",
    tags: sourceItem?.tags?.length ? sourceItem.tags : ["needs-teacher-review"],
    source_document: sourceItem?.source_document || "",
  };
}

function linkedQaForInquiry(log) {
  return log.source_ids?.length ? state.items.find((item) => item.id === log.source_ids[0]) || null : null;
}

function inquiryEditorLabel(log) {
  return linkedQaForInquiry(log) ? "Edit QA" : "Create QA";
}

function openInquiryEditor(log) {
  const linkedItem = linkedQaForInquiry(log);
  fillEditor(linkedItem || buildDraftFromInquiry(log));
  setTeacherPage("official-answers");
  state.inquiryLogs = state.inquiryLogs.map((entry) => entry.id === log.id ? normalizeInquiryLog({
    ...entry,
    reviewed: true,
    review_status: "edited_answer",
    teacherDecision: "edited_answer",
    updatedAt: new Date().toISOString(),
  }) : entry);
  persistInquiryLogs();
  renderAll();
  $("#qa-question").focus();
}

function updateInquiryDecision(logId, reviewStatus, extra = {}) {
  state.inquiryLogs = state.inquiryLogs.map((log) => log.id === logId ? normalizeInquiryLog({
    ...log,
    ...extra,
    reviewed: true,
    review_status: reviewStatus,
    teacherDecision: reviewStatus,
    updatedAt: new Date().toISOString(),
  }) : log);
  persistInquiryLogs();
  renderAll();
}

async function publishInquiryToLatestUpdates(log) {
  if (!state.backendReady) {
    state.latestUpdates = [normalizeLatestUpdate({
      question: log.question,
      answer: log.draftAnswer || log.answer_preview || "",
      source: log.source || "",
      publishedAt: new Date().toISOString(),
      visibleToStudents: true,
    }), ...state.latestUpdates];
    updateInquiryDecision(log.id, "published_to_latest_updates", { status: "approved" });
    return;
  }
  const data = await apiRequest(`/api/inquiries/${log.id}/publish-latest-update`, { method: "POST", body: JSON.stringify({}) });
  state.inquiryLogs = (data.inquiry_logs || []).map(normalizeInquiryLog);
  state.latestUpdates = (data.latestUpdates || state.latestUpdates).map(normalizeLatestUpdate);
  renderAll();
}

async function approveAndPublishInquiry(log) {
  if (!state.backendReady) {
    updateInquiryDecision(log.id, "approved_and_published", { status: "published" });
    return;
  }
  const data = await apiRequest(`/api/inquiries/${log.id}/approve-publish`, { method: "POST", body: JSON.stringify({}) });
  state.inquiryLogs = (data.inquiry_logs || []).map(normalizeInquiryLog);
  renderAll();
}

function deleteInquiryLog(logId) {
  state.inquiryLogs = state.inquiryLogs.map((log) => log.id === logId ? normalizeInquiryLog({
    ...log,
    status: "deleted",
    teacherDecision: "deleted",
    review_status: "deleted",
    reviewed: true,
    updatedAt: new Date().toISOString(),
  }) : log);
  persistInquiryLogs();
  renderAll();
}

function fillEditor(item) {
  $("#editor-title").textContent = item ? "Edit Course Answer" : "Add Course Answer";
  $("#qa-id").value = item?.id || "";
  $("#qa-question").value = item?.question || "";
  $("#qa-answer").value = item?.answer || "";
  $("#qa-status").value = item?.status || "approved";
  $("#qa-source").value = item?.source || "teacher";
  $("#qa-tags").value = (item?.tags || []).join(", ");
  $("#qa-doc").value = item?.source_document || "";
}

function nextQaId() {
  const ids = state.items.map((item) => Number(String(item.id).replace(/\D/g, ""))).filter(Number.isFinite);
  return `qa_${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`;
}

function nextQaIdFrom(value) {
  return `qa_${String(value).padStart(3, "0")}`;
}

function extractTextFromPdfBuffer(arrayBuffer) {
  const raw = new TextDecoder("latin1").decode(new Uint8Array(arrayBuffer));
  const fragments = [...raw.matchAll(/\((?:\\.|[^\\()]){3,}\)/g)]
    .map((match) => match[0].slice(1, -1))
    .map((fragment) => fragment
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\"))
    .filter((fragment) => /[A-Za-z]{3,}/.test(fragment));
  return normalizeWhitespace(fragments.join("\n"));
}

function extractQaPairsFromText(text) {
  const lines = normalizeWhitespace(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const pairs = [];
  let currentQuestion = "";
  let currentAnswer = "";
  let mode = "";

  const pushPair = () => {
    if (!currentQuestion || !currentAnswer) return;
    pairs.push({
      question: normalizeWhitespace(currentQuestion),
      answer: normalizeWhitespace(currentAnswer),
    });
    currentQuestion = "";
    currentAnswer = "";
    mode = "";
  };

  lines.forEach((line) => {
    const questionMatch = line.match(/^(?:q(?:uestion)?\s*\d*|question)\s*[:.\-]\s*(.+)$/i);
    const answerMatch = line.match(/^(?:a(?:nswer)?\s*\d*|answer)\s*[:.\-]\s*(.+)$/i);
    if (questionMatch) {
      pushPair();
      currentQuestion = questionMatch[1].trim();
      mode = "question";
      return;
    }
    if (answerMatch) {
      currentAnswer = answerMatch[1].trim();
      mode = "answer";
      return;
    }
    if (/^q\d+\s*[:.\-]/i.test(line)) {
      pushPair();
      currentQuestion = line.replace(/^q\d+\s*[:.\-]\s*/i, "").trim();
      mode = "question";
      return;
    }
    if (/^a\d+\s*[:.\-]/i.test(line)) {
      currentAnswer = line.replace(/^a\d+\s*[:.\-]\s*/i, "").trim();
      mode = "answer";
      return;
    }
    if (mode === "question") {
      currentQuestion = `${currentQuestion} ${line}`.trim();
      return;
    }
    if (mode === "answer") {
      currentAnswer = `${currentAnswer} ${line}`.trim();
    }
  });

  pushPair();
  return pairs.filter((pair) => pair.question && pair.answer);
}

function buildDraftItemsFromPairs(pairs, sourceDocument) {
  const ids = state.items.map((item) => Number(String(item.id).replace(/\D/g, ""))).filter(Number.isFinite);
  let nextId = Math.max(0, ...ids) + 1;
  return pairs.map((pair) => normalizeItem({
    id: nextQaIdFrom(nextId++),
    question: pair.question,
    answer: pair.answer,
    status: "draft",
    source: "teacher-upload",
    source_document: sourceDocument,
    tags: ["imported", "needs-teacher-review"],
    updated_at: new Date().toISOString(),
  }));
}

async function readIngestedSource(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".txt")) {
    return { kind: "text", sourceDocument: file.name, text: normalizeWhitespace(await file.text()) };
  }
  if (lowerName.endsWith(".pdf")) {
    const existingExtracted = findExistingExtractedText(file.name);
    if (existingExtracted) {
      return {
        kind: "text",
        sourceDocument: file.name,
        text: normalizeWhitespace(existingExtracted.text),
        extractedSourceDocument: existingExtracted.sourceDocument,
        linkedExtracted: true,
      };
    }
    const text = extractTextFromPdfBuffer(await file.arrayBuffer());
    if (!text || text.length < 40) {
      return {
        kind: "error",
        message: `${file.name}: This PDF could not be reliably read in the static browser version, and no matching extracted text was found. Please paste extracted text or use a backend OCR/PDF parser.`,
      };
    }
    return { kind: "text", sourceDocument: file.name, text };
  }
  if (file.type.startsWith("image/")) {
    return {
      kind: "error",
      message: `${file.name}: Image OCR is not available in this offline static prototype yet. Please paste OCR text for this image or connect a backend OCR service.`,
    };
  }
  return {
    kind: "error",
    message: `${file.name}: Unsupported file type.`,
  };
}

async function ingestSources() {
  const pastedText = normalizeWhitespace($("#ingest-text")?.value || "");
  const files = state.pendingIngestFiles || [];
  const notes = [];
  const allDrafts = [];
  const savedMaterials = [];

  if (!files.length && !pastedText) {
    $("#ingest-feedback").textContent = "Please upload a PDF/TXT/image file or paste extracted text first.";
    return;
  }

  for (const file of files) {
    const result = await readIngestedSource(file);
    if (result.kind === "error") {
      notes.push(result.message);
      continue;
    }
    savedMaterials.push({
      id: uid("material"),
      name: result.sourceDocument,
      kind: "material-file",
      extractedText: result.text,
      linkedExtractedSource: result.extractedSourceDocument || "",
      summary: result.linkedExtracted
        ? `Original PDF saved and linked to existing extracted text: ${result.extractedSourceDocument}.`
        : "Original material saved. Extracted text is available for draft QA generation and teacher review.",
      createdAt: new Date().toISOString(),
    });
    const pairs = extractQaPairsFromText(result.text);
    if (!pairs.length) {
      notes.push(`${result.sourceDocument}: Material saved${result.linkedExtracted ? ` and linked to ${result.extractedSourceDocument}` : ""}, but no explicit Q/A pairs were detected. Use Question:/Answer: formatting or review the extracted text before publishing.`);
      continue;
    }
    const uniquePairs = pairs.filter((pair) => !isDuplicateOfficialAnswer(pair));
    if (!uniquePairs.length) {
      notes.push(`${result.sourceDocument}: Material saved${result.linkedExtracted ? ` and linked to ${result.extractedSourceDocument}` : ""}. All generated Q/A pairs already exist in Official Answers, so no new drafts were created.`);
      continue;
    }
    const drafts = buildDraftItemsFromPairs(uniquePairs, result.sourceDocument);
    allDrafts.push(...drafts);
    notes.push(`${result.sourceDocument}: saved to Materials${result.linkedExtracted ? ` and linked to ${result.extractedSourceDocument}` : ""}; ${drafts.length} non-duplicate draft QA entr${drafts.length === 1 ? "y" : "ies"} sent to teacher review.`);
  }

  if (pastedText) {
    savedMaterials.push({
      id: uid("material"),
      name: "Pasted extracted text",
      kind: "extracted-text",
      extractedText: pastedText,
      summary: "Extracted text saved. Draft QA can be reviewed before publishing to Official Answers.",
      createdAt: new Date().toISOString(),
    });
    const pairs = extractQaPairsFromText(pastedText);
    if (!pairs.length) {
      notes.push("Pasted text: saved as extracted text, but no explicit Q/A pairs were detected. Use Question:/Answer: formatting for best results.");
    } else {
      const uniquePairs = pairs.filter((pair) => !isDuplicateOfficialAnswer(pair));
      if (!uniquePairs.length) {
        notes.push("Pasted text: saved as extracted text, but all generated Q/A pairs already exist in Official Answers, so no new drafts were created.");
      } else {
        const drafts = buildDraftItemsFromPairs(uniquePairs, "Pasted text");
        allDrafts.push(...drafts);
        notes.push(`Pasted text: saved to extracted text and ${drafts.length} non-duplicate draft QA entr${drafts.length === 1 ? "y" : "ies"} sent to teacher review.`);
      }
    }
  }

  if (savedMaterials.length) {
    state.materials = [...savedMaterials, ...state.materials];
    persistMaterialLibrary();
    renderUploadedMaterials();
  }

  if (allDrafts.length) {
    state.items = [...allDrafts, ...state.items];
    persistKnowledgeBase();
    renderTeacherList();
    renderMetrics();
  }

  $("#ingest-feedback").innerHTML = notes.map(escapeHtml).join("<br>") || "No source processed yet.";
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadInquiryLogs() {
  const headers = ["id", "question", "answer_preview", "matched", "confidence", "review_status", "seen_status", "source_ids", "asked_at"];
  const rows = state.inquiryLogs.map((log) => [
    log.id,
    log.question,
    log.answer_preview,
    log.matched ? "matched" : "unmatched",
    log.confidence,
    log.review_status,
    log.reviewed ? "seen" : "not seen",
    (log.source_ids || []).join("; "),
    log.asked_at,
  ]);
  const csv = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cpt208-student-inquiry-logs.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderStudent();
  renderTeacherList();
  renderQuestionCards();
  renderTeacherLatestUpdates();
  renderUploadedMaterials();
  renderKnowledgeActivity();
  renderInquiryLogs();
  renderMetrics();
  renderIntegrationStatus();
  renderAnswerSettings();
}

function bindEvents() {
  $("#show-login").addEventListener("click", () => showAuthMode("login"));
  $("#show-register").addEventListener("click", () => showAuthMode("register"));
  $("#register-show-login").addEventListener("click", () => showAuthMode("login"));
  $("#register-show-register").addEventListener("click", () => showAuthMode("register"));
  $("#continue-student").addEventListener("click", closeTeacherAuth);
  $("#register-continue-student").addEventListener("click", closeTeacherAuth);
  $("#register-role").addEventListener("change", () => {
    $("#teacher-code-row").classList.toggle("is-hidden", $("#register-role").value !== "teacher");
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = $("#login-username").value.trim();
    const password = $("#login-password").value;
    try {
      if (state.backendReady) {
        const { user, token } = await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        startSessionForUser(normalizeUser(user), token);
        await loadBackendData();
      } else {
        const account = findUser(username);
        if (!account || account.password !== password) {
          $("#login-error").textContent = "Invalid username or password.";
          return;
        }
        startSessionForUser(account);
      }
      renderAll();
      $("#login-error").textContent = "";
    } catch (error) {
      $("#login-error").textContent = error.message;
    }
  });

  $("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#register-name").value.trim();
    const username = $("#register-username").value.trim();
    const password = $("#register-password").value;
    const role = $("#register-role").value;
    const teacherCode = $("#register-teacher-code").value;
    const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;

    if (!usernamePattern.test(username)) {
      $("#register-error").textContent = "Use 3-24 letters, numbers, dots, underscores, or hyphens for username.";
      return;
    }
    if (password.length < 6) {
      $("#register-error").textContent = "Password must be at least 6 characters.";
      return;
    }
    if (findUser(username)) {
      $("#register-error").textContent = "This username is already registered.";
      return;
    }
    if (role === "teacher" && teacherCode !== TEACHER_REGISTRATION_CODE) {
      $("#register-error").textContent = "Teacher access code is incorrect.";
      return;
    }

    try {
      let account;
      if (state.backendReady) {
        const response = await apiRequest("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, username, password, role, teacherCode }),
        });
        account = normalizeUser(response.user);
        account.token = response.token;
      } else {
        account = normalizeUser({
          username,
          password,
          role,
          name,
          source: "registered",
          created_at: new Date().toISOString(),
        });
        state.users.push(account);
        persistUsers();
      }
      if (!state.users.some((user) => user.username.toLowerCase() === account.username.toLowerCase())) {
        state.users.push(account);
        if (!state.backendReady) persistUsers();
      }
      $("#register-error").textContent = "";
      startSessionForUser(account, account.token);
      if (state.backendReady) await loadBackendData();
      renderAll();
    } catch (error) {
      $("#register-error").textContent = error.message;
    }
  });

  $("#logout-button").addEventListener("click", () => {
    if (state.backendReady && state.session?.token) {
      apiRequest("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }).catch(() => {});
    }
    state.session = null;
    state.mode = "student";
    persistSession();
    showAuthMode("login");
    closeTeacherAuth();
    renderAuthState();
  });

  document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  document.querySelectorAll(".teacher-subnav-button").forEach((button) => button.addEventListener("click", () => setTeacherPage(button.dataset.teacherPage)));
  document.querySelectorAll(".teacher-subnav-link").forEach((button) => button.addEventListener("click", () => setTeacherPage(button.dataset.teacherPageTarget)));
  document.querySelectorAll("#setting-only-materials, #setting-show-source, #setting-send-review").forEach((input) => {
    input.addEventListener("change", () => saveAnswerSettings().catch((error) => alert(error.message)));
  });
  $("#new-chat")?.addEventListener("click", () => createChatSession(true));
  $("#reset-chat").addEventListener("click", () => {
    activeSession().messages = [];
    addMessageToActive("assistant", "Welcome. Ask about CPT208 coursework, poster requirements, portfolio, video demo, attendance, or module contacts.");
    renderAll();
  });
  $("#session-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-session]");
    if (!button) return;
    state.activeSessionId = button.dataset.session;
    renderAll();
  });
  $("#flip-card").addEventListener("click", (event) => {
    const button = event.target.closest("[data-card-answer]");
    if (button) {
      chooseCardAnswer(button.dataset.cardAnswer);
      return;
    }
    if (event.target.closest("[data-card-change-answer]")) {
      clearCardAnswer();
    }
  });
  $("#reset-cards").addEventListener("click", resetQuestionCards);
  $("#export-answer-hub").addEventListener("click", exportOfficialAnswerHubPdf);
  $("#prev-flip").addEventListener("click", () => showFlipCard(state.activeFlipIndex - 1));
  $("#next-flip").addEventListener("click", () => showFlipCard(state.activeFlipIndex + 1));
  $("#flip-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-flip-index]");
    if (!button) return;
    showFlipCard(Number(button.dataset.flipIndex));
  });
  $("#ask-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion($("#question-input").value);
  });
  document.querySelectorAll(".quick-topics button").forEach((button) => button.addEventListener("click", () => submitQuestion(button.dataset.question)));
  $("#chat-log").addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (button) renderSources(button.dataset.source);
  });
  $("#source-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-source-card]");
    if (!button) return;
    button.closest(".source-card").classList.toggle("open");
  });
  $("#qa-editor").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#qa-id").value || nextQaId();
    const item = normalizeItem({
      id,
      question: $("#qa-question").value.trim(),
      answer: $("#qa-answer").value.trim(),
      status: $("#qa-status").value,
      source: $("#qa-source").value.trim() || "teacher",
      source_document: $("#qa-doc").value.trim(),
      tags: $("#qa-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    });
    state.items = state.items.some((candidate) => candidate.id === id)
      ? state.items.map((candidate) => candidate.id === id ? item : candidate)
      : [item, ...state.items];
    persistKnowledgeBase();
    fillEditor(null);
    renderAll();
  });
  $("#clear-editor").addEventListener("click", () => fillEditor(null));
  $("#teacher-search").addEventListener("input", renderTeacherList);
  $("#status-filter").addEventListener("change", renderTeacherList);
  $("#new-question-card").addEventListener("click", () => openCardEditor());
  $("#cancel-card-editor").addEventListener("click", closeCardEditor);
  $("#question-card-editor").addEventListener("submit", (event) => {
    event.preventDefault();
    const existing = state.questionCards.find((card) => card.id === $("#card-id").value);
    const card = normalizeQuestionCard({
      id: existing?.id || $("#card-id").value || uid("card"),
      question: $("#card-question").value,
      correctAnswer: $("#card-correct-answer").value,
      explanation: $("#card-explanation").value,
      source: $("#card-source").value,
      groupId: $("#card-group").value,
      status: $("#card-status").value,
      createdAt: existing?.createdAt,
      updatedAt: new Date().toISOString(),
    });
    saveQuestionCard(card).then(closeCardEditor).catch((error) => alert(error.message));
  });
  $("#question-card-list").addEventListener("submit", (event) => {
    const form = event.target.closest("#question-card-group-form");
    if (!form) return;
    event.preventDefault();
    createQuestionCardGroup($("#card-group-name").value, $("#card-group-description").value);
    form.reset();
  });
  $("#question-card-list").addEventListener("click", (event) => {
    const groupAction = event.target.closest("[data-group-action]");
    if (groupAction) {
      if (groupAction.dataset.groupAction === "pin") pinQuestionCardGroup(groupAction.dataset.groupId);
      if (groupAction.dataset.groupAction === "delete") {
        const group = state.questionCardGroups.find((item) => item.id === groupAction.dataset.groupId);
        if (!group || !confirm(`Delete this card group?\n\n${group.name}`)) return;
        deleteQuestionCardGroup(group.id);
      }
      return;
    }
    const action = event.target.closest("[data-card-action]");
    if (!action) return;
    const card = state.questionCards.find((item) => item.id === action.dataset.cardId);
    if (!card) return;
    if (action.dataset.cardAction === "edit") openCardEditor(card);
    if (action.dataset.cardAction === "delete") {
      if (!confirm(`Delete this question card?\n\n${card.question}`)) return;
      deleteQuestionCard(card.id).catch((error) => alert(error.message));
    }
    if (action.dataset.cardAction === "publish") setQuestionCardStatus(card.id, "published").catch((error) => alert(error.message));
    if (action.dataset.cardAction === "unpublish") setQuestionCardStatus(card.id, "draft").catch((error) => alert(error.message));
  });
  $("#latest-updates-list").addEventListener("click", (event) => {
    const action = event.target.closest("[data-update-action]");
    if (!action) return;
    const update = state.latestUpdates.find((item) => item.id === action.dataset.updateId);
    if (!update) return;
    if (action.dataset.updateAction === "edit") {
      const answer = prompt("Edit answer", update.answer);
      if (answer === null) return;
      saveLatestUpdate(normalizeLatestUpdate({ ...update, answer })).catch((error) => alert(error.message));
    }
    if (action.dataset.updateAction === "hide") {
      toggleLatestUpdateVisibility(update.id, !update.visibleToStudents).catch((error) => alert(error.message));
    }
    if (action.dataset.updateAction === "delete") {
      if (!confirm(`Delete this latest update?\n\n${update.question}`)) return;
      deleteLatestUpdate(update.id).catch((error) => alert(error.message));
    }
  });
  $("#toggle-inquiry-view").addEventListener("click", () => {
    state.showResolvedInquiries = !state.showResolvedInquiries;
    renderInquiryLogs();
  });
  $("#inquiry-list").addEventListener("click", (event) => {
    const action = event.target.closest("[data-inquiry-action]");
    if (!action) return;
    const log = state.inquiryLogs.find((entry) => entry.id === action.dataset.logId);
    if (!log) return;
    if (action.dataset.inquiryAction === "approve-publish") {
      approveAndPublishInquiry(log).catch((error) => alert(error.message));
      return;
    }
    if (action.dataset.inquiryAction === "edit-answer") {
      openInquiryEditor(log);
      return;
    }
    if (action.dataset.inquiryAction === "publish-update") {
      publishInquiryToLatestUpdates(log).catch((error) => alert(error.message));
      return;
    }
    if (action.dataset.inquiryAction === "convert-card") {
      convertInquiryToCard(log).catch((error) => alert(error.message));
      return;
    }
    if (action.dataset.inquiryAction === "delete") {
      if (!confirm(`Delete this inquiry record?\n\n${log.question}`)) return;
      deleteInquiryLog(log.id);
    }
  });
  $("#qa-list").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const archive = event.target.closest("[data-archive]");
    const convert = event.target.closest("[data-convert-card]");
    if (edit) fillEditor(state.items.find((item) => item.id === edit.dataset.edit));
    if (convert) {
      convertOfficialAnswerToCard(convert.dataset.convertCard).catch((error) => alert(error.message));
      return;
    }
    if (archive) {
      const item = state.items.find((candidate) => candidate.id === archive.dataset.archive);
      if (!item || !confirm(`Archive this course answer?\n\n${item.question}`)) return;
      item.status = "archived";
      item.updated_at = new Date().toISOString();
      persistKnowledgeBase();
      renderAll();
    }
  });
  $("#export-json").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.items, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cpt208-knowledge-base.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
  $("#import-json").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.items = JSON.parse(await file.text()).map(normalizeItem);
    persistKnowledgeBase();
    renderAll();
  });
  $("#ingest-files").addEventListener("change", (event) => {
    state.pendingIngestFiles = [...(event.target.files || [])];
    $("#ingest-feedback").textContent = state.pendingIngestFiles.length
      ? `${state.pendingIngestFiles.length} file${state.pendingIngestFiles.length === 1 ? "" : "s"} selected.`
      : "No source processed yet.";
  });
  $("#ingest-generate").addEventListener("click", ingestSources);
  $("#ingest-clear").addEventListener("click", () => {
    state.pendingIngestFiles = [];
    $("#ingest-files").value = "";
    $("#ingest-text").value = "";
    $("#ingest-feedback").textContent = "Source input cleared.";
  });
  $("#export-logs").addEventListener("click", downloadInquiryLogs);
  $("#clear-logs").addEventListener("click", () => {
    const hasPending = state.inquiryLogs.some((log) => !log.reviewed);
    state.inquiryLogs = state.inquiryLogs.map((log) => ({ ...log, reviewed: hasPending }));
    persistInquiryLogs();
    renderAll();
  });
}



async function initApp() {
  loadKnowledgeBase();
  loadInquiryLogs();
  loadChatSessions();
  loadMaterialLibrary();
  loadQuestionCardGroups();
  loadUsers();
  loadSession();
  await loadBackendData();
  bindEvents();
  renderAuthState();
}

initApp();
