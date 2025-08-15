// script.js

// ========= LOGIN PAGE LOGIC =========
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('loginIdentifier').value.trim();
        const password = document.getElementById('loginPassword').value;
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('loggedInUser', data.username);
            window.location.href = 'todo.html';
        } else {
            document.getElementById('loginError').textContent = data.message || "Login failed!";
        }
    };
}

// ========= REGISTER PAGE LOGIC =========
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const dob = document.getElementById('dob').value;
        const gender = document.getElementById('gender').value;

        // Client-side form validations
        if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !dob || !gender) {
            document.getElementById('registerError').textContent = "Please fill all fields.";
            return;
        }
        if (password !== confirmPassword) {
            document.getElementById('registerError').textContent = "Passwords do not match!";
            return;
        }

        const res = await fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, username, email, password, dob, gender })
        });
        const data = await res.json();
        if (res.ok) {
            window.location.href = "index.html"; // Redirect to login
        } else {
            document.getElementById('registerError').textContent = data.message || "Registration failed!";
        }
    };
}

// ========= TODO DASHBOARD LOGIC =========
// The following code works on todo.html, after login
const logoutBtn = document.getElementById('logout-btn');
const todoSection = document.getElementById('todo-section');
const welcomeUser = document.getElementById('welcome-user');
const themeSelector = document.getElementById('theme-selector');
const taskInput = document.getElementById('task-input');
const taskDesc = document.getElementById('task-desc');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const authSection = document.getElementById('auth-section');
let currentUser = localStorage.getItem('loggedInUser') || null;

function renderTasks() {
    if (!currentUser || !taskList) return;
    let tasks = JSON.parse(localStorage.getItem(`${currentUser}-tasks`)) || [];
    taskList.innerHTML = "";
    tasks.forEach((task, index) => {
        let li = document.createElement('li');
        li.className = `task ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <div>
                <strong>${task.name}</strong>
                <p>${task.description}</p>
            </div>
            <div>
                <button onclick="editTask(${index})">Edit</button>
                <button onclick="toggleComplete(${index})">${task.completed ? 'Undo' : 'Complete'}</button>
                <button onclick="deleteTask(${index})">Delete</button>
            </div>
        `;
        taskList.appendChild(li);
    });
}

function saveTasks(tasks) {
    if (currentUser)
        localStorage.setItem(`${currentUser}-tasks`, JSON.stringify(tasks));
}

window.editTask = function(index) {
    let tasks = JSON.parse(localStorage.getItem(`${currentUser}-tasks`)) || [];
    let newName = prompt("Edit task:", tasks[index].name);
    let newDesc = prompt("Edit description:", tasks[index].description);
    if (newName) tasks[index].name = newName;
    if (newDesc !== null) tasks[index].description = newDesc;
    saveTasks(tasks);
    renderTasks();
};

window.toggleComplete = function(index) {
    let tasks = JSON.parse(localStorage.getItem(`${currentUser}-tasks`)) || [];
    tasks[index].completed = !tasks[index].completed;
    saveTasks(tasks);
    renderTasks();
};

window.deleteTask = function(index) {
    let tasks = JSON.parse(localStorage.getItem(`${currentUser}-tasks`)) || [];
    tasks.splice(index, 1);
    saveTasks(tasks);
    renderTasks();
};

if (addTaskBtn) {
    addTaskBtn.onclick = function() {
        let taskName = taskInput.value.trim();
        let desc = taskDesc.value.trim();
        if (!taskName) return alert("Enter a task");
        let tasks = JSON.parse(localStorage.getItem(`${currentUser}-tasks`)) || [];
        tasks.push({ name: taskName, description: desc, completed: false });
        saveTasks(tasks);
        taskInput.value = "";
        taskDesc.value = "";
        renderTasks();
    };
}

if (themeSelector) {
    themeSelector.onchange = function() {
        document.body.className = `theme-${themeSelector.value}`;
        localStorage.setItem('theme', themeSelector.value);
    };
}

if (logoutBtn) {
    logoutBtn.onclick = function() {
        localStorage.removeItem('loggedInUser');
        window.location.href = "index.html";
    };
}

// Load Todo dashboard after login
if (currentUser && todoSection) {
    if (authSection) authSection.style.display = "none";
    todoSection.style.display = "block";
    welcomeUser.textContent = `Hello, ${currentUser}! 👋`;
    themeSelector.value = localStorage.getItem('theme') || 'white';
    document.body.className = `theme-${themeSelector.value}`;
    renderTasks();
}
