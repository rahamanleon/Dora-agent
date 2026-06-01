require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const chatRoutes = require('./routes/chat');
const toolRoutes = require('./routes/tools');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for Web UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/chat', chatRoutes);
app.use('/tools', toolRoutes);

// Web UI root — serve index.html at /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    aiProvider: config.activeProvider,
    availableProviders: config.getAvailableProviders()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB, load tools, and start server
const toolRegistry = require('./services/toolRegistry');

async function start() {
  try {
    // Load tools on startup
    await toolRegistry.loadTools();
    console.log(`Tools loaded: ${toolRegistry.list().join(', ')}`);

    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    // Start server — respect PORT env var (Render sets this) or config
    const PORT = process.env.PORT || config.server.port;
    app.listen(PORT, () => {
      console.log(`Dora API running on port ${PORT}`);
      console.log(`Web UI:       http://localhost:${PORT}`);
      console.log(`API:          http://localhost:${PORT}/chat`);
      console.log(`AI Provider:  ${config.activeProvider}`);
      console.log(`Available:   ${config.getAvailableProviders().join(', ')}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
