// Sample data - This would typically come from a database or API
const individuals = [
    { id: 1, name: 'John Smith', points: 450 },
    { id: 2, name: 'Sarah Johnson', points: 420 },
    { id: 3, name: 'Mike Brown', points: 380 },
    { id: 4, name: 'Emma Davis', points: 350 },
    { id: 5, name: 'Alex Wilson', points: 320 }
];

// Function to sort and display individual rankings
function displayIndividualRankings() {
    const individualRankings = document.getElementById('individualRankings');
    const sortedIndividuals = [...individuals].sort((a, b) => b.points - a.points);
    
    individualRankings.innerHTML = sortedIndividuals.map((individual, index) => `
        <div class="individual-rank">
            <span class="rank">#${index + 1}</span>
            <span class="name">${individual.name}</span>
            <span class="points">${individual.points} pts</span>
        </div>
    `).join('');
}

// Initialize the leaderboard
function initLeaderboard() {
    displayIndividualRankings();
}

// Call the initialization function when the page loads
document.addEventListener('DOMContentLoaded', initLeaderboard); 