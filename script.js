// Get data from local storage or use default data
let individuals = JSON.parse(localStorage.getItem('leaderboardData')) || [
    { id: 1, name: 'John Smith', points: 450, activity: 'Training session' },
    { id: 2, name: 'Sarah Johnson', points: 420, activity: 'First aid certification' },
    { id: 3, name: 'Mike Brown', points: 380, activity: 'Swim test' },
    { id: 4, name: 'Emma Davis', points: 350, activity: 'Rescue practice' },
    { id: 5, name: 'Alex Wilson', points: 320, activity: 'CPR training' }
];

// Function to save data to local storage
function saveData() {
    localStorage.setItem('leaderboardData', JSON.stringify(individuals));
}

// Function to sort and display individual rankings
function displayIndividualRankings() {
    const individualRankings = document.getElementById('individualRankings');
    const sortedIndividuals = [...individuals].sort((a, b) => b.points - a.points);
    
    individualRankings.innerHTML = sortedIndividuals.map((individual, index) => `
        <div class="individual-rank">
            <span class="rank">#${index + 1}</span>
            <span class="name">${individual.name}</span>
            <span class="points">${individual.points} pts</span>
            <div class="activity">${individual.activity || ''}</div>
        </div>
    `).join('');
}

// Function to handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const points = parseInt(document.getElementById('points').value);
    const activity = document.getElementById('activity').value;
    
    // Check if person already exists
    const existingIndex = individuals.findIndex(person => person.name.toLowerCase() === name.toLowerCase());
    
    if (existingIndex !== -1) {
        // Update existing person
        individuals[existingIndex].points += points;
        if (activity) {
            individuals[existingIndex].activity = activity;
        }
    } else {
        // Add new person
        const newId = Math.max(...individuals.map(p => p.id), 0) + 1;
        individuals.push({
            id: newId,
            name: name,
            points: points,
            activity: activity
        });
    }
    
    // Save to local storage and update display
    saveData();
    displayIndividualRankings();
    
    // Reset form
    event.target.reset();
}

// Initialize the leaderboard
function initLeaderboard() {
    displayIndividualRankings();
    
    // Add form submit handler
    const form = document.getElementById('editForm');
    form.addEventListener('submit', handleFormSubmit);
}

// Call the initialization function when the page loads
document.addEventListener('DOMContentLoaded', initLeaderboard); 