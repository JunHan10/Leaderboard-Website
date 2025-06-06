// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZPo_KulnDOOXa_bom1e2xxaDn2rbaQEI",
        authDomain: "red-team-leaderboard.firebaseapp.com",
        databaseURL: "https://red-team-leaderboard-default-rtdb.firebaseio.com",
        projectId: "red-team-leaderboard",
        storageBucket: "red-team-leaderboard.firebasestorage.app",
        messagingSenderId: "739501164037",
        appId: "1:739501164037:web:a1ba49246f4c3ea59ffe6c",
        measurementId: "G-F6TMV87FT2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database(); 