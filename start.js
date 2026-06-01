#!/usr/bin/env node
/**
 * Dora AI API - Startup wrapper
 * Changes to the correct directory so dotenv finds .env
 */
const path = require('path');
const appDir = path.resolve(__dirname);
process.chdir(appDir);

// Load .env
require('dotenv').config();

// Set a timeout for MongoDB connection
const mongoose = require('mongoose');
const origConnect = mongoose.connect.bind(mongoose);
mongoose.connect = function(uri, opts) {
  console.log(`[DORA] MongoDB connecting...`);
  return origConnect(uri, opts).catch(err => {
    console.warn(`[DORA] MongoDB unavailable: ${err.message}`);
    console.warn(`[DORA] Starting WITHOUT database (features limited)`);
    return Promise.resolve();
  });
};

// Start the app
require('./src/app');
