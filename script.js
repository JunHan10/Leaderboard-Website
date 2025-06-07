// Constants
const STORAGE_KEY = 'redLobstersLeaderboard';
const MAX_MEMBERS = 14;
const MAX_NAME_LENGTH = 50;
const MAX_ACTIVITY_LENGTH = 200;
const MAX_POINTS = 10000;
const MIN_NAME_LENGTH = 2;
const MIN_POINTS = 0;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CSRF_TOKEN = generateCSRFToken();
const RATE_LIMIT = {
    points: {
        maxRequests: 10,
        timeWindow: 60 * 1000, // 1 minute
        storageKey: 'pointsRateLimit'
    }
};

// Admin password handling
function getAdminPassword() {
    // This would typically come from a secure backend server
    // For now, we'll use a more secure storage method
    const storedHash = localStorage.getItem('adminPasswordHash');
    if (!storedHash) {
        // First time setup - store the hashed password
        const password = '81880'; // This should be changed to your desired password
        const hash = btoa(password); // Basic encoding - in production, use proper hashing
        localStorage.setItem('adminPasswordHash', hash);
        return hash;
    }
    return storedHash;
}

function verifyAdminPassword(inputPassword) {
    const storedHash = getAdminPassword();
    const inputHash = btoa(inputPassword);
    return storedHash === inputHash;
}

// Predefined point system
const POINT_SYSTEM = [
    // Positive Points
    { activity: "Saved someone", points: 12 },
    { activity: "Passed VAT", points: 5 },
    { activity: "Picked up a shift", points: 3 },
    { activity: "Received compliment or comment card", points: 5 },
    { activity: "Took initiative noticed by HG", points: 2 },
    { activity: "Manager recognition", points: 5 },
    { activity: "Dressed up for party or dress up day", points: 4 },
    { activity: "Brought treats for entire shift", points: 5 },
    //{ activity: "4+ team members attend group exercise", points: 8 },
    //{ activity: "6+ team members attend group exercise", points: 10 },
    { activity: "Attended team event builder", points: 10 },
    //{ activity: "Team wins an event", points: 5 },
    { activity: "Attended 2nd monthly inservice", points: 2 },
    { activity: "Attended non-scheduled Y function", points: 5 },
    
    // Negative Points
    { activity: "Failed VAT", points: -10 },
    { activity: "Negative member comment", points: -5 },
    { activity: "Clocked in late or early", points: -3 },
    { activity: "Failed to enforce rule noticed by HG", points: -2 }
];

// Security helper functions
function generateCSRFToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/[<>'"]/g, '') // Remove HTML tags and quotes
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .replace(/data:/gi, '') // Remove data: protocol
        .replace(/vbscript:/gi, '') // Remove vbscript: protocol
        .replace(/file:/gi, '') // Remove file: protocol
        .replace(/about:/gi, '') // Remove about: protocol
        .replace(/blob:/gi, '') // Remove blob: protocol
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/&/g, '&amp;') // HTML encode ampersands
        .replace(/\+/g, '&#43;') // HTML encode plus signs
        .trim();
}

function validateName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Check for minimum length
    if (name.length < MIN_NAME_LENGTH) return false;
    
    // Check for maximum length
    if (name.length > MAX_NAME_LENGTH) return false;
    
    // Check for valid characters
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) return false;
    
    // Check for whitespace-only
    if (/^\s*$/.test(name)) return false;
    
    // Check for consecutive spaces
    if (/\s{2,}/.test(name)) return false;
    
    // Check for leading/trailing spaces
    if (name !== name.trim()) return false;
    
    return true;
}

function validatePoints(points) {
    // Check if it's a number
    if (typeof points !== 'number' && isNaN(Number(points))) return false;
    
    // Convert to number if it's a string
    const numPoints = Number(points);
    
    // Check if it's an integer
    if (!Number.isInteger(numPoints)) return false;
    
    // Check range
    if (numPoints < MIN_POINTS || numPoints > MAX_POINTS) return false;
    
    return true;
}

function validateActivity(activity) {
    if (!activity) return true; // Activity is optional
    
    if (typeof activity !== 'string') return false;
    
    // Check length
    if (activity.length > MAX_ACTIVITY_LENGTH) return false;
    
    // Check for valid characters
    if (!/^[a-zA-Z0-9\s\-_.,!?]+$/.test(activity)) return false;
    
    // Check for consecutive spaces
    if (/\s{2,}/.test(activity)) return false;
    
    // Check for leading/trailing spaces
    if (activity !== activity.trim()) return false;
    
    return true;
}

function checkSessionTimeout() {
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity && Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT) {
        handleAdminLogout();
        return true;
    }
    return false;
}

function updateLastActivity() {
    localStorage.setItem('lastActivity', Date.now().toString());
}

// DOM Elements
const individualRankings = document.getElementById('individualRankings');
const editForm = document.getElementById('editForm');
const adminSection = document.getElementById('adminSection');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminModal = document.getElementById('adminModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const removeMemberSelect = document.getElementById('removeMemberSelect');
const removeMemberBtn = document.getElementById('removeMemberBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
const memberSelect = document.getElementById('memberSelect');
const memberDetails = document.getElementById('memberDetails');
const nameInput = document.getElementById('name');
const nameSuggestions = document.getElementById('nameSuggestions');

// State
let isAdminLoggedIn = false;
let leaderboardData = loadLeaderboardData();
let selectedSuggestionIndex = -1;
let selectedActivitySuggestionIndex = -1;
let sessionCheckInterval;

// Initialize
async function init() {
    try {
        const startTime = performance.now();
        
        // Wait for Firebase to be ready
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // Test Firebase connection
                await testFirebaseConnection();
                break; // If successful, break the loop
            } catch (error) {
                retryCount++;
                console.log(`Connection attempt ${retryCount} failed:`, error);
                
                if (retryCount === maxRetries) {
                    throw new Error('Failed to connect to Firebase after multiple attempts');
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Set CSRF token
        document.getElementById('csrfToken').value = CSRF_TOKEN;
        
        // Initialize point system
        initializePointSystem();
        
        // Ensure admin section is hidden on page load
        adminSection.style.display = 'none';
        adminLoginBtn.style.display = 'block';
        
        // Load initial data
        await loadLeaderboardData();
        
        // Set up event listeners
        setupEventListeners();
        
        // Start session check
        startSessionCheck();
        
        // Add backup controls
        addBackupControls();
        
        const endTime = performance.now();
        console.log(`Initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
        console.error('Error during initialization:', error);
        showNotification('Error initializing application: ' + error.message, 'error');
        
        // Show a more user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <h2>Connection Error</h2>
            <p>Unable to connect to the database. Please try the following:</p>
            <ul>
                <li>Check your internet connection</li>
                <li>Refresh the page</li>
                <li>If the problem persists, contact support</li>
            </ul>
        `;
        document.querySelector('.container').prepend(errorMessage);
    }
}

function startSessionCheck() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    sessionCheckInterval = setInterval(() => {
        if (checkSessionTimeout()) {
            clearInterval(sessionCheckInterval);
        }
    }, 60000); // Check every minute
}

// Load data from Firebase with real-time updates
function loadLeaderboardData() {
    const startTime = performance.now();
    console.log('Loading data from Firebase...');
    return new Promise((resolve) => {
        // Set up real-time listener
        database.ref('leaderboard').on('value', (snapshot) => {
            const data = snapshot.val() || [];
            const endTime = performance.now();
            console.log('Data received from Firebase:', data);
            console.log(`Data updated in ${(endTime - startTime).toFixed(2)}ms`);
            
            // Update the leaderboard data
            leaderboardData = data;
            
            // Update the UI
            renderLeaderboard();
            updateRemoveMemberSelect();
            updateMemberSelect();
            updateTeamTotal();
            
            // If a member is currently selected, update their details
            const currentMember = memberSelect.value;
            if (currentMember) {
                displayMemberDetails(currentMember);
            }
            
            resolve(data);
        }, (error) => {
            console.error('Error loading data:', error);
        });
    });
}

// Save data to Firebase
function saveLeaderboardData() {
    const startTime = performance.now();
    console.log('Saving data to Firebase:', leaderboardData);
    return new Promise((resolve, reject) => {
        try {
            // Validate data before saving
            if (!Array.isArray(leaderboardData)) {
                throw new Error('Invalid data structure');
            }
            
            // Validate each entry and ensure points are numbers
            const validData = leaderboardData.map(entry => {
                if (!entry || typeof entry !== 'object') return null;
                if (!entry.name || !validateName(entry.name)) return null;
                if (!Array.isArray(entry.activities)) return null;
                
                // Validate activities and ensure points are numbers
                const validActivities = entry.activities.map(activity => {
                    if (!activity || typeof activity !== 'object') return null;
                    const points = Number(activity.points);
                    if (isNaN(points)) return null;
                    return {
                        points: points,
                        description: activity.description,
                        timestamp: activity.timestamp
                    };
                }).filter(activity => activity !== null);
                
                return {
                    name: entry.name,
                    activities: validActivities
                };
            }).filter(entry => entry !== null);
            
            console.log('Validated data to save:', validData);
            
            // First, get existing data
            database.ref('leaderboard').once('value', (snapshot) => {
                const existingData = snapshot.val() || [];
                console.log('Existing data:', existingData);
                
                // Merge new data with existing data
                const mergedData = Array.isArray(existingData) ? existingData : [];
                validData.forEach(newEntry => {
                    const existingIndex = mergedData.findIndex(entry => 
                        entry.name.toLowerCase() === newEntry.name.toLowerCase()
                    );
                    
                    if (existingIndex !== -1) {
                        // Update existing entry
                        mergedData[existingIndex] = newEntry;
                    } else {
                        // Add new entry
                        mergedData.push(newEntry);
                    }
                });
                
                console.log('Merged data to save:', mergedData);
                
                // Save merged data to Firebase
                database.ref('leaderboard').set(mergedData, (error) => {
                    if (error) {
                        console.error('Error saving to Firebase:', error);
                        reject(error);
                    } else {
                        const endTime = performance.now();
                        console.log('Data successfully saved to Firebase');
                        console.log(`Data saved in ${(endTime - startTime).toFixed(2)}ms`);
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('Error in saveLeaderboardData:', error);
            reject(error);
        }
    });
}

// Calculate total points for a member
function calculateTotalPoints(activities) {
    if (!Array.isArray(activities)) return 0;
    let total = 0;
    activities.forEach(activity => {
        const points = Number(activity.points);
        if (!isNaN(points)) {
            total += points;
        }
    });
    return total;
}

// Calculate and update team total points
function updateTeamTotal() {
    const teamTotal = leaderboardData.reduce((total, member) => {
        return total + calculateTotalPoints(member.activities || []);
    }, 0);
    
    const teamTotalElement = document.getElementById('teamTotalPoints');
    teamTotalElement.textContent = teamTotal;
    
    // Add animation class
    teamTotalElement.classList.add('points-updated');
    setTimeout(() => {
        teamTotalElement.classList.remove('points-updated');
    }, 500);
}

// Render the leaderboard
function renderLeaderboard() {
    individualRankings.innerHTML = '';
    
    // Sort by total points in descending order
    const sortedData = [...leaderboardData].sort((a, b) => 
        calculateTotalPoints(b.activities || []) - calculateTotalPoints(a.activities || [])
    );
    
    sortedData.forEach((entry, index) => {
        const rank = index + 1;
        const totalPoints = calculateTotalPoints(entry.activities || []);
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        // Create text nodes instead of using innerHTML
        const rankSpan = document.createElement('span');
        rankSpan.className = 'rank';
        rankSpan.textContent = `#${rank}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = sanitizeInput(entry.name);
        
        const pointsSpan = document.createElement('span');
        pointsSpan.className = `points ${totalPoints < 0 ? 'negative' : ''}`;
        pointsSpan.textContent = `${totalPoints} points`;
        
        rankingItem.appendChild(rankSpan);
        rankingItem.appendChild(nameSpan);
        rankingItem.appendChild(pointsSpan);
        
        individualRankings.appendChild(rankingItem);
    });
}

// Update the member select dropdown
function updateMemberSelect() {
    memberSelect.innerHTML = '<option value="">Select a team member...</option>';
    leaderboardData.forEach(entry => {
        const option = document.createElement('option');
        option.value = sanitizeInput(entry.name);
        option.textContent = sanitizeInput(entry.name);
        memberSelect.appendChild(option);
    });
}

// Update the remove member select dropdown
function updateRemoveMemberSelect() {
    removeMemberSelect.innerHTML = '<option value="">Select a team member...</option>';
    leaderboardData.forEach(entry => {
        const option = document.createElement('option');
        option.value = sanitizeInput(entry.name);
        option.textContent = sanitizeInput(entry.name);
        removeMemberSelect.appendChild(option);
    });
}

// Display member details
function displayMemberDetails(memberName) {
    const member = leaderboardData.find(entry => entry.name === memberName);
    if (!member) {
        memberDetails.innerHTML = '<div class="no-activities">No member selected</div>';
        return;
    }

    const totalPoints = calculateTotalPoints(member.activities || []);
    const activities = member.activities || [];

    // Create elements instead of using innerHTML
    const memberInfo = document.createElement('div');
    memberInfo.className = 'member-info';
    
    const nameHeader = document.createElement('h3');
    nameHeader.textContent = sanitizeInput(member.name);
    
    const totalPointsDiv = document.createElement('div');
    totalPointsDiv.className = 'total-points';
    totalPointsDiv.textContent = `Total Points: ${totalPoints > 0 ? '+' : ''}${totalPoints}`;
    
    memberInfo.appendChild(nameHeader);
    memberInfo.appendChild(totalPointsDiv);

    const activityLog = document.createElement('div');
    activityLog.className = 'activity-log';

    if (activities.length > 0) {
        // Group activities by description
        const groupedActivities = activities.reduce((groups, activity) => {
            const key = activity.description;
            if (!groups[key]) {
                groups[key] = {
                    description: key,
                    points: activity.points,
                    count: 1,
                    latestTimestamp: activity.timestamp
                };
            } else {
                groups[key].count++;
                // Keep the most recent timestamp
                if (new Date(activity.timestamp) > new Date(groups[key].latestTimestamp)) {
                    groups[key].latestTimestamp = activity.timestamp;
                }
            }
            return groups;
        }, {});

        // Convert to array and sort by most recent
        const sortedActivities = Object.values(groupedActivities)
            .sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp));
        
        sortedActivities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            const description = document.createElement('span');
            description.className = 'description';
            description.textContent = sanitizeInput(activity.description);
            
            const points = document.createElement('span');
            points.className = 'points';
            const totalPoints = activity.points * activity.count;
            points.textContent = `${totalPoints > 0 ? '+' : ''}${totalPoints} points`;
            points.style.color = totalPoints >= 0 ? 'var(--success-color)' : 'var(--error-color)';
            
            const count = document.createElement('span');
            count.className = 'count';
            count.textContent = activity.count > 1 ? `x${activity.count}` : '';
            
            const dateIcon = document.createElement('span');
            dateIcon.className = 'date-icon';
            dateIcon.innerHTML = '📅';
            dateIcon.title = new Date(activity.latestTimestamp).toLocaleDateString();
            
            activityItem.appendChild(description);
            activityItem.appendChild(count);
            activityItem.appendChild(points);
            activityItem.appendChild(dateIcon);
            activityLog.appendChild(activityItem);
        });
    } else {
        const noActivities = document.createElement('div');
        noActivities.className = 'no-activities';
        noActivities.textContent = 'No activities yet - Add points to see activity history';
        activityLog.appendChild(noActivities);
    }

    memberDetails.innerHTML = '';
    memberDetails.appendChild(memberInfo);
    memberDetails.appendChild(activityLog);
}

// Show name suggestions
function showNameSuggestions(input) {
    const value = input.toLowerCase();
    const suggestions = leaderboardData
        .filter(entry => entry.name.toLowerCase().includes(value))
        .map(entry => entry.name);

    nameSuggestions.innerHTML = '';
    
    if (suggestions.length > 0 && value.length > 0) {
        suggestions.forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = suggestion;
            div.addEventListener('click', () => {
                nameInput.value = suggestion;
                nameSuggestions.style.display = 'none';
            });
            nameSuggestions.appendChild(div);
        });
        nameSuggestions.style.display = 'block';
    } else {
        nameSuggestions.style.display = 'none';
    }
}

// Handle keyboard navigation for suggestions
function handleSuggestionNavigation(e) {
    const items = nameSuggestions.getElementsByClassName('suggestion-item');
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            break;
        case 'Enter':
            e.preventDefault();
            if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
                nameInput.value = items[selectedSuggestionIndex].textContent;
                nameSuggestions.style.display = 'none';
            }
            return;
        case 'Escape':
            nameSuggestions.style.display = 'none';
            selectedSuggestionIndex = -1;
            return;
        default:
            return;
    }

    // Update selected item
    Array.from(items).forEach((item, index) => {
        item.classList.toggle('selected', index === selectedSuggestionIndex);
    });
}

// Show activity suggestions
function showActivitySuggestions(input) {
    const value = input.toLowerCase();
    const suggestions = POINT_SYSTEM
        .filter(item => item.activity.toLowerCase().includes(value))
        .map(item => ({
            text: `${item.activity} (${item.points > 0 ? '+' : ''}${item.points} points)`,
            activity: item.activity,
            points: item.points
        }));

    const activitySuggestions = document.getElementById('activitySuggestions');
    activitySuggestions.innerHTML = '';
    
    if (suggestions.length > 0 && value.length > 0) {
        suggestions.forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = suggestion.text;
            div.setAttribute('data-activity', suggestion.activity);
            div.addEventListener('click', () => {
                document.getElementById('activity').value = suggestion.activity;
                activitySuggestions.style.display = 'none';
            });
            activitySuggestions.appendChild(div);
        });
        activitySuggestions.style.display = 'block';
    } else {
        activitySuggestions.style.display = 'none';
    }
}

// Handle keyboard navigation for activity suggestions
function handleActivitySuggestionNavigation(e) {
    const items = document.getElementById('activitySuggestions').getElementsByClassName('suggestion-item');
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedActivitySuggestionIndex = Math.min(selectedActivitySuggestionIndex + 1, items.length - 1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            selectedActivitySuggestionIndex = Math.max(selectedActivitySuggestionIndex - 1, -1);
            break;
        case 'Enter':
            e.preventDefault();
            if (selectedActivitySuggestionIndex >= 0 && items[selectedActivitySuggestionIndex]) {
                const activity = items[selectedActivitySuggestionIndex].getAttribute('data-activity');
                document.getElementById('activity').value = activity;
                document.getElementById('activitySuggestions').style.display = 'none';
            }
            return;
        case 'Escape':
            document.getElementById('activitySuggestions').style.display = 'none';
            selectedActivitySuggestionIndex = -1;
            return;
        default:
            return;
    }

    // Update selected item
    Array.from(items).forEach((item, index) => {
        item.classList.toggle('selected', index === selectedActivitySuggestionIndex);
    });
}

// Rate limiting functions
function checkRateLimit(type) {
    const limit = RATE_LIMIT[type];
    if (!limit) return true;

    const now = Date.now();
    const rateLimitData = JSON.parse(localStorage.getItem(limit.storageKey) || '{"requests":[],"blockedUntil":0}');

    // Check if currently blocked
    if (rateLimitData.blockedUntil > now) {
        return false;
    }

    // Remove old requests
    rateLimitData.requests = rateLimitData.requests.filter(time => now - time < limit.timeWindow);

    // Check if over limit
    if (rateLimitData.requests.length >= limit.maxRequests) {
        rateLimitData.blockedUntil = now + limit.timeWindow;
        localStorage.setItem(limit.storageKey, JSON.stringify(rateLimitData));
        return false;
    }

    // Add new request
    rateLimitData.requests.push(now);
    localStorage.setItem(limit.storageKey, JSON.stringify(rateLimitData));
    return true;
}

function getRateLimitStatus(type) {
    const limit = RATE_LIMIT[type];
    if (!limit) return null;

    const now = Date.now();
    const rateLimitData = JSON.parse(localStorage.getItem(limit.storageKey) || '{"requests":[],"blockedUntil":0}');

    if (rateLimitData.blockedUntil > now) {
        return {
            blocked: true,
            remainingTime: Math.ceil((rateLimitData.blockedUntil - now) / 1000)
        };
    }

    return {
        blocked: false,
        remainingRequests: limit.maxRequests - rateLimitData.requests.length
    };
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove notification after animation
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show loading indicator
function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'flex';
}

// Hide loading indicator
function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'none';
}

// Animate points update
function animatePointsUpdate(element) {
    element.classList.add('points-updated');
    setTimeout(() => {
        element.classList.remove('points-updated');
    }, 500);
}

// Setup event listeners
function setupEventListeners() {
    // Quick Add buttons
    document.querySelectorAll('.quick-add-btn').forEach(button => {
        button.addEventListener('click', () => {
            const activity = button.getAttribute('data-activity');
            const points = parseInt(button.getAttribute('data-points'));
            
            // Set the activity in the form
            document.getElementById('activity').value = activity;
            
            // Focus on the name input if it's empty
            const nameInput = document.getElementById('name');
            if (!nameInput.value) {
                nameInput.focus();
            } else {
                // If name is already filled, submit the form
                document.getElementById('editForm').dispatchEvent(new Event('submit'));
            }
        });
    });

    // Name input autocomplete
    nameInput.addEventListener('input', (e) => {
        showNameSuggestions(e.target.value);
        selectedSuggestionIndex = -1;
    });

    nameInput.addEventListener('keydown', handleSuggestionNavigation);

    // Activity input autocomplete
    const activityInput = document.getElementById('activity');
    activityInput.addEventListener('input', (e) => {
        showActivitySuggestions(e.target.value);
        selectedActivitySuggestionIndex = -1;
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!nameInput.contains(e.target) && !nameSuggestions.contains(e.target)) {
            nameSuggestions.style.display = 'none';
        }
        if (!activityInput.contains(e.target) && !document.getElementById('activitySuggestions').contains(e.target)) {
            document.getElementById('activitySuggestions').style.display = 'none';
        }
    });

    // Form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Check rate limit
        if (!checkRateLimit('points')) {
            const status = getRateLimitStatus('points');
            showNotification(`Too many requests. Please wait ${status.remainingTime} seconds before trying again.`, 'error');
            return;
        }

        // Verify CSRF token
        const formToken = document.getElementById('csrfToken').value;
        if (formToken !== CSRF_TOKEN) {
            showNotification('Invalid form submission. Please refresh the page and try again.', 'error');
            return;
        }

        const name = sanitizeInput(document.getElementById('name').value.trim());
        const activity = sanitizeInput(document.getElementById('activity').value.trim());
        
        if (!validateName(name)) {
            showNotification(`Invalid name. Please use only letters, numbers, spaces, hyphens, and underscores. Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`, 'error');
            return;
        }

        if (name) {
            showLoading();
            
            try {
                const existingIndex = leaderboardData.findIndex(entry => entry.name.toLowerCase() === name.toLowerCase());
                
                if (existingIndex !== -1) {
                    // Update existing member - require activity
                    if (!activity) {
                        showNotification('Please select an activity for the existing member.', 'error');
                        return;
                    }
                    
                    // Find the selected activity's points
                    const activityData = POINT_SYSTEM.find(a => a.activity.toLowerCase() === activity.toLowerCase());
                    if (!activityData) {
                        showNotification('Please select a valid activity from the suggestions.', 'error');
                        return;
                    }
                    
                    const points = Number(activityData.points);
                    
                    // Update existing member
                    if (!leaderboardData[existingIndex].activities) {
                        leaderboardData[existingIndex].activities = [];
                    }
                    const newActivity = {
                        points: points,
                        description: activity,
                        timestamp: new Date().toISOString()
                    };
                    leaderboardData[existingIndex].activities.push(newActivity);
                    
                    // Force a save and update
                    await saveLeaderboardData();
                    renderLeaderboard();
                    updateRemoveMemberSelect();
                    updateMemberSelect();
                    
                    // Show appropriate message based on points
                    if (points > 0) {
                        showNotification(`+${points} points added for ${name}!`, 'success');
                    } else {
                        showNotification(`${points} points deducted from ${name}!`, 'error');
                    }
                    
                    // Update member details immediately
                    displayMemberDetails(name);
                    
                    // Clear the form
                    editForm.reset();
                    nameSuggestions.style.display = 'none';
                    document.getElementById('activitySuggestions').style.display = 'none';
                } else {
                    // Check if we've reached the member limit
                    if (leaderboardData.length >= MAX_MEMBERS) {
                        showNotification(`Cannot add more members. Maximum limit of ${MAX_MEMBERS} members reached.`, 'error');
                        return;
                    }
                    
                    // Add new member - activity is optional
                    const newMember = {
                        name,
                        activities: []
                    };
                    
                    // If activity is provided, add it
                    if (activity) {
                        const activityData = POINT_SYSTEM.find(a => a.activity.toLowerCase() === activity.toLowerCase());
                        if (activityData) {
                            newMember.activities.push({
                                points: activityData.points,
                                description: activity,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    
                    leaderboardData.push(newMember);
                    showNotification(`Welcome ${name} to the leaderboard!`, 'success');
                    
                    await saveLeaderboardData();
                    renderLeaderboard();
                    updateRemoveMemberSelect();
                    updateMemberSelect();
                    
                    // Update member details if this member is currently selected
                    const currentMember = memberSelect.value;
                    if (currentMember === name) {
                        displayMemberDetails(name);
                    }
                    
                    editForm.reset();
                    nameSuggestions.style.display = 'none';
                    document.getElementById('activitySuggestions').style.display = 'none';
                }
                
                // Animate points update
                const rankingItem = document.querySelector(`.ranking-item .name[data-name="${name}"]`);
                if (rankingItem) {
                    animatePointsUpdate(rankingItem.closest('.ranking-item'));
                }
            } catch (error) {
                showNotification('An error occurred. Please try again.', 'error');
                console.error('Error:', error);
            } finally {
                hideLoading();
            }
        }
    });

    // Member select change
    memberSelect.addEventListener('change', (e) => {
        displayMemberDetails(e.target.value);
    });

    // Admin login
    adminLoginBtn.addEventListener('click', () => {
        adminModal.style.display = 'block';
    });

    // Close modal
    closeModalBtn.addEventListener('click', () => {
        adminModal.style.display = 'none';
    });

    // Admin login form
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        
        if (verifyAdminPassword(password)) {
            isAdminLoggedIn = true;
            adminSection.style.display = 'block';
            adminModal.style.display = 'none';
            adminLoginBtn.style.display = 'none';
            localStorage.setItem('adminLoggedIn', 'true');
            startSessionCheck();
            showNotification('Admin login successful!', 'success');
        } else {
            showNotification('Incorrect password!', 'error');
        }
        
        adminLoginForm.reset();
    });

    // Remove member
    removeMemberBtn.addEventListener('click', () => {
        if (!isAdminLoggedIn) {
            showNotification('Please log in as admin to remove members.', 'error');
            return;
        }
        const selectedName = removeMemberSelect.value;
        if (selectedName && confirm(`Are you sure you want to remove ${sanitizeInput(selectedName)}?`)) {
            showLoading();
            try {
                leaderboardData = leaderboardData.filter(entry => entry.name !== selectedName);
                saveLeaderboardData();
                renderLeaderboard();
                updateRemoveMemberSelect();
                updateMemberSelect();
                memberDetails.innerHTML = '<div class="no-activities">No member selected</div>';
                showNotification(`Member ${selectedName} has been removed.`, 'success');
            } catch (error) {
                showNotification('An error occurred while removing the member.', 'error');
                console.error('Error:', error);
            } finally {
                hideLoading();
            }
        }
    });

    // Reset data
    resetDataBtn.addEventListener('click', () => {
        if (!isAdminLoggedIn) {
            showNotification('Please log in as admin to reset data.', 'error');
            return;
        }
        if (confirm('Are you sure you want to reset all data? This cannot be undone!')) {
            showLoading();
            try {
                leaderboardData = [];
                saveLeaderboardData();
                renderLeaderboard();
                updateRemoveMemberSelect();
                updateMemberSelect();
                memberDetails.innerHTML = '<div class="no-activities">No member selected</div>';
                showNotification('All data has been reset.', 'success');
            } catch (error) {
                showNotification('An error occurred while resetting data.', 'error');
                console.error('Error:', error);
            } finally {
                hideLoading();
            }
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === adminModal) {
            adminModal.style.display = 'none';
        }
    });

    // Add logout functionality
    window.addEventListener('beforeunload', () => {
        if (isAdminLoggedIn) {
            handleAdminLogout();
        }
    });

    // Add activity tracking for session timeout
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keypress', updateLastActivity);

    // Add hover effect for ranking items
    individualRankings.addEventListener('mouseover', (e) => {
        const rankingItem = e.target.closest('.ranking-item');
        if (rankingItem) {
            const name = rankingItem.querySelector('.name').textContent;
            displayMemberDetails(name);
        }
    });

    // Add click effect for ranking items
    individualRankings.addEventListener('click', (e) => {
        const rankingItem = e.target.closest('.ranking-item');
        if (rankingItem) {
            const name = rankingItem.querySelector('.name').textContent;
            memberSelect.value = name;
            displayMemberDetails(name);
        }
    });

    // Add keyboard navigation for suggestions
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = nameSuggestions.getElementsByClassName('suggestion-item');
            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            
            if (e.key === 'ArrowDown') {
                const nextIndex = (currentIndex + 1) % items.length;
                if (currentIndex >= 0) items[currentIndex].classList.remove('selected');
                items[nextIndex].classList.add('selected');
            } else {
                const prevIndex = (currentIndex - 1 + items.length) % items.length;
                if (currentIndex >= 0) items[currentIndex].classList.remove('selected');
                items[prevIndex].classList.add('selected');
            }
        } else if (e.key === 'Enter') {
            const selectedItem = nameSuggestions.querySelector('.suggestion-item.selected');
            if (selectedItem) {
                nameInput.value = selectedItem.textContent;
                nameSuggestions.style.display = 'none';
            }
        }
    });

    // Add keyboard navigation for activity suggestions
    const activitySuggestions = document.getElementById('activitySuggestions');
    activityInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = activitySuggestions.getElementsByClassName('suggestion-item');
            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            
            if (e.key === 'ArrowDown') {
                const nextIndex = (currentIndex + 1) % items.length;
                if (currentIndex >= 0) items[currentIndex].classList.remove('selected');
                items[nextIndex].classList.add('selected');
            } else {
                const prevIndex = (currentIndex - 1 + items.length) % items.length;
                if (currentIndex >= 0) items[currentIndex].classList.remove('selected');
                items[prevIndex].classList.add('selected');
            }
        } else if (e.key === 'Enter') {
            const selectedItem = activitySuggestions.querySelector('.suggestion-item.selected');
            if (selectedItem) {
                activityInput.value = selectedItem.getAttribute('data-activity');
                activitySuggestions.style.display = 'none';
            }
        }
    });

    // Add form validation feedback
    editForm.addEventListener('input', (e) => {
        const input = e.target;
        if (input.id === 'name') {
            if (!validateName(input.value)) {
                input.style.borderColor = 'var(--error-color)';
            } else {
                input.style.borderColor = 'var(--border-color)';
            }
        }
    });
}

// Handle admin logout
function handleAdminLogout() {
    isAdminLoggedIn = false;
    adminSection.style.display = 'none';
    adminLoginBtn.style.display = 'block';
    localStorage.removeItem('adminLoggedIn');
}

// Initialize point system dropdown
function initializePointSystem() {
    const activitySelect = document.getElementById('activity');
    activitySelect.innerHTML = '<option value="">Select an activity...</option>';
    
    POINT_SYSTEM.forEach(item => {
        const option = document.createElement('option');
        option.value = item.activity;
        option.textContent = `${item.activity} (${item.points} points)`;
        activitySelect.appendChild(option);
    });
}

// Backup and restore functions
function backupLeaderboardData() {
    try {
        const data = JSON.stringify(leaderboardData);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leaderboard_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Backup created successfully!', 'success');
    } catch (error) {
        console.error('Backup failed:', error);
        showNotification('Failed to create backup.', 'error');
    }
}

function restoreLeaderboardData(file) {
    try {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data) && data.every(entry => 
                    entry.name && 
                    Array.isArray(entry.activities) && 
                    entry.activities.every(activity => 
                        typeof activity.points === 'number' && 
                        activity.timestamp
                    )
                )) {
                    leaderboardData = data;
                    saveLeaderboardData();
                    renderLeaderboard();
                    updateRemoveMemberSelect();
                    updateMemberSelect();
                    showNotification('Data restored successfully!', 'success');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                console.error('Invalid backup file:', error);
                showNotification('Invalid backup file format.', 'error');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('Restore failed:', error);
        showNotification('Failed to restore data.', 'error');
    }
}

// Add backup/restore buttons to admin section
function addBackupControls() {
    const adminControls = document.querySelector('.admin-controls');
    
    const backupSection = document.createElement('div');
    backupSection.className = 'backup-section';
    
    const backupBtn = document.createElement('button');
    backupBtn.textContent = 'Backup Data';
    backupBtn.className = 'backup-btn';
    backupBtn.onclick = backupLeaderboardData;
    
    const restoreInput = document.createElement('input');
    restoreInput.type = 'file';
    restoreInput.accept = '.json';
    restoreInput.style.display = 'none';
    restoreInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            restoreLeaderboardData(e.target.files[0]);
        }
    };
    
    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = 'Restore Data';
    restoreBtn.className = 'restore-btn';
    restoreBtn.onclick = () => restoreInput.click();
    
    backupSection.appendChild(backupBtn);
    backupSection.appendChild(restoreInput);
    backupSection.appendChild(restoreBtn);
    adminControls.appendChild(backupSection);
}

// Test Firebase connection
function testFirebaseConnection() {
    console.log('Testing Firebase connection...');
    return new Promise((resolve, reject) => {
        try {
            // First check if Firebase is initialized
            if (!window.database) {
                throw new Error('Firebase database not initialized');
            }

            // Set a timeout for the connection test
            const timeout = setTimeout(() => {
                reject(new Error('Firebase connection timeout'));
            }, 10000); // 10 second timeout

            // Test database connection
            const connectedRef = database.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    console.log('Connected to Firebase!');
                    clearTimeout(timeout);
                    
                    // Test database access
                    database.ref('leaderboard').once('value')
                        .then((snapshot) => {
                            console.log('Current database state:', snapshot.val());
                            showNotification('Connected to database successfully!', 'success');
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error('Error accessing database:', error);
                            showNotification('Database access failed: ' + error.message, 'error');
                            reject(error);
                        });
                } else {
                    console.log('Not connected to Firebase');
                    showNotification('Database connection failed', 'error');
                    reject(new Error('Not connected to Firebase'));
                }
            }, (error) => {
                console.error('Firebase connection error:', error);
                clearTimeout(timeout);
                showNotification('Database connection error: ' + error.message, 'error');
                reject(error);
            });
        } catch (error) {
            console.error('Error in testFirebaseConnection:', error);
            showNotification('Error testing database connection: ' + error.message, 'error');
            reject(error);
        }
    });
}

// Initialize the app
init(); 