#!/usr/bin/env node
/**
 * Simple HTTP server for local testing of the portfolio website.
 * Usage: node server.js
 * Then open http://localhost:8000 in your browser
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8000;
const DIRECTORY = __dirname;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Default to index.html for root path
    let filePath = path.join(DIRECTORY, req.url === '/' ? 'index.html' : req.url);
    
    // Get file extension
    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            // Success
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${DIRECTORY}`);
    console.log('Press Ctrl+C to stop the server\n');
    
    // Try to open the browser
    const url = `http://localhost:${PORT}`;
    const start = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    
    setTimeout(() => {
        exec(`${start} ${url}`, (error) => {
            if (error) {
                console.log('Please open your browser and navigate to:', url);
            }
        });
    }, 1000);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n✋ Server stopped');
    process.exit(0);
});