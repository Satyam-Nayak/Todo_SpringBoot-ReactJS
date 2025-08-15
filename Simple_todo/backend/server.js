const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Path to store users
const usersFile = path.join(__dirname, 'users.json');

// Read users from file
const readUsers = () => {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(usersFile));
};

// Save users to file
const saveUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

// Signup route
app.post('/signup', (req, res) => {
    const { firstName, lastName, username, email, password, dob, gender } = req.body;
    let users = readUsers();

    if (!firstName || !lastName || !username || !email || !password || !dob || !gender) {
        return res.status(400).json({ message: 'All fields required!' });
    }

    // Check for duplicate username or email
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Username already exists!' });
    }
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email already registered!' });
    }

    users.push({ firstName, lastName, username, email, password, dob, gender });
    saveUsers(users);
    res.json({ message: 'Signup successful!' });
});

// Login route (accepts identifier: username OR email, and password)
app.post('/login', (req, res) => {
    const { identifier, password } = req.body;
    let users = readUsers();

    // Find user by username or email and password
    let user = users.find(
        u => (u.username === identifier || u.email === identifier) && u.password === password
    );

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ message: 'Login successful', username: user.username });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
