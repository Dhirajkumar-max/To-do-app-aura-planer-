// ─── App State ──────────────────────────────────────────────
let tasks = [];
let dayPlan = [];
let transactions = [];
let savingsTarget = 500;
let stepGoal = 10000;
let stepsWalked = 0;
let habits = [];
let currentUser = null;

let activeTab = "tab-tasks";
let searchQuery = "";
let activeFilter = "all";

// Active alarm track tracking
let activeAlarmTaskId = null;

// ─── Synthesized Alarm Sound Engine (Web Audio API) ─────────
class SynthesizedAlarm {
    constructor() {
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.beepInterval = null;
    }

    init() {
        if (this.audioCtx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
        }
    }

    play() {
        this.init();
        if (!this.audioCtx) return;
        
        // Handle browser autoplay restriction
        if (this.audioCtx.state === "suspended") {
            updateAudioPrimeButtonState(true);
            return;
        }

        if (this.isPlaying) return;
        this.isPlaying = true;
        updateAudioPrimeButtonState(false);

        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();
        
        // Configure alarm tone (melodious but noticeable A5 note)
        this.oscillator.type = "sine";
        this.oscillator.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        
        this.oscillator.start();
        
        // Volume modulation (pulsing ringtone beep)
        let toggle = false;
        this.beepInterval = setInterval(() => {
            if (!this.audioCtx || !this.isPlaying) return;
            const now = this.audioCtx.currentTime;
            if (toggle) {
                // Ring sound
                this.gainNode.gain.setTargetAtTime(0.35, now, 0.04);
                this.oscillator.frequency.setValueAtTime(880, now);
            } else {
                // Mute gap
                this.gainNode.gain.setTargetAtTime(0, now, 0.04);
            }
            toggle = !toggle;
        }, 400);
    }

    stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        if (this.beepInterval) {
            clearInterval(this.beepInterval);
            this.beepInterval = null;
        }
        try {
            if (this.oscillator) {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.oscillator = null;
            }
            if (this.gainNode) {
                this.gainNode.disconnect();
                this.gainNode = null;
            }
        } catch (e) {
            console.error("Synthesizer cleanup error:", e);
        }
    }

    playShortPing() {
        this.init();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === "suspended") {
            this.audioCtx.resume();
        }
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5 pitch
        gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.6);
    }
}

const alarmSound = new SynthesizedAlarm();

// Audio status indicator in Header
function updateAudioPrimeButtonState(needsPrime) {
    const btn = document.getElementById("primeAudioBtn");
    if (!btn) return;
    if (needsPrime) {
        btn.textContent = "🔊 Enable Sound";
        btn.classList.add("needs-action");
    } else {
        btn.textContent = "🔊 Sound System Ready";
        btn.classList.remove("needs-action");
    }
}

document.getElementById("primeAudioBtn").addEventListener("click", () => {
    alarmSound.init();
    if (alarmSound.audioCtx && alarmSound.audioCtx.state === "suspended") {
        alarmSound.audioCtx.resume().then(() => {
            updateAudioPrimeButtonState(false);
            alarmSound.playShortPing();
        });
    } else {
        alarmSound.playShortPing();
    }
});

// Trigger browser priming on first generic body click
document.body.addEventListener("click", () => {
    alarmSound.init();
    if (alarmSound.audioCtx && alarmSound.audioCtx.state === "suspended") {
        alarmSound.audioCtx.resume().then(() => {
            updateAudioPrimeButtonState(false);
        });
    }
}, { once: true });

// ─── Persistence ────────────────────────────────────────────
function saveState() {
    if (!currentUser) return;
    try {
        localStorage.setItem(`aura_data_${currentUser.uid}`, JSON.stringify({
            aura_tasks: tasks,
            aura_dayplan: dayPlan,
            aura_transactions: transactions,
            aura_savings_target: savingsTarget,
            aura_step_goal: stepGoal,
            aura_steps_walked: stepsWalked,
            aura_habits: habits
        }));
    } catch (err) {
        console.error("Error saving state:", err);
    }
}

// ─── Tab Switching ──────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        activeTab = btn.dataset.tab;
        
        document.querySelectorAll(".tab-content").forEach(section => {
            section.classList.remove("active");
        });
        document.getElementById(activeTab).classList.add("active");
        
        // Update Title text
        const titleMap = {
            "tab-tasks": "Task Dashboard",
            "tab-planner": "Daily Planner",
            "tab-money": "Money Management",
            "tab-fitness": "Fitness Tracker",
            "tab-habits": "Habit Board"
        };
        document.getElementById("currentTabTitle").textContent = titleMap[activeTab] || "Dashboard";
        
        // Refresh specific screen graphics on enter
        if (activeTab === "tab-fitness") {
            updateFitnessProgressCircle();
        }
    });
});

// ─── Clock and Date Header ──────────────────────────────────
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false });
    document.getElementById("liveClock").textContent = timeStr;
    
    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    document.getElementById("headerDateString").textContent = dateStr;
}
setInterval(updateClock, 1000);
updateClock();

// ─── Notifications Permissions ──────────────────────────────
function updateNotifBanner() {
    const banner = document.getElementById("notifBanner");
    const text = document.getElementById("notifText");
    const btn = document.getElementById("enableNotifBtn");
    
    if (!banner || !text || !btn) return;
    
    if (!("Notification" in window)) {
        text.textContent = "Notifications not supported on this browser.";
        btn.style.display = "none";
        return;
    }
    
    if (Notification.permission === "granted") {
        text.textContent = "✅ Desktop Alerts active — background notifications enabled!";
        btn.style.display = "none";
        banner.style.background = "rgba(16, 185, 129, 0.1)";
        banner.style.borderColor = "rgba(16, 185, 129, 0.2)";
    } else if (Notification.permission === "denied") {
        text.textContent = "❌ Alerts blocked. Go to browser settings to permit notifications.";
        btn.style.display = "none";
    } else {
        text.textContent = "🔔 Enable alerts to receive background alarms for your schedule.";
        btn.style.display = "block";
    }
}

document.getElementById("enableNotifBtn").addEventListener("click", async () => {
    if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        updateNotifBanner();
    }
});

// ─── Audio Alarm Logic ──────────────────────────────────────
function checkAlarms() {
    const now = Date.now();
    tasks.forEach(task => {
        if (!task.due || task.done || !task.alarmEnabled || task.alarmTriggered) return;
        
        const alarmOffsetMs = (task.alarmOffset || 0) * 60 * 1000;
        const alarmTime = task.due - alarmOffsetMs;
        
        // Trigger if current time has passed the scheduled alarm time,
        // and is within a reasonable window (10 mins) to avoid triggering past alerts on load
        if (now >= alarmTime && (now - alarmTime) < 10 * 60 * 1000) {
            triggerAlarm(task);
        }
    });
}
setInterval(checkAlarms, 1000);

function triggerAlarm(task) {
    task.alarmTriggered = true;
    saveState();
    
    activeAlarmTaskId = task.id;
    
    // Play HTML Synthesized alarm audio
    alarmSound.play();
    
    // Trigger Desktop Notification if permission exists
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ Scheduled Alarm!", {
            body: `Alarm for: "${task.name}"`,
            icon: "https://cdn-icons-png.flaticon.com/512/3114/3114812.png" // placeholder/nice logo icon
        });
    }
    
    // Display Modal UI
    const modal = document.getElementById("alarmModal");
    const nameEl = document.getElementById("alarmTaskName");
    const timeEl = document.getElementById("alarmTaskTime");
    
    nameEl.textContent = task.name;
    const dueFormatted = new Date(task.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timeEl.textContent = `Due Time: ${dueFormatted} (${task.alarmOffset} mins before alert)`;
    
    modal.classList.remove("hidden");
    renderTasks();
}

// Modal Dismiss Button
document.getElementById("dismissAlarmBtn").addEventListener("click", () => {
    alarmSound.stop();
    document.getElementById("alarmModal").classList.add("hidden");
    activeAlarmTaskId = null;
});

// Modal Snooze Button
document.getElementById("snoozeAlarmBtn").addEventListener("click", () => {
    alarmSound.stop();
    document.getElementById("alarmModal").classList.add("hidden");
    
    if (activeAlarmTaskId) {
        const task = tasks.find(t => t.id === activeAlarmTaskId);
        if (task) {
            // Postpone due date by 5 minutes and reset trigger status
            task.due = Date.now() + 5 * 60 * 1000;
            task.alarmOffset = 0; // Trigger instantly when 5 minutes is up
            task.alarmTriggered = false;
            saveState();
            renderTasks();
        }
    }
    activeAlarmTaskId = null;
});

// Alarm Offset visual toggle
document.getElementById("alarmEnabledInput").addEventListener("change", function() {
    const selectGroup = document.getElementById("alarmTimeGroup");
    if (this.checked) {
        selectGroup.classList.remove("hidden");
    } else {
        selectGroup.classList.add("hidden");
    }
});

// ─── Module 1: Tasks Manager ────────────────────────────────
function updateTaskStats() {
    const now = Date.now();
    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("pendingCount").textContent = tasks.filter(t => !t.done).length;
    document.getElementById("doneCount").textContent = tasks.filter(t => t.done).length;
    document.getElementById("overdueCount").textContent = tasks.filter(t => !t.done && t.due && t.due < now).length;
}

function getFilteredTasks() {
    const now = Date.now();
    let filtered = [...tasks];
    
    if (searchQuery) {
        filtered = filtered.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    switch (activeFilter) {
        case "pending": filtered = filtered.filter(t => !t.done); break;
        case "done":    filtered = filtered.filter(t => t.done); break;
        case "overdue": filtered = filtered.filter(t => !t.done && t.due && t.due < now); break;
        case "high":    filtered = filtered.filter(t => t.priority === "high"); break;
    }
    
    // Sorting: Incomplete high-priority first, then chronologically by due date
    filtered.sort((a, b) => {
        if (a.done !== b.done) return a.done - b.done; // Uncompleted first
        const pOrder = { high: 0, medium: 1, low: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        if (a.due && b.due) return a.due - b.due;
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
    });
    
    return filtered;
}

function getDueBadgeHTML(task) {
    if (!task.due) return "";
    const now = Date.now();
    const diff = task.due - now;
    const dateFormatted = new Date(task.due).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    if (task.done) return `<span class="badge badge-done">✔ Completed (${dateFormatted})</span>`;
    if (diff < 0) return `<span class="badge badge-overdue">⚠ Overdue: ${dateFormatted}</span>`;
    if (diff < 15 * 60 * 1000) return `<span class="badge badge-soon">⏰ Imminent: ${dateFormatted}</span>`;
    
    let alarmHTML = "";
    if (task.alarmEnabled && !task.alarmTriggered) {
        const offset = task.alarmOffset || 0;
        alarmHTML = `<span class="badge badge-alarm">🔔 Alarm (${offset}m prior)</span>`;
    }
    
    return `<span class="badge badge-due">📅 Due: ${dateFormatted}</span> ${alarmHTML}`;
}

function renderTasks() {
    const list = document.getElementById("taskList");
    const filtered = getFilteredTasks();
    updateTaskStats();
    
    if (filtered.length === 0) {
        list.innerHTML = `<li class="empty-state">No tasks match your selections.</li>`;
        return;
    }
    
    const priorityLabels = { high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low" };
    
    list.innerHTML = filtered.map(task => `
        <li class="task-item ${task.done ? "completed-item" : ""} prio-${task.priority}" id="task-${task.id}">
            <div class="task-left">
                <input type="checkbox" class="task-check" ${task.done ? "checked" : ""}
                    onchange="toggleTaskDone('${task.id}')" title="Mark Done" />
                <div class="task-body">
                    <span class="task-name ${task.done ? "striked" : ""}">${escapeHTML(task.name)}</span>
                    <div class="task-meta">
                        <span class="prio-badge prio-${task.priority}-badge">${priorityLabels[task.priority]}</span>
                        ${getDueBadgeHTML(task)}
                    </div>
                </div>
            </div>
            <div class="task-actions">
                <button class="edit-btn" onclick="editTask('${task.id}')" title="Edit text">✏️</button>
                <button class="delete-btn" onclick="deleteTask('${task.id}')" title="Remove">✖</button>
            </div>
        </li>
    `).join("");
}

document.getElementById("taskForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const nameInput = document.getElementById("taskInput");
    const dtInput = document.getElementById("dtInput");
    const priorityInput = document.getElementById("priorityInput");
    const alarmEnabledInput = document.getElementById("alarmEnabledInput");
    const alarmOffsetInput = document.getElementById("alarmOffsetInput");
    
    const name = nameInput.value.trim();
    if (!name) return;
    
    const task = {
        id: Date.now().toString(),
        name: name,
        due: dtInput.value ? new Date(dtInput.value).getTime() : null,
        priority: priorityInput.value,
        done: false,
        alarmEnabled: alarmEnabledInput.checked,
        alarmOffset: alarmEnabledInput.checked ? Number(alarmOffsetInput.value) : 0,
        alarmTriggered: false,
        createdAt: Date.now()
    };
    
    tasks.unshift(task);
    saveState();
    renderTasks();
    
    // Reset Form fields
    nameInput.value = "";
    dtInput.value = "";
    priorityInput.value = "medium";
    alarmEnabledInput.checked = false;
    document.getElementById("alarmTimeGroup").classList.add("hidden");
    
    // Animate insertion
    setTimeout(() => {
        const item = document.getElementById(`task-${task.id}`);
        if (item) item.classList.add("pop-in");
    }, 10);
});

function toggleTaskDone(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done) {
        task.alarmTriggered = true; // prevent recurring rings
        if (activeAlarmTaskId === id) alarmSound.stop();
    } else {
        task.alarmTriggered = false;
    }
    saveState();
    renderTasks();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    if (activeAlarmTaskId === id) {
        alarmSound.stop();
        activeAlarmTaskId = null;
    }
    saveState();
    renderTasks();
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newTitle = prompt("Edit Task Title:", task.name);
    if (newTitle === null) return;
    if (!newTitle.trim()) {
        alert("Task description cannot be left blank!");
        return;
    }
    task.name = newTitle.trim();
    saveState();
    renderTasks();
}

// Filtering & Searching listeners
document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        renderTasks();
    });
});

document.getElementById("searchInput").addEventListener("input", function() {
    searchQuery = this.value;
    renderTasks();
});

document.getElementById("clearDoneBtn").addEventListener("click", () => {
    tasks = tasks.filter(t => !t.done);
    saveState();
    renderTasks();
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
    if (!confirm("Are you absolutely sure you want to wipe all tasks?")) return;
    tasks = [];
    alarmSound.stop();
    saveState();
    renderTasks();
});


// ─── Module 2: Day Planner ──────────────────────────────────
function renderDayPlan() {
    const timeline = document.getElementById("plannerTimeline");
    if (dayPlan.length === 0) {
        timeline.innerHTML = `<div class="empty-state">No scheduled events logged for today. Start planning hourly slots!</div>`;
        return;
    }
    
    // Sort chronological: start time first
    dayPlan.sort((a, b) => a.start.localeCompare(b.start));
    
    timeline.innerHTML = dayPlan.map(slot => {
        const isComp = slot.status === "completed";
        const isProg = slot.status === "in-progress";
        const statusClass = isComp ? "completed" : (isProg ? "in-progress" : "");
        
        return `
            <div class="timeline-slot ${statusClass}" id="slot-${slot.id}">
                <div class="timeline-time">${formatTime12Hour(slot.start)} - ${formatTime12Hour(slot.end)}</div>
                <div class="timeline-body">
                    <div class="timeline-title">${escapeHTML(slot.what)}</div>
                    <div class="timeline-instructions">${escapeHTML(slot.how)}</div>
                </div>
                <div class="timeline-right">
                    <select class="plan-status-select" onchange="updatePlanStatus('${slot.id}', this.value)">
                        <option value="not-started" ${slot.status === "not-started" ? "selected" : ""}>⏳ Pending</option>
                        <option value="in-progress" ${slot.status === "in-progress" ? "selected" : ""}>🏃 In Progress</option>
                        <option value="completed" ${slot.status === "completed" ? "selected" : ""}>✅ Completed</option>
                    </select>
                    <button class="delete-btn" onclick="deletePlanSlot('${slot.id}')" title="Delete slot">✖</button>
                </div>
            </div>
        `;
    }).join("");
}

document.getElementById("plannerForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const startVal = document.getElementById("planStartInput").value;
    const endVal = document.getElementById("planEndInput").value;
    const whatVal = document.getElementById("planWhatInput").value.trim();
    const howVal = document.getElementById("planHowInput").value.trim();
    
    if (startVal >= endVal) {
        alert("Error: Start time must occur before End time!");
        return;
    }
    
    const slot = {
        id: Date.now().toString(),
        start: startVal,
        end: endVal,
        what: whatVal,
        how: howVal,
        status: "not-started"
    };
    
    dayPlan.push(slot);
    saveState();
    renderDayPlan();
    
    // Clear forms
    document.getElementById("planWhatInput").value = "";
    document.getElementById("planHowInput").value = "";
    document.getElementById("planStartInput").value = "";
    document.getElementById("planEndInput").value = "";
});

function updatePlanStatus(id, value) {
    const slot = dayPlan.find(s => s.id === id);
    if (slot) {
        slot.status = value;
        saveState();
        renderDayPlan();
    }
}

function deletePlanSlot(id) {
    dayPlan = dayPlan.filter(s => s.id !== id);
    saveState();
    renderDayPlan();
}

document.getElementById("clearDayPlanBtn").addEventListener("click", () => {
    if (!confirm("Are you sure you want to reset today's schedule?")) return;
    dayPlan = [];
    saveState();
    renderDayPlan();
});

// Templates Auto-Fill
document.getElementById("templateWorkdayBtn").addEventListener("click", () => {
    if (dayPlan.length > 0 && !confirm("Overwrite current schedule?")) return;
    dayPlan = [
        { id: "w1", start: "08:00", end: "09:00", what: "🍳 Breakfast & Plan Day", how: "Cook eggs/protein, review aura todo panel, prepare calendar agenda.", status: "not-started" },
        { id: "w2", start: "09:00", end: "13:00", what: "🏢 Core Deep Work (Sprint)", how: "Silence mobile notifications. Put heads down on highest priority items.", status: "not-started" },
        { id: "w3", start: "13:00", end: "14:00", what: "🍱 Lunch Break & Walking", how: "Eat a balanced meal, disconnect from screens, get a 10 min stroll.", status: "not-started" },
        { id: "w4", start: "14:00", end: "17:00", what: "📥 Emails, Admin & Syncs", how: "Unblock teammates, clean up email inbox, update project tasks.", status: "not-started" },
        { id: "w5", start: "18:00", end: "19:30", what: "🏋 Fitness Gym/Cardio Session", how: "Strength workout or walk 6000 steps to burn daily calorie buffer.", status: "not-started" },
        { id: "w6", start: "21:00", end: "22:30", what: "🧠 Reading & Habit Logging", how: "Read 10 pages of book, analyze daily spending, tick off habits.", status: "not-started" }
    ];
    saveState();
    renderDayPlan();
});

document.getElementById("templateWeekendBtn").addEventListener("click", () => {
    if (dayPlan.length > 0 && !confirm("Overwrite current schedule?")) return;
    dayPlan = [
        { id: "e1", start: "09:00", end: "10:30", what: "🥞 Relaxed Breakfast", how: "Brew coffee, read articles, avoid morning digital rush.", status: "not-started" },
        { id: "e2", start: "11:00", end: "14:00", what: "🌲 Outdoor Outing & Hobbies", how: "Visit local park or engage in coding side projects/music practice.", status: "not-started" },
        { id: "e3", start: "15:00", end: "18:00", what: "🍿 Social & Recovery", how: "Relax with friends or watch movie, recharge mental capacity.", status: "not-started" },
        { id: "e4", start: "20:00", end: "21:30", what: "📒 Weekly Retrospective", how: "Evaluate wallet balance, review habit compliance streaks, plan next week.", status: "not-started" }
    ];
    saveState();
    renderDayPlan();
});


// ─── Module 3: Money Manager & Advisor ──────────────────────
function updateFinanceStats() {
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });
    
    const saved = income - expense;
    
    document.getElementById("totalIncomeText").textContent = `₹${income.toLocaleString()}`;
    document.getElementById("totalExpenseText").textContent = `₹${expense.toLocaleString()}`;
    document.getElementById("totalSavingsText").textContent = `₹${saved.toLocaleString()}`;
    document.getElementById("savingsTargetText").textContent = `₹${savingsTarget.toLocaleString()}`;
    
    // Update input UI display
    document.getElementById("savingsTargetInput").value = savingsTarget;
    
    analyzeFinancials(income, expense, saved);
}

function renderTransactions() {
    const tbody = document.getElementById("txTableBody");
    updateFinanceStats();
    
    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="text-align:center;">No financial entries recorded today.</td></tr>`;
        return;
    }
    
    // Show newest first
    const sortedTx = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    
    tbody.innerHTML = sortedTx.map(t => `
        <tr>
            <td><span class="tx-badge bg-tx-${t.type}">${t.type}</span></td>
            <td>${escapeHTML(t.category)}</td>
            <td>${escapeHTML(t.notes)}</td>
            <td class="tx-${t.type}">${t.type === "income" ? "+" : "-"}₹${t.amount.toLocaleString()}</td>
            <td><button class="delete-btn" onclick="deleteTransaction('${t.id}')">✖</button></td>
        </tr>
    `).join("");
}

document.getElementById("moneyForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const type = document.getElementById("txType").value;
    const amount = Number(document.getElementById("txAmount").value);
    const category = document.getElementById("txCategory").value;
    const notes = document.getElementById("txNotes").value.trim();
    
    if (amount <= 0 || isNaN(amount)) {
        alert("Please specify a valid transaction amount!");
        return;
    }
    
    const tx = {
        id: Date.now().toString(),
        type,
        amount,
        category,
        notes,
        timestamp: Date.now()
    };
    
    transactions.push(tx);
    saveState();
    renderTransactions();
    
    // Reset inputs
    document.getElementById("txAmount").value = "";
    document.getElementById("txNotes").value = "";
});

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveState();
    renderTransactions();
}

document.getElementById("saveTargetBtn").addEventListener("click", () => {
    const val = Number(document.getElementById("savingsTargetInput").value);
    if (val < 0 || isNaN(val)) {
        alert("Savings goal must be positive!");
        return;
    }
    savingsTarget = val;
    saveState();
    updateFinanceStats();
});

document.getElementById("clearTransactionsBtn").addEventListener("click", () => {
    if (!confirm("Are you sure you want to clear financial logs?")) return;
    transactions = [];
    saveState();
    renderTransactions();
});

// Heuristic Financial Advisor Engine
function analyzeFinancials(income, expense, netSaved) {
    const badge = document.getElementById("advisorStatusBadge");
    const adviceBox = document.getElementById("advisorText");
    const tipsBox = document.getElementById("advisorTipsList");
    
    badge.className = "advisor-status-badge"; // reset classes
    
    if (transactions.length === 0) {
        badge.textContent = "💤 Idle";
        badge.classList.add("status-cautious");
        adviceBox.textContent = "Please log transactions today. Your finance advisor is currently waiting to compute metrics.";
        tipsBox.innerHTML = "";
        return;
    }
    
    // Categorize expenses
    const categoryTotals = {};
    transactions.forEach(t => {
        if (t.type === "expense") {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        }
    });
    
    // Calculate performance score
    let score = "balanced";
    let scoreText = "";
    
    if (netSaved >= savingsTarget) {
        score = "excellent";
        badge.textContent = "🏆 Master Saver";
        badge.classList.add("status-excellent");
        scoreText = `Fantastic effort today! You saved ₹${netSaved.toLocaleString()} which met/exceeded your target goal of ₹${savingsTarget.toLocaleString()}. You are managing capital highly effectively.`;
    } else if (netSaved >= 0) {
        score = "cautious";
        badge.textContent = "⚖ Balanced Spend";
        badge.classList.add("status-cautious");
        const remaining = savingsTarget - netSaved;
        scoreText = `You stayed out of the red today saving ₹${netSaved.toLocaleString()}, but fell short of your ₹${savingsTarget.toLocaleString()} goal by ₹${remaining.toLocaleString()}. Check category leaks below.`;
    } else {
        score = "critical";
        badge.textContent = "🚨 Over-Budget Risk";
        badge.classList.add("status-critical");
        scoreText = `Budget Warning! You spent ₹${Math.abs(netSaved).toLocaleString()} more than your logged earnings today. High exposure to impulsive purchases will impact future savings capacity.`;
    }
    
    adviceBox.textContent = scoreText;
    
    // Generate context-aware recommendations
    const adviceTips = [];
    
    // Category specific alerts
    if (categoryTotals["Food & Drinks"] && categoryTotals["Food & Drinks"] > 0.4 * expense) {
        adviceTips.push(`Food & Beverages represents a major chunk (₹${categoryTotals["Food & Drinks"]}) of today's expenditures. Meal planning and reducing take-outs can cut dining costs by 20% next week.`);
    }
    if (categoryTotals["Shopping & Entertainment"] && categoryTotals["Shopping & Entertainment"] > 1000) {
        adviceTips.push(`Logged substantial entertainment costs (₹${categoryTotals["Shopping & Entertainment"]}). Applying a 48-hour delay rule on digital shopping carts saves the average household 15% monthly.`);
    }
    if (categoryTotals["Travel & Commute"] && categoryTotals["Travel & Commute"] > 300) {
        adviceTips.push(`Commuting expenses (₹${categoryTotals["Travel & Commute"]}) registered. Look into public transit cards or carpooling options to trim down regular transportation overheads.`);
    }
    
    // Rule of thumb tips if categories don't trigger
    if (adviceTips.length < 2) {
        adviceTips.push("Secure your savings first: Automatically transfer 15% of periodic earnings to a separate account before scheduling discretionary expenses.");
        adviceTips.push("Beware of microtransactions: Aggregating minor utility subscriptions or daily coffees can secretly drain up to ₹2,500 every month.");
    }
    
    tipsBox.innerHTML = adviceTips.map(tip => `
        <div class="advisor-tip-item">${tip}</div>
    `).join("");
}


// ─── Module 4: Fitness Tracker ──────────────────────────────
function updateFitnessStats() {
    document.getElementById("currentStepsCount").textContent = stepsWalked.toLocaleString();
    document.getElementById("stepsGoalText").textContent = `of ${stepGoal.toLocaleString()} steps`;
    document.getElementById("stepGoalInput").value = stepGoal;
    
    // Calories: ~0.04 kcal per step
    const kcal = stepsWalked * 0.04;
    document.getElementById("caloriesBurnedText").textContent = `${kcal.toFixed(0)} kcal`;
    
    // Distance: ~0.00075 km per step
    const km = stepsWalked * 0.00075;
    document.getElementById("distanceTraveledText").textContent = `${km.toFixed(2)} km`;
    
    const pct = stepGoal > 0 ? Math.min((stepsWalked / stepGoal) * 100, 100) : 0;
    document.getElementById("stepPercentText").textContent = `${pct.toFixed(0)}%`;
    
    updateFitnessProgressCircle();
}

function updateFitnessProgressCircle() {
    const circle = document.getElementById("stepsProgressCircle");
    if (!circle) return;
    
    const radius = 90;
    const circ = 2 * Math.PI * radius; // 565.48
    
    const pct = stepGoal > 0 ? Math.min(stepsWalked / stepGoal, 1) : 0;
    const offset = circ - (pct * circ);
    
    circle.style.strokeDasharray = `${circ} ${circ}`;
    circle.style.strokeDashoffset = offset;
}

// Log Steps Submit
document.getElementById("stepsForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const stepsInput = document.getElementById("manualStepsInput");
    const count = Number(stepsInput.value);
    
    if (count <= 0 || isNaN(count)) {
        alert("Steps must be positive!");
        return;
    }
    
    stepsWalked += count;
    saveState();
    updateFitnessStats();
    stepsInput.value = "";
});

// Quick log buttons
document.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const val = Number(btn.dataset.add);
        stepsWalked += val;
        saveState();
        updateFitnessStats();
    });
});

document.getElementById("saveStepGoalBtn").addEventListener("click", () => {
    const val = Number(document.getElementById("stepGoalInput").value);
    if (val <= 0 || isNaN(val)) {
        alert("Step goal must be positive!");
        return;
    }
    stepGoal = val;
    saveState();
    updateFitnessStats();
});

document.getElementById("resetStepsBtn").addEventListener("click", () => {
    if (!confirm("Reset step counters back to zero for today?")) return;
    stepsWalked = 0;
    saveState();
    updateFitnessStats();
});


// ─── Module 5: Habit Tracker ────────────────────────────────
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getThisWeekDates() {
    const now = new Date();
    const day = now.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMon = day === 0 ? -6 : 1 - day; // offset to current Monday
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        // Format as YYYY-MM-DD local
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
}

function calculateStreak(habit) {
    let streak = 0;
    const today = new Date();
    
    const getFormatted = (offset) => {
        const d = new Date(today);
        d.setDate(today.getDate() - offset);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };
    
    // Check backwards from today
    let offset = 0;
    // If today is incomplete, we can start evaluating streak from yesterday
    const todayStr = getFormatted(0);
    const yesterdayStr = getFormatted(1);
    
    if (!habit.history[todayStr] && !habit.history[yesterdayStr]) {
        return 0;
    }
    
    if (!habit.history[todayStr] && habit.history[yesterdayStr]) {
        offset = 1; // start from yesterday
    }
    
    while (true) {
        const dateStr = getFormatted(offset);
        if (habit.history[dateStr] === true) {
            streak++;
            offset++;
        } else {
            break;
        }
    }
    return streak;
}

function renderHabits() {
    const tbody = document.getElementById("habitsTableBody");
    const weekDates = getThisWeekDates();
    
    // Render dynamic date numbers in headers Mon-Sun
    const headers = document.querySelectorAll(".habit-table thead th");
    weekDates.forEach((dateString, i) => {
        // i+1 because first th is 'Habit'
        if (headers[i + 1]) {
            const dateNum = new Date(dateString).getDate();
            headers[i + 1].innerHTML = `${WEEKDAYS[i]}<br><span style="font-size: 10px; color: var(--text-muted);">${dateNum}</span>`;
        }
    });
    
    if (habits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state" style="text-align:center;">No habits created yet. Build one on the left!</td></tr>`;
        return;
    }
    
    tbody.innerHTML = habits.map(habit => {
        const streak = calculateStreak(habit);
        
        const checksHTML = weekDates.map(dateStr => {
            const isChecked = habit.history[dateStr] === true;
            return `
                <td>
                    <div class="habit-day-check ${isChecked ? "checked" : ""}" 
                         onclick="toggleHabitDay('${habit.id}', '${dateStr}')"></div>
                </td>
            `;
        }).join("");
        
        return `
            <tr id="habit-${habit.id}">
                <td>
                    <div class="habit-info-cell">
                        <span class="habit-title-text">${escapeHTML(habit.name)}</span>
                        <span class="habit-cat-text">📁 ${escapeHTML(habit.category)}</span>
                    </div>
                </td>
                ${checksHTML}
                <td>
                    <span class="habit-streak-badge">🔥 ${streak}d</span>
                </td>
                <td>
                    <button class="delete-btn" onclick="deleteHabit('${habit.id}')" title="Delete Habit">✖</button>
                </td>
            </tr>
        `;
    }).join("");
}

document.getElementById("habitForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const nameInput = document.getElementById("habitNameInput");
    const catInput = document.getElementById("habitCategoryInput");
    const name = nameInput.value.trim();
    if (!name) return;
    
    const habit = {
        id: Date.now().toString(),
        name,
        category: catInput.value,
        history: {}, // holds "YYYY-MM-DD": true
        createdAt: Date.now()
    };
    
    habits.push(habit);
    saveState();
    renderHabits();
    
    nameInput.value = "";
});

function toggleHabitDay(id, dateStr) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    
    if (habit.history[dateStr]) {
        delete habit.history[dateStr];
    } else {
        habit.history[dateStr] = true;
    }
    
    saveState();
    renderHabits();
}

function deleteHabit(id) {
    if (!confirm("Are you sure you want to delete this habit and all history?")) return;
    habits = habits.filter(h => h.id !== id);
    saveState();
    renderHabits();
}

// ─── Utility Helpers ────────────────────────────────────────
function formatTime12Hour(time24) {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    const h = Number(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${minutes} ${ampm}`;
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// ─── Theme System ─────────────────────────────────────────────
function initTheme() {
    const savedTheme = localStorage.getItem("aura_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("aura_theme", newTheme);
    alarmSound.playShortPing();
}

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("aura_theme")) {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    }
});

document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

// ─── Initialization ─────────────────────────────────────────
initTheme();
updateNotifBanner();
updateClock();

// ─── Authentication System ───────────────────────────────────
// Self-contained, industry-style auth built on the Web Crypto API:
//  - PBKDF2 (120,000 iterations, SHA-256) with random per-user salts
//  - Password hashes only ever stored — never plaintext
//  - Per-user data isolation (no cross-account leakage)
//  - Persistent sessions with automatic expiry
// Runs entirely client-side; no API keys or external backend required.

const AUTH_USERS_KEY = "aura_auth_users";
const AUTH_SESSION_KEY = "aura_auth_session";
const AUTH_SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getAuthUsers() {
    try {
        const raw = localStorage.getItem(AUTH_USERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error("Failed to read auth store:", err);
        return [];
    }
}

function setAuthUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function toHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

async function generateSalt() {
    return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashPassword(password, saltHex) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: fromHex(saltHex), iterations: 120000, hash: "SHA-256" },
        keyMaterial,
        256
    );
    return toHex(new Uint8Array(bits));
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const authModal = document.getElementById("authModal");
const appDashboard = document.getElementById("appDashboard");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authToggleBtn = document.getElementById("authToggleBtn");
const authToggleText = document.getElementById("authToggleText");
const authError = document.getElementById("authError");
const logoutBtn = document.getElementById("logoutBtn");

let isSignUp = false;

authToggleBtn.addEventListener("click", () => {
    isSignUp = !isSignUp;
    authTitle.textContent = isSignUp ? "Create Account" : "Welcome Back";
    authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Sign In";
    authToggleText.textContent = isSignUp ? "Already have an account? " : "Don't have an account? ";
    authToggleBtn.textContent = isSignUp ? "Sign In" : "Sign Up";
    authError.textContent = "";
    authForm.reset();
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    const password = document.getElementById("authPassword").value;

    authError.textContent = "Loading...";

    if (!isValidEmail(email)) {
        authError.textContent = "Please enter a valid email address.";
        return;
    }

    if (isSignUp && password.length < 8) {
        authError.textContent = "Password must be at least 8 characters long.";
        return;
    }

    if (!crypto.subtle) {
        authError.textContent = "Secure login is unavailable in this browser. Use a modern browser.";
        return;
    }

    try {
        const users = getAuthUsers();
        const existing = users.find(u => u.email === email);

        if (isSignUp) {
            if (existing) {
                authError.textContent = "An account with this email already exists. Please sign in.";
                return;
            }
            const salt = await generateSalt();
            const hash = await hashPassword(password, salt);
            users.push({
                uid: "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10),
                email: email,
                salt: salt,
                hash: hash,
                createdAt: Date.now()
            });
            setAuthUsers(users);
        } else {
            if (!existing) {
                authError.textContent = "No account found with this email. Please sign up first.";
                return;
            }
            const hash = await hashPassword(password, existing.salt);
            if (hash !== existing.hash) {
                authError.textContent = "Incorrect password. Please try again.";
                return;
            }
        }

        startSession(getAuthUsers().find(u => u.email === email));
    } catch (err) {
        console.error("Authentication error:", err);
        authError.textContent = "Something went wrong. Please try again.";
    }
});

function startSession(user) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        uid: user.uid,
        email: user.email,
        issuedAt: Date.now()
    }));
    showAuthenticatedApp(user);
}

function showAuthenticatedApp(user) {
    currentUser = user;
    authModal.classList.add("hidden");
    appDashboard.classList.remove("app-hidden");
    authForm.reset();
    authError.textContent = "";
    loadUserData(user.uid);
}

function showGuestView() {
    currentUser = null;
    localStorage.removeItem(AUTH_SESSION_KEY);
    authModal.classList.remove("hidden");
    appDashboard.classList.add("app-hidden");
    authForm.reset();
    authError.textContent = "";

    tasks = [];
    dayPlan = [];
    transactions = [];
    habits = [];
    savingsTarget = 500;
    stepGoal = 10000;
    stepsWalked = 0;
    renderAll();
}

function loadUserData(uid) {
    try {
        const raw = localStorage.getItem(`aura_data_${uid}`);
        const data = raw ? JSON.parse(raw) : null;
        if (data) {
            tasks = data.aura_tasks || [];
            dayPlan = data.aura_dayplan || [];
            transactions = data.aura_transactions || [];
            savingsTarget = data.aura_savings_target || 500;
            stepGoal = data.aura_step_goal || 10000;
            stepsWalked = data.aura_steps_walked || 0;
            habits = data.aura_habits || [];
        }
    } catch (err) {
        console.error("Failed to load user data:", err);
    }
    renderAll();
}

function renderAll() {
    renderTasks();
    renderDayPlan();
    renderTransactions();
    updateFitnessStats();
    renderHabits();
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => showGuestView());
}

// Restore a previously open session on page load
(function restoreSession() {
    if (!crypto.subtle) {
        authError.textContent = "Secure login is unavailable in this browser. Use a modern browser.";
        return;
    }
    try {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) return;
        const session = JSON.parse(raw);
        if (Date.now() - session.issuedAt > AUTH_SESSION_TTL) {
            localStorage.removeItem(AUTH_SESSION_KEY);
            return;
        }
        const user = getAuthUsers().find(u => u.uid === session.uid);
        if (!user) {
            localStorage.removeItem(AUTH_SESSION_KEY);
            return;
        }
        showAuthenticatedApp(user);
    } catch (err) {
        localStorage.removeItem(AUTH_SESSION_KEY);
    }
})();