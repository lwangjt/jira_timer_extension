// JIRA Focus Timer - Popup Script
let timerInterval;
let isTimerRunning = false;
let selectedTask = null;
let ongoingTaskKey = null;

// DOM elements
const taskList = document.getElementById("task-list");
const taskDetails = document.getElementById("task-details");
const timerSection = document.getElementById("timer-section");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const timerDisplay = document.getElementById("timer-display");
const timerSlider = document.getElementById("timer-slider");
const timerValue = document.getElementById("timer-value");
const status = document.getElementById("status");
const userGreeting = document.getElementById("user-greeting");
const statusFilter = document.getElementById("status-filter");
const priorityFilter = document.getElementById("priority-filter");

// Mock JIRA data
const mockUser = {
  name: "Lisa Wang",
  email: "lisa.wang@company.com",
  department: "Engineering"
};

const mockTasks = [
  {
    key: "ECOM-456",
    summary: "Implement shopping cart abandonment email workflow",
    description: "Build automated email sequence to re-engage customers who abandon their shopping carts. Include personalized product recommendations and limited-time discount offers. Integrate with current email marketing platform and track conversion metrics.",
    status: { name: "In Progress", color: "#0052cc" },
    priority: { name: "High", color: "#ff5630" },
    assignee: mockUser,
    reporter: { name: "Marketing Team" },
    created: "2025-07-25",
    updated: "2025-07-31",
    estimatedHours: 8,
    loggedHours: 3.5
  },
  {
    key: "ECOM-457", 
    summary: "Add multi-language support for checkout process",
    description: "Implement internationalization for the entire checkout flow including payment forms, shipping options, and confirmation pages. Support for Spanish, French, and German initially. Ensure proper currency conversion and local payment methods.",
    status: { name: "To Do", color: "#42526e" },
    priority: { name: "Medium", color: "#ffab00" },
    assignee: mockUser,
    reporter: { name: "Product Manager" },
    created: "2025-07-28",
    updated: "2025-07-30",
    estimatedHours: 16,
    loggedHours: 0
  },
  {
    key: "ECOM-458",
    summary: "Fix mobile payment gateway integration issues",
    description: "Resolve critical bugs in mobile payment processing. Users report failed transactions on iOS Safari and Android Chrome. Investigate third-party payment provider API changes and update integration accordingly. High priority due to revenue impact.",
    status: { name: "In Review", color: "#0065ff" },
    priority: { name: "Critical", color: "#de350b" },
    assignee: mockUser,
    reporter: { name: "Customer Support" },
    created: "2025-07-29",
    updated: "2025-07-31",
    estimatedHours: 6,
    loggedHours: 4.5
  },
  {
    key: "ECOM-459",
    summary: "Create customer loyalty points system",
    description: "Design and implement a comprehensive loyalty rewards program. Customers earn points for purchases, referrals, and social media engagement. Points can be redeemed for discounts, free shipping, or exclusive products. Include admin dashboard for program management.",
    status: { name: "To Do", color: "#42526e" },
    priority: { name: "Low", color: "#36b37e" },
    assignee: mockUser,
    reporter: { name: "Business Development" },
    created: "2025-07-30",
    updated: "2025-07-30",
    estimatedHours: 24,
    loggedHours: 0
  },
  {
    key: "ECOM-460",
    summary: "Optimize product search and filtering performance",
    description: "Improve search response times and filtering capabilities on the product catalog page. Implement elasticsearch integration, faceted search, and smart autocomplete suggestions. Target sub-200ms response times for better user experience.",
    status: { name: "In Progress", color: "#0052cc" },
    priority: { name: "Medium", color: "#ffab00" },
    assignee: mockUser,
    reporter: { name: "UX Research" },
    created: "2025-07-26",
    updated: "2025-07-31",
    estimatedHours: 12,
    loggedHours: 7.0
  },
  {
    key: "ECOM-461",
    summary: "Implement inventory management alerts",
    description: "Build real-time inventory tracking system with automated alerts for low stock, out-of-stock, and reorder points. Include email notifications to procurement team and integration with supplier APIs for automatic reordering of fast-moving items.",
    status: { name: "Ready for Testing", color: "#00875a" },
    priority: { name: "High", color: "#ff5630" },
    assignee: mockUser,
    reporter: { name: "Operations Team" },
    created: "2025-07-24",
    updated: "2025-07-31",
    estimatedHours: 10,
    loggedHours: 9.5
  }
];

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  loadUserInfo();
  loadTasks();
  setupEventListeners();
  checkTimerState();
  loadCurrentTask(); // Fetch and display the current task
});

function loadUserInfo() {
  userGreeting.textContent = `Hello, ${mockUser.name}`;
}

function loadTasks() {
  const statusFilterValue = statusFilter.value;
  const priorityFilterValue = priorityFilter.value;
  
  // Filter tasks based on selected filters
  const filteredTasks = mockTasks.filter(task => {
    const statusMatch = !statusFilterValue || task.status.name === statusFilterValue;
    const priorityMatch = !priorityFilterValue || task.priority.name === priorityFilterValue;
    return statusMatch && priorityMatch;
  });
  
  taskList.innerHTML = "";
  
  filteredTasks.forEach(task => {
    const taskElement = document.createElement("div");
    taskElement.className = "task-item";
    taskElement.dataset.taskKey = task.key;
    
    // Add ongoing class if this task is currently being tracked
    if (ongoingTaskKey === task.key) {
      taskElement.classList.add('ongoing');
    }
    
    taskElement.innerHTML = `
      <div class="task-key">${task.key}</div>
      <div class="task-summary">${task.summary}</div>
      <div class="task-status" style="background-color: ${task.status.color}20; color: ${task.status.color}">
        ${task.status.name}
      </div>
      <div class="ongoing-indicator">TIMER ACTIVE</div>
    `;
    
    taskElement.addEventListener('click', () => selectTask(task));
    taskList.appendChild(taskElement);
  });
  
  // Show message if no tasks match filters
  if (filteredTasks.length === 0) {
    taskList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-style: italic;">No tasks match the selected filters</div>';
  }
}

function selectTask(task) {
  selectedTask = task;
  
  // Update UI to show selected task
  document.querySelectorAll('.task-item').forEach(item => {
    item.classList.remove('active');
  });
  
  document.querySelector(`[data-task-key="${task.key}"]`).classList.add('active');
  
  // Show task details
  showTaskDetails(task);
  
  // Show timer section
  timerSection.style.display = 'block';
}

function showTaskDetails(task) {
  const progressPercentage = task.estimatedHours > 0 ? 
    Math.round((task.loggedHours / task.estimatedHours) * 100) : 0;
  
  taskDetails.innerHTML = `
    <h3>${task.key}: ${task.summary}</h3>
    <div class="task-description">${task.description}</div>
    
    <div class="task-meta">
      <div class="meta-item">
        <div class="meta-label">Status</div>
        <div class="meta-value" style="color: ${task.status.color}">${task.status.name}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Priority</div>
        <div class="meta-value" style="color: ${task.priority.color}">${task.priority.name}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Reporter</div>
        <div class="meta-value">${task.reporter.name}</div>
      </div>
    </div>
    
    <div class="task-meta">
      <div class="meta-item">
        <div class="meta-label">Estimated</div>
        <div class="meta-value">${task.estimatedHours}h</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Logged</div>
        <div class="meta-value">${task.loggedHours}h</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Progress</div>
        <div class="meta-value">${progressPercentage}%</div>
      </div>
    </div>
  `;
}

function setupEventListeners() {
  // Timer slider
  timerSlider.addEventListener('input', function() {
    timerValue.textContent = this.value;
  });
  
  // Filter event listeners
  statusFilter.addEventListener('change', loadTasks);
  priorityFilter.addEventListener('change', loadTasks);
  
  // Start button
  startBtn.addEventListener('click', function() {
    if (!selectedTask) {
      alert('Please select a task first!');
      return;
    }
    
    const duration = parseInt(timerSlider.value);
    startFocusSession(duration);
  });
  
  // Stop button
  stopBtn.addEventListener('click', function() {
    stopFocusSession();
  });
  
  // Calendar block selection
  document.getElementById("schedule-blocks").addEventListener("click", () => {
    const selectedBlocks = [];
    document.querySelectorAll("#block-list input:checked").forEach(input => {
      const index = input.getAttribute("data-index");
      selectedBlocks.push(suggestedBlocks[index]);
    });

    chrome.runtime.sendMessage({ command: "SCHEDULE_MULTIPLE_FOCUS_BLOCKS", blocks: selectedBlocks }, (response) => {
      if (response.status === "Focus blocks scheduled") {
        alert("Focus blocks scheduled successfully!");
      }
    });
  });
  
  document.addEventListener("DOMContentLoaded", () => {
    const toggleCalendarButton = document.getElementById("toggle-calendar");
    const calendarContainer = document.getElementById("calendar-container");
    const calendarDiv = document.getElementById("calendar");

    if (!toggleCalendarButton || !calendarContainer || !calendarDiv) {
      console.error("Required elements not found in the DOM.");
      return;
    }

    // Toggle the calendar view
    toggleCalendarButton.addEventListener("click", () => {
      console.log("Toggle Calendar button clicked."); // Debugging log

      if (calendarContainer.style.display === "none" || calendarContainer.style.display === "") {
        console.log("Showing calendar."); // Debugging log
        calendarContainer.style.display = "block";
        toggleCalendarButton.textContent = "Hide Calendar";

        // Fetch and display scheduled focus blocks
        chrome.storage.local.get({ scheduledBlocks: [] }, (data) => {
          console.log("Fetched scheduled blocks:", data.scheduledBlocks); // Debugging log
          calendarDiv.innerHTML = ""; // Clear existing content
          if (data.scheduledBlocks.length === 0) {
            calendarDiv.textContent = "No focus blocks scheduled.";
          } else {
            data.scheduledBlocks.forEach(block => {
              const blockDiv = document.createElement("div");
              blockDiv.textContent = `${new Date(block.start).toLocaleString()} - ${new Date(block.end).toLocaleString()}`;
              calendarDiv.appendChild(blockDiv);
            });
          }
        });
      } else {
        console.log("Hiding calendar."); // Debugging log
        calendarContainer.style.display = "none";
        toggleCalendarButton.textContent = "View Calendar";
      }
    });
  });
}

function loadCurrentTask() {
  taskDetails.innerHTML = '<p>Loading...</p>'; // Show loading message initially

  chrome.runtime.sendMessage({ command: "GET_CURRENT_TASK" }, (response) => {
    if (response.status === "Task retrieved" && response.task) {
      const task = response.task;
      // Update the UI with the current task
      taskDetails.innerHTML = `
        <h3>${task.key}: ${task.summary}</h3>
        <p>Duration: ${task.duration} minutes</p>
        <p>Started: ${new Date(task.startTime).toLocaleTimeString()}</p>
      `;
      timerSection.style.display = 'block'; // Ensure the timer section is visible
    } else {
      taskDetails.innerHTML = '<p>No active task</p>';
      timerSection.style.display = 'none'; // Hide the timer section if no task
    }
  });
}

function startFocusSession(duration) {
  if (!selectedTask) return;
  
  // Set the ongoing task
  ongoingTaskKey = selectedTask.key;
  
  // Send message to background script
  chrome.runtime.sendMessage({ 
    command: "START_FOCUS", 
    duration: duration,
    taskKey: selectedTask.key,
    taskSummary: selectedTask.summary
  }, (response) => {
    if (response && response.status) {
      console.log(response.status);
      isTimerRunning = true;
      startTimer(duration * 60 * 1000); // Convert minutes to milliseconds
      status.textContent = `Focusing on ${selectedTask.key}`;
      startBtn.disabled = true;
      timerSlider.disabled = true;
      
      // Refresh task list to show ongoing indicator
      loadTasks();
    }
  });
}

function stopFocusSession() {
  chrome.runtime.sendMessage({ command: "STOP_FOCUS" }, (response) => {
    if (response && response.status) {
      console.log(response.status);
      stopTimer();
      status.textContent = "Focus stopped";
      startBtn.disabled = false;
      timerSlider.disabled = false;
      
      // Clear ongoing task
      ongoingTaskKey = null;
      
      // Refresh task list to remove ongoing indicator
      loadTasks();
    }
  });
}

function startTimer(duration) {
  let timeLeft = duration;
  
  timerInterval = setInterval(() => {
    timeLeft -= 1000;
    
    if (timeLeft <= 0) {
      stopTimer();
      status.textContent = "Focus session completed!";
      startBtn.disabled = false;
      timerSlider.disabled = false;
      
      // Clear ongoing task
      ongoingTaskKey = null;
      
      // Log time to task (in real implementation, this would update JIRA)
      logTimeToTask(selectedTask, parseInt(timerSlider.value));
      
      // Refresh task list to remove ongoing indicator
      loadTasks();
      return;
    }
    
    updateTimerDisplay(timeLeft);
  }, 1000);
  
  updateTimerDisplay(timeLeft);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isTimerRunning = false;
  timerDisplay.textContent = "00:00";
}

function updateTimerDisplay(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function logTimeToTask(task, minutes) {
  // In a real implementation, this would make an API call to JIRA to log work
  console.log(`Logged ${minutes} minutes to task ${task.key}: ${task.summary}`);
  
  // Update the logged hours locally for demo purposes
  task.loggedHours += (minutes / 60);
  
  // Show success message
  status.textContent = `Logged ${minutes}min to ${task.key}`;
  
  // Refresh the task details to show updated logged time
  if (selectedTask && selectedTask.key === task.key) {
    showTaskDetails(task);
  }
  
  setTimeout(() => {
    status.textContent = "Ready to start focusing";
  }, 3000);
}

function checkTimerState() {
  chrome.storage.local.get(['focusActive', 'focusEndTime', 'focusTask', 'taskData'], function(result) {
    if (result.focusActive && result.focusEndTime) {
      const timeLeft = result.focusEndTime - Date.now();
      if (timeLeft > 0) {
        isTimerRunning = true;

        // Set ongoing task
        if (result.taskData) {
          ongoingTaskKey = result.taskData.key;
          status.textContent = `Currently working on: ${result.taskData.key} - ${result.taskData.summary}`;
          selectTask(result.taskData); // Ensure task details are displayed
          startTimer(timeLeft);
        } else {
          console.warn("Task data not found in storage.");
          status.textContent = "Currently working on: Loading...";
        }
      }
    } else {
      status.textContent = "No active focus session.";
    }
  });
}
