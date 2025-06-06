// Sample data - This would typically come from a database or API
const teams = [
    { id: 1, name: 'Team Alpha', points: 1200 },
    { id: 2, name: 'Team Beta', points: 1150 },
    { id: 3, name: 'Team Gamma', points: 980 },
    { id: 4, name: 'Team Delta', points: 850 },
    { id: 5, name: 'Team Epsilon', points: 720 }
];

const individuals = [
    { id: 1, name: 'John Smith', team: 'Team Alpha', points: 450 },
    { id: 2, name: 'Sarah Johnson', team: 'Team Beta', points: 420 },
    { id: 3, name: 'Mike Brown', team: 'Team Gamma', points: 380 },
    { id: 4, name: 'Emma Davis', team: 'Team Delta', points: 350 },
    { id: 5, name: 'Alex Wilson', team: 'Team Epsilon', points: 320 }
];

// Function to sort and display team rankings
function displayTeamRankings() {
    const teamRankings = document.getElementById('teamRankings');
    const sortedTeams = [...teams].sort((a, b) => b.points - a.points);
    
    teamRankings.innerHTML = sortedTeams.map((team, index) => `
        <div class="team-rank">
            <span class="rank">#${index + 1}</span>
            <span class="name">${team.name}</span>
            <span class="points">${team.points} pts</span>
        </div>
    `).join('');
}

// Function to sort and display individual rankings
function displayIndividualRankings() {
    const individualRankings = document.getElementById('individualRankings');
    const sortedIndividuals = [...individuals].sort((a, b) => b.points - a.points);
    
    individualRankings.innerHTML = sortedIndividuals.map((individual, index) => `
        <div class="individual-rank">
            <span class="rank">#${index + 1}</span>
            <span class="name">${individual.name}</span>
            <span class="team">${individual.team}</span>
            <span class="points">${individual.points} pts</span>
        </div>
    `).join('');
}

// Initialize the leaderboard
function initLeaderboard() {
    displayTeamRankings();
    displayIndividualRankings();
}

// Call the initialization function when the page loads
document.addEventListener('DOMContentLoaded', initLeaderboard); 