/* StudyHub: beginner-friendly app using localStorage. */
const STORAGE_KEY = "studyhub-data-v1";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function createId() {
  return window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.problems) && Array.isArray(parsed.notes)) {
      return { tasks: parsed.tasks, problems: parsed.problems, notes: parsed.notes, activity: parsed.activity || {} };
    }
  } catch (error) {
    console.warn("StudyHub data could not be loaded:", error);
  }
  return { tasks: [], problems: [], notes: [], activity: {} };
}
let data = loadData();
let taskFilter = "all";
let dashboardChart = null;
let analyticsChart = null;
let difficultyChart = null;
let toastTimer = null;
let focusInterval = null;
let focusSeconds = 25 * 60;
let focusRunning = false;

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast("Could not save data. Check your browser storage.");
  }
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function safeUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function recordActivity(type) {
  const today = localDateKey();
  if (!data.activity[today]) data.activity[today] = { tasks: 0, coding: 0, notes: 0 };
  data.activity[today][type] = (data.activity[today][type] || 0) + 1;
}
function daysAgoKey(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return localDateKey(date);
}
function currentStreak() {
  // A day counts when the student completes a task, logs a problem, or saves a note.
  let streak = 0;
  const todayActive = hasActivity(data.activity[localDateKey()]);
  let offset = todayActive ? 0 : 1;
  while (streak < 3650 && hasActivity(data.activity[daysAgoKey(offset)])) {
    streak++;
    offset++;
  }
  return streak;
}
function hasActivity(day) {
  return !!day && ((day.tasks || 0) + (day.coding || 0) + (day.notes || 0) > 0);
}
function getWeekLabels() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toLocaleDateString(undefined, { weekday: "short" });
  });
}
function getWeekData(type) {
  return Array.from({ length: 7 }, (_, index) => data.activity[daysAgoKey(6 - index)]?.[type] || 0);
}
function completedTaskCount() { return data.tasks.filter(task => task.completed).length; }
function taskRate() { return data.tasks.length ? Math.round(completedTaskCount() / data.tasks.length * 100) : 0; }
function dateLabel(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function emptyState(icon, title, message) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${escapeHTML(title)}</strong>${escapeHTML(message)}</div>`;
}
function showView(name) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  const names = { dashboard: "Dashboard", tasks: "Task Manager", coding: "Coding Tracker", notes: "Study Notes", analytics: "Analytics" };
  $("#currentSection").textContent = names[name] || "Dashboard";
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "analytics") renderCharts();
}
function renderDashboardTasks() {
  const tasks = data.tasks.filter(task => !task.completed).slice(0, 5);
  const container = $("#dashboardTasks");
  if (!tasks.length) {
    container.innerHTML = emptyState("✓", "You're all caught up", "Add a task to plan your next step.");
    return;
  }
  container.innerHTML = tasks.map(task => `
    <div class="task-row" data-task-row="${task.id}">
      <input class="task-check" type="checkbox" data-complete-task="${task.id}" aria-label="Complete ${escapeHTML(task.title)}">
      <span class="task-row-title">${escapeHTML(task.title)}</span>
      <span class="muted">${task.due ? escapeHTML(dateLabel(task.due)) : `<i class="priority-dot priority-${task.priority}"></i>${escapeHTML(task.priority)}`}</span>
    </div>`).join("");
}
function renderTasks() {
  const filtered = data.tasks.filter(task => taskFilter === "all" || (taskFilter === "active" ? !task.completed : task.completed));
  filtered.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due || "9999").localeCompare(b.due || "9999"));
  $("#taskSummary").textContent = `${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"}`;
  $("#taskNavCount").textContent = data.tasks.filter(t => !t.completed).length;
  const container = $("#taskList");
  if (!filtered.length) {
    container.innerHTML = emptyState("✓", taskFilter === "completed" ? "No completed tasks yet" : "No tasks here yet", taskFilter === "active" ? "You're all caught up. Add another task when you're ready." : "Create a task and make a plan for your day.");
    return;
  }
  container.innerHTML = filtered.map(task => `
    <article class="task-item ${task.completed ? "completed" : ""}">
      <input class="task-check" type="checkbox" data-complete-task="${task.id}" ${task.completed ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} completed">
      <div class="task-main"><h3>${escapeHTML(task.title)}</h3><div class="task-meta"><span><i class="priority-dot priority-${task.priority}"></i>${escapeHTML(task.priority[0].toUpperCase() + task.priority.slice(1))} priority</span><span>${escapeHTML(task.category)}</span><span>Due: ${escapeHTML(dateLabel(task.due))}</span></div></div>
      <div class="item-actions"><button class="small-action" data-edit-task="${task.id}">Edit</button><button class="small-action delete" data-delete-task="${task.id}">Delete</button></div>
    </article>`).join("");
}
function openTaskForm(task = null) {
  $("#taskFormPanel").classList.remove("hidden");
  $("#taskFormTitle").textContent = task ? "Edit task" : "Create a task";
  $("#taskId").value = task?.id || "";
  $("#taskTitle").value = task?.title || "";
  $("#taskDue").value = task?.due || "";
  $("#taskPriority").value = task?.priority || "medium";
  $("#taskCategory").value = task?.category || "Study";
  $("#taskTitle").focus();
  $("#taskFormPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}
function closeTaskForm() { $("#taskFormPanel").classList.add("hidden"); $("#taskForm").reset(); $("#taskId").value = ""; }
function toggleTask(id, completed) {
  const task = data.tasks.find(item => item.id === id);
  if (!task || task.completed === completed) return;
  task.completed = completed;
  if (completed) recordActivity("tasks");
  saveData(); renderAll(); showToast(completed ? "Task completed. Nice work!" : "Task moved back to in progress.");
}
function deleteTask(id) {
  const task = data.tasks.find(item => item.id === id);
  if (!task) return;
  if (!confirm(`Delete "${task.title}"?`)) return;
  data.tasks = data.tasks.filter(item => item.id !== id);
  saveData(); renderAll(); showToast("Task deleted.");
}
function renderCoding() {
  const query = $("#codingSearch").value.trim().toLowerCase();
  const difficulty = $("#codingDifficultyFilter")?.value || "all";
  const language = $("#codingLanguageFilter")?.value || "all";
  const problems = data.problems.filter(problem => `${problem.name} ${problem.language} ${problem.topic} ${problem.difficulty}`.toLowerCase().includes(query))
    .filter(problem => difficulty === "all" || problem.difficulty === difficulty)
    .filter(problem => language === "all" || problem.language === language).slice().reverse();
  $("#codingTotal").textContent = data.problems.length;
  $("#codingEasy").textContent = data.problems.filter(p => p.difficulty === "Easy").length;
  $("#codingMedium").textContent = data.problems.filter(p => p.difficulty === "Medium").length;
  $("#codingHard").textContent = data.problems.filter(p => p.difficulty === "Hard").length;
  const container = $("#codingList");
  if (!problems.length) {
    container.innerHTML = emptyState("⌘", query ? "No matching problems" : "Your coding journey starts here", query ? "Try another search term." : "Log your first solved problem to track your progress.");
    return;
  }
  container.innerHTML = problems.map(problem => {
    const url = safeUrl(problem.link);
    return `<div class="coding-item"><div class="coding-symbol">⌘</div><div class="coding-info"><strong>${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${escapeHTML(problem.name)} ↗</a>` : escapeHTML(problem.name)}</strong><small>${escapeHTML(problem.language)} · ${escapeHTML(problem.topic)} · ${escapeHTML(dateLabel(problem.createdAt))}</small></div><span class="difficulty ${String(problem.difficulty || 'Easy').toLowerCase()}">${escapeHTML(problem.difficulty || 'Easy')}</span><button class="small-action" data-edit-problem="${problem.id}">Edit</button><button class="small-action delete" data-delete-problem="${problem.id}">Delete</button></div>`;
  }).join("");
}
function openCodingForm(problem = null) {
  $("#codingFormPanel").classList.remove("hidden");
  $("#codingFormTitle").textContent = problem ? "Edit coding problem" : "Log a coding problem";
  $("#problemId").value = problem?.id || "";
  $("#problemName").value = problem?.name || "";
  $("#problemLanguage").value = problem?.language || "Java";
  $("#problemTopic").value = problem?.topic || "Arrays";
  $("#problemDifficulty").value = problem?.difficulty || "Easy";
  $("#problemLink").value = problem?.link || "";
  $("#problemName").focus();
  $("#codingFormPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}
function closeCodingForm() { $("#codingFormPanel").classList.add("hidden"); $("#codingForm").reset(); $("#problemId").value = ""; $("#codingFormTitle").textContent = "Log a coding problem"; }
function deleteProblem(id) {
  const problem = data.problems.find(item => item.id === id);
  if (!problem || !confirm(`Delete "${problem.name}" from your coding history?`)) return;
  data.problems = data.problems.filter(item => item.id !== id);
  saveData(); renderAll(); showToast("Coding entry deleted.");
}
function renderNotes() {
  const query = $("#noteSearch").value.trim().toLowerCase();
  const notes = data.notes.filter(note => `${note.title} ${note.subject} ${note.content}`.toLowerCase().includes(query)).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $("#noteSummary").textContent = `${data.notes.length} note${data.notes.length === 1 ? "" : "s"}`;
  const container = $("#notesGrid");
  if (!notes.length) {
    container.innerHTML = emptyState("▤", query ? "No matching notes" : "Your notes library is empty", query ? "Try a different search term." : "Create a note to save useful concepts and revision points.");
    return;
  }
  container.innerHTML = notes.map(note => `<article class="note-card"><div class="note-top"><span class="note-subject">${escapeHTML(note.subject || "General")}</span><span class="muted">${escapeHTML(dateLabel(note.updatedAt))}</span></div><h3>${escapeHTML(note.title)}</h3><div class="note-preview">${escapeHTML(note.content)}</div><div class="note-footer"><span>Updated ${escapeHTML(dateLabel(note.updatedAt))}</span><div class="note-actions"><button data-edit-note="${note.id}" aria-label="Edit note">Edit</button><button data-delete-note="${note.id}" aria-label="Delete note">Delete</button></div></div></article>`).join("");
}
function openNoteForm(note = null) {
  $("#noteFormPanel").classList.remove("hidden");
  $("#noteFormTitle").textContent = note ? "Edit study note" : "Create a study note";
  $("#noteId").value = note?.id || "";
  $("#noteTitle").value = note?.title || "";
  $("#noteSubject").value = note?.subject || "";
  $("#noteContent").value = note?.content || "";
  $("#noteTitle").focus();
  $("#noteFormPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}
function closeNoteForm() { $("#noteFormPanel").classList.add("hidden"); $("#noteForm").reset(); $("#noteId").value = ""; }
function deleteNote(id) {
  const note = data.notes.find(item => item.id === id);
  if (!note || !confirm(`Delete "${note.title}"?`)) return;
  data.notes = data.notes.filter(item => item.id !== id);
  saveData(); renderAll(); showToast("Note deleted.");
}
function renderStats() {
  const completed = completedTaskCount();
  const rate = taskRate();
  $("#statCompleted").textContent = completed;
  $("#taskRate").textContent = `${rate}%`;
  $("#taskProgressBar").style.width = `${rate}%`;
  $("#statProblems").textContent = data.problems.length;
  $("#statNotes").textContent = data.notes.length;
  $("#statStreak").textContent = currentStreak();
  $("#codingTopics").textContent = data.problems.length ? `${new Set(data.problems.map(p => p.topic)).size} topic${new Set(data.problems.map(p => p.topic)).size === 1 ? "" : "s"} practiced` : "Start your first problem";
  $("#analyticsTaskRate").textContent = `${rate}%`;
  $("#analyticsProblems").textContent = data.problems.length;
  $("#analyticsNotes").textContent = data.notes.length;
  $("#analyticsStreak").textContent = currentStreak();
}
function chartOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1b2440", titleColor: "#fff", bodyColor: "#c8d2e8", borderColor: "#35415f", borderWidth: 1, padding: 10 } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#7886a3", font: { size: 10 } }, border: { display: false } },
      y: { beginAtZero: true, ticks: { color: "#7886a3", precision: 0, font: { size: 10 } }, grid: { color: "#222d43" }, border: { display: false } }
    }
  };
}
function renderCharts() {
  if (typeof Chart === "undefined") return; // The rest of the app works without the optional chart library.
  const labels = getWeekLabels();
  const taskData = getWeekData("tasks");
  const codingData = getWeekData("coding");
  const common = chartOptions();
  const dashboardCanvas = $("#dashboardChart");
  if (dashboardCanvas) {
    if (dashboardChart) dashboardChart.destroy();
    dashboardChart = new Chart(dashboardCanvas, { type: "line", data: { labels, datasets: [
      { label: "Tasks completed", data: taskData, borderColor: "#9a78ff", backgroundColor: "#9a78ff20", fill: true, tension: .38, pointRadius: 3, pointBackgroundColor: "#9a78ff" },
      { label: "Coding solved", data: codingData, borderColor: "#57b7ff", backgroundColor: "#57b7ff12", fill: true, tension: .38, pointRadius: 3, pointBackgroundColor: "#57b7ff" }
    ] }, options: { ...common, scales: { ...common.scales, y: { ...common.scales.y, suggestedMax: Math.max(3, ...taskData, ...codingData) } } } });
  }
  const analyticsCanvas = $("#analyticsChart");
  if (analyticsCanvas && $("#view-analytics").classList.contains("active")) {
    if (analyticsChart) analyticsChart.destroy();
    analyticsChart = new Chart(analyticsCanvas, { type: "bar", data: { labels, datasets: [
      { label: "Tasks completed", data: taskData, backgroundColor: "#9475ff", borderRadius: 5, maxBarThickness: 22 },
      { label: "Coding solved", data: codingData, backgroundColor: "#57b7ff", borderRadius: 5, maxBarThickness: 22 }
    ] }, options: { ...common, scales: { ...common.scales, x: { ...common.scales.x, stacked: false }, y: { ...common.scales.y, suggestedMax: Math.max(3, ...taskData, ...codingData) } } } });
  }
  const difficultyCanvas = $("#difficultyChart");
  if (difficultyCanvas && $("#view-analytics").classList.contains("active")) {
    if (difficultyChart) difficultyChart.destroy();
    const levels = ["Easy", "Medium", "Hard"];
    const counts = levels.map(level => data.problems.filter(problem => problem.difficulty === level).length);
    difficultyChart = new Chart(difficultyCanvas, { type: "doughnut", data: { labels: levels, datasets: [{ data: counts.some(Boolean) ? counts : [1, 1, 1], backgroundColor: counts.some(Boolean) ? ["#61ddb0", "#ffb86b", "#ff79c6"] : ["#273149", "#303a53", "#39435b"], borderColor: "#101729", borderWidth: 5, hoverOffset: 5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: { enabled: counts.some(Boolean) } } } });
    $("#difficultyLegend").innerHTML = levels.map((level, index) => `<span><i style="background:${["#61ddb0", "#ffb86b", "#ff79c6"][index]}"></i>${level}: ${counts[index]}</span>`).join("");
  }
}
function renderTopicBreakdown() {
  const counts = {};
  data.problems.forEach(problem => counts[problem.topic] = (counts[problem.topic] || 0) + 1);
  const topics = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const container = $("#topicBreakdown");
  if (!topics.length) {
    container.innerHTML = emptyState("⌘", "No topic data yet", "Log coding problems to see your topic breakdown.");
    return;
  }
  const max = Math.max(...topics.map(item => item[1]));
  container.innerHTML = topics.map(([topic, count]) => `<div class="topic-row"><span>${escapeHTML(topic)}</span><div class="topic-bar"><span style="width:${count / max * 100}%"></span></div><span class="topic-count">${count}</span></div>`).join("");
}
function renderAll() {
  renderStats(); renderDashboardTasks(); renderTasks(); renderCoding(); renderNotes(); renderTopicBreakdown();
  renderCharts();
}
function exportData() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `studyhub-backup-${localDateKey()}.json`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  showToast("Your StudyHub backup has been downloaded.");
}

// Navigation: sidebar and quick-access buttons.
$$("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => showView(button.dataset.go)));

// Task manager interactions.
$("#openTaskForm").addEventListener("click", () => openTaskForm());
$("#closeTaskForm").addEventListener("click", closeTaskForm);
$("#cancelTask").addEventListener("click", closeTaskForm);
$("#taskForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#taskId").value;
  const title = $("#taskTitle").value.trim();
  if (!title) return;
  const values = { title, due: $("#taskDue").value, priority: $("#taskPriority").value, category: $("#taskCategory").value };
  if (id) {
    const task = data.tasks.find(item => item.id === id);
    if (task) Object.assign(task, values);
    showToast("Task updated.");
  } else {
    data.tasks.push({ id: createId(), ...values, completed: false, createdAt: localDateKey() });
    showToast("Task added to your list.");
  }
  saveData(); closeTaskForm(); renderAll();
});
$("#taskFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  taskFilter = button.dataset.filter;
  $$("#taskFilters .filter-tab").forEach(tab => tab.classList.toggle("active", tab === button));
  renderTasks();
});

// Coding tracker interactions.
$("#openCodingForm").addEventListener("click", openCodingForm);
$("#closeCodingForm").addEventListener("click", closeCodingForm);
$("#cancelCoding").addEventListener("click", closeCodingForm);
$("#codingForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#problemId").value;
  const name = $("#problemName").value.trim();
  if (!name) return;
  const link = $("#problemLink").value.trim();
  if (link && !safeUrl(link)) { showToast("Please enter a valid http or https link."); return; }
  const values = { name, language: $("#problemLanguage").value, topic: $("#problemTopic").value, difficulty: $("#problemDifficulty").value, link };
  if (id) {
    const problem = data.problems.find(item => item.id === id);
    if (problem) Object.assign(problem, values);
    showToast("Coding problem updated.");
  } else {
    data.problems.push({ id: createId(), ...values, createdAt: localDateKey() });
    recordActivity("coding");
    showToast("Coding problem logged. Keep it up!");
  }
  saveData(); closeCodingForm(); renderAll();
});
$("#codingSearch").addEventListener("input", renderCoding);
$("#codingDifficultyFilter").addEventListener("change", renderCoding);
$("#codingLanguageFilter").addEventListener("change", renderCoding);

// Study notes interactions.
$("#openNoteForm").addEventListener("click", () => openNoteForm());
$("#closeNoteForm").addEventListener("click", closeNoteForm);
$("#cancelNote").addEventListener("click", closeNoteForm);
$("#noteForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#noteId").value;
  const title = $("#noteTitle").value.trim();
  const content = $("#noteContent").value.trim();
  if (!title || !content) return;
  const now = new Date().toISOString();
  const values = { title, subject: $("#noteSubject").value.trim(), content, updatedAt: localDateKey(), updatedAtTime: now };
  if (id) {
    const note = data.notes.find(item => item.id === id);
    if (note) Object.assign(note, values);
    showToast("Note updated.");
  } else {
    data.notes.push({ id: createId(), ...values, createdAt: localDateKey() });
    recordActivity("notes"); showToast("Study note saved.");
  }
  saveData(); closeNoteForm(); renderAll();
});
$("#noteSearch").addEventListener("input", renderNotes);

// Delegated controls for dynamically rendered items.
document.addEventListener("click", event => {
  const editTask = event.target.closest("[data-edit-task]");
  const deleteTaskButton = event.target.closest("[data-delete-task]");
  const deleteProblemButton = event.target.closest("[data-delete-problem]");
  const editProblemButton = event.target.closest("[data-edit-problem]");
  const editNote = event.target.closest("[data-edit-note]");
  const deleteNoteButton = event.target.closest("[data-delete-note]");
  if (editTask) openTaskForm(data.tasks.find(item => item.id === editTask.dataset.editTask));
  if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
  if (deleteProblemButton) deleteProblem(deleteProblemButton.dataset.deleteProblem);
  if (editProblemButton) openCodingForm(data.problems.find(item => item.id === editProblemButton.dataset.editProblem));
  if (editNote) openNoteForm(data.notes.find(item => item.id === editNote.dataset.editNote));
  if (deleteNoteButton) deleteNote(deleteNoteButton.dataset.deleteNote);
});
document.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-complete-task]");
  if (checkbox) toggleTask(checkbox.dataset.completeTask, checkbox.checked);
});
$("#exportData").addEventListener("click", exportData);
function applyTheme(theme) {
  document.body.classList.toggle("light-theme", theme === "light");
  $("#themeHint").textContent = theme === "light" ? "☾" : "☼";
  $("#themeHint").setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
  try { localStorage.setItem("studyhub-theme", theme); } catch (error) { /* Theme preference is optional. */ }
}
$("#themeHint").addEventListener("click", () => {
  const next = document.body.classList.contains("light-theme") ? "dark" : "light";
  applyTheme(next);
  showToast(`${next === "light" ? "Light" : "Dark"} theme enabled.`);
});

// Gentle pointer tilt and glow: disabled on touch devices and for reduced-motion preferences.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.addEventListener("pointermove", event => {
    const card = event.target.closest(".stat-card, .note-card, .quick-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.transform = `perspective(900px) rotateX(${(0.5-y)*3}deg) rotateY(${(x-0.5)*4}deg) translateY(-2px)`;
    card.style.setProperty("--pointer-x", `${x*100}%`);
    card.style.setProperty("--pointer-y", `${y*100}%`);
  });
  document.addEventListener("pointerout", event => {
    const card = event.target.closest(".stat-card, .note-card, .quick-card");
    if (card && !card.contains(event.relatedTarget)) card.style.transform = "";
  });
}

// Focus timer: one 25-minute session, pause/resume and reset.
function updateFocusDisplay() {
  const minutes = Math.floor(focusSeconds / 60).toString().padStart(2, "0");
  const seconds = (focusSeconds % 60).toString().padStart(2, "0");
  $("#focusTime").textContent = `${minutes}:${seconds}`;
  $("#focusStart").textContent = focusRunning ? "Ⅱ Pause focus" : (focusSeconds === 25 * 60 ? "▶ Start focus" : "▶ Resume focus");
}
$("#focusStart").addEventListener("click", () => {
  if (focusRunning) {
    clearInterval(focusInterval); focusRunning = false; $("#focusStatus").textContent = "Paused — take a breath, then resume."; updateFocusDisplay(); return;
  }
  focusRunning = true; $("#focusStatus").textContent = "Focus session in progress — you've got this!"; updateFocusDisplay();
  focusInterval = setInterval(() => {
    focusSeconds = Math.max(0, focusSeconds - 1); updateFocusDisplay();
    if (focusSeconds === 0) {
      clearInterval(focusInterval); focusRunning = false; $("#focusStatus").textContent = "Session complete! Take a short break.";
      updateFocusDisplay(); showToast("Focus session complete. Great work!");
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("StudyHub", { body: "Your focus session is complete. Take a short break!" }); } catch (error) { /* Notifications are optional. */ }
    }
  }, 1000);
});
$("#focusReset").addEventListener("click", () => {
  clearInterval(focusInterval); focusRunning = false; focusSeconds = 25 * 60;
  $("#focusStatus").textContent = "25-minute focus session"; updateFocusDisplay();
});

// Start the app. Existing studyhub-data-v1 data is read as-is and never cleared.
try { applyTheme(localStorage.getItem("studyhub-theme") === "light" ? "light" : "dark"); } catch (error) { applyTheme("dark"); }
updateFocusDisplay();
$("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
renderAll();
