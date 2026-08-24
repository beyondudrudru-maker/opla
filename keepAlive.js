// keepAlive.js
const express = require('express');
const app = express();

// Use the port provided by the host, or default to 3000
const port = process.env.PORT || 3000;

// This route responds to incoming pings (e.g., from UptimeRobot)
app.get('/', (req, res) => {
    res.send('Melody is awake and protecting the clan! 🌸');
});

/**
 * Starts the Express web server to keep the bot alive.
 */
function keepAlive() {
    app.listen(port, () => {
        console.log(`🌐 Keep-Alive web server is running on port ${port}`);
    });
}

// Export the function so it can be used in your main bot file
module.exports = keepAlive;
