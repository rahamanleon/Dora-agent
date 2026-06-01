const path = require('path');
const fs = require('fs');
const nm = path.join(__dirname, 'node_modules');

// Read the test file to understand what stringToParts should do
const testPath = path.join(nm, 'mpath/test/stringToParts.js');
const testContent = fs.readFileSync(testPath, 'utf8');
console.log('Test file content:');
console.log(testContent);
