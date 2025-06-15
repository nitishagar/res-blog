#!/usr/bin/env node
/**
 * Node.js test runner for the portfolio website
 * Usage: node test.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test results
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
};

// Helper functions
function log(message, color = colors.reset) {
    console.log(color + message + colors.reset);
}

function pass(testName, message) {
    testResults.total++;
    testResults.passed++;
    log(`✓ ${testName}: ${message}`, colors.green);
}

function fail(testName, message) {
    testResults.total++;
    testResults.failed++;
    log(`✗ ${testName}: ${message}`, colors.red);
}

function warn(message) {
    testResults.warnings++;
    log(`⚠ Warning: ${message}`, colors.yellow);
}

function info(message) {
    log(`ℹ ${message}`, colors.cyan);
}

// Test functions
async function testFileExists(filename) {
    const filePath = path.join(__dirname, filename);
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        pass(`File Check: ${filename}`, 'File exists');
        return true;
    } catch {
        fail(`File Check: ${filename}`, 'File not found');
        return false;
    }
}

async function testFileSize(filename, maxSizeKB) {
    const filePath = path.join(__dirname, filename);
    try {
        const stats = await fs.promises.stat(filePath);
        const sizeKB = stats.size / 1024;
        if (sizeKB <= maxSizeKB) {
            pass(`File Size: ${filename}`, `${sizeKB.toFixed(2)}KB (limit: ${maxSizeKB}KB)`);
        } else {
            fail(`File Size: ${filename}`, `${sizeKB.toFixed(2)}KB exceeds limit of ${maxSizeKB}KB`);
        }
        return sizeKB;
    } catch {
        return 0;
    }
}

async function testHTMLContent() {
    const filePath = path.join(__dirname, 'index.html');
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // Check for essential elements
        const checks = [
            { pattern: /<meta.*viewport/i, name: 'Viewport meta tag' },
            { pattern: /<nav/i, name: 'Navigation element' },
            { pattern: /id="about"/i, name: 'About section' },
            { pattern: /id="experience"/i, name: 'Experience section' },
            { pattern: /id="portfolio"/i, name: 'Portfolio section' },
            { pattern: /id="blog"/i, name: 'Blog section' },
            { pattern: /id="contact"/i, name: 'Contact section' },
            { pattern: /nitishagar\.medium\.com/i, name: 'Medium blog integration' },
            { pattern: /nitish\.agarwal@outlook\.com/i, name: 'Email contact' },
            { pattern: /lang="en"/i, name: 'Language attribute' },
            { pattern: /<title>/i, name: 'Page title' }
        ];
        
        checks.forEach(check => {
            if (check.pattern.test(content)) {
                pass(`HTML Content: ${check.name}`, 'Found');
            } else {
                fail(`HTML Content: ${check.name}`, 'Not found');
            }
        });
        
        // Check that phone number is NOT included
        if (!/\+91.*982.*120.*0201/i.test(content)) {
            pass('Privacy Check', 'Phone number properly excluded');
        } else {
            fail('Privacy Check', 'Phone number should be removed');
        }
        
    } catch (error) {
        fail('HTML Content Test', `Error reading file: ${error.message}`);
    }
}

async function testCSS() {
    const filePath = path.join(__dirname, 'styles.css');
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // Check for responsive design
        if (content.includes('@media')) {
            pass('CSS: Responsive Design', 'Media queries found');
        } else {
            warn('CSS: Responsive Design - No media queries found');
        }
        
        // Check for CSS variables
        if (content.includes(':root')) {
            pass('CSS: Modern Features', 'CSS variables used');
        } else {
            info('CSS: Consider using CSS variables for maintainability');
        }
        
    } catch (error) {
        fail('CSS Test', `Error reading file: ${error.message}`);
    }
}

async function testJavaScript() {
    const filePath = path.join(__dirname, 'script.js');
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // Check for key functionality
        const checks = [
            { pattern: /hamburger/i, name: 'Mobile menu functionality' },
            { pattern: /smooth.*scroll/i, name: 'Smooth scrolling' },
            { pattern: /addEventListener/i, name: 'Event listeners' }
        ];
        
        checks.forEach(check => {
            if (check.pattern.test(content)) {
                pass(`JavaScript: ${check.name}`, 'Implemented');
            } else {
                warn(`JavaScript: ${check.name} - Not found`);
            }
        });
        
    } catch (error) {
        fail('JavaScript Test', `Error reading file: ${error.message}`);
    }
}

async function testAmplifyConfig() {
    const filePath = path.join(__dirname, 'amplify.yml');
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        if (content.includes('version: 1')) {
            pass('Amplify Config: Version', 'Valid version specified');
        } else {
            fail('Amplify Config: Version', 'Invalid version');
        }
        
        if (!content.includes('build:')) {
            pass('Amplify Config: Optimization', 'No build phase (optimized for static hosting)');
        } else {
            warn('Amplify Config: Build phase present - may incur additional costs');
        }
        
    } catch (error) {
        fail('Amplify Config Test', `Error reading file: ${error.message}`);
    }
}

async function testGitHubPagesCompatibility() {
    info('Testing GitHub Pages compatibility...');
    
    // Check for index.html
    const indexExists = await fs.promises.access(path.join(__dirname, 'index.html'))
        .then(() => true)
        .catch(() => false);
    
    if (indexExists) {
        pass('GitHub Pages: Entry Point', 'index.html exists');
    } else {
        fail('GitHub Pages: Entry Point', 'index.html required for GitHub Pages');
    }
    
    // Check for .nojekyll file (recommended for GitHub Pages)
    const nojekyllPath = path.join(__dirname, '.nojekyll');
    const nojekyllExists = await fs.promises.access(nojekyllPath)
        .then(() => true)
        .catch(() => false);
    
    if (!nojekyllExists) {
        info('Consider adding .nojekyll file for GitHub Pages');
        // Create it
        try {
            await fs.promises.writeFile(nojekyllPath, '');
            pass('GitHub Pages: .nojekyll', 'Created .nojekyll file');
        } catch (error) {
            warn('Could not create .nojekyll file');
        }
    } else {
        pass('GitHub Pages: .nojekyll', 'File exists');
    }
}

async function testPerformance() {
    info('Testing performance metrics...');
    
    const files = [
        { name: 'index.html', maxSize: 50 },
        { name: 'styles.css', maxSize: 20 },
        { name: 'script.js', maxSize: 10 }
    ];
    
    let totalSize = 0;
    for (const file of files) {
        const size = await testFileSize(file.name, file.maxSize);
        totalSize += size;
    }
    
    if (totalSize < 100) {
        pass('Performance: Total Size', `${totalSize.toFixed(2)}KB - Good for fast loading`);
    } else {
        warn(`Performance: Total Size - ${totalSize.toFixed(2)}KB may impact loading speed`);
    }
}

// Generate coverage report
function generateCoverageReport() {
    console.log('\n' + colors.blue + '═══════════════════════════════════════════════════' + colors.reset);
    console.log(colors.blue + '                 COVERAGE REPORT                    ' + colors.reset);
    console.log(colors.blue + '═══════════════════════════════════════════════════' + colors.reset);
    
    const passRate = testResults.total > 0 
        ? ((testResults.passed / testResults.total) * 100).toFixed(1) 
        : 0;
    
    console.log(`\nTotal Tests: ${testResults.total}`);
    console.log(colors.green + `Passed: ${testResults.passed}` + colors.reset);
    console.log(colors.red + `Failed: ${testResults.failed}` + colors.reset);
    console.log(colors.yellow + `Warnings: ${testResults.warnings}` + colors.reset);
    console.log(`\nPass Rate: ${passRate}%`);
    
    // Visual progress bar
    const barLength = 40;
    const filledLength = Math.round((testResults.passed / testResults.total) * barLength);
    const emptyLength = barLength - filledLength;
    const progressBar = colors.green + '█'.repeat(filledLength) + colors.reset + '░'.repeat(emptyLength);
    console.log(`\nProgress: [${progressBar}] ${passRate}%`);
    
    // Deployment readiness
    console.log('\n' + colors.cyan + 'Deployment Readiness:' + colors.reset);
    if (testResults.failed === 0) {
        console.log(colors.green + '✓ Ready for deployment!' + colors.reset);
        console.log(colors.green + '✓ GitHub Pages compatible' + colors.reset);
        console.log(colors.green + '✓ AWS Amplify compatible' + colors.reset);
    } else {
        console.log(colors.red + '✗ Fix failed tests before deployment' + colors.reset);
    }
    
    console.log('\n' + colors.blue + '═══════════════════════════════════════════════════' + colors.reset);
}

// Main test runner
async function runTests() {
    console.log(colors.blue + '\n🧪 Portfolio Website Test Suite\n' + colors.reset);
    console.log('Running tests...\n');
    
    // Test 1: Check required files
    info('Checking required files...');
    const requiredFiles = ['index.html', 'styles.css', 'script.js', 'amplify.yml', 'server.js', 'package.json'];
    for (const file of requiredFiles) {
        await testFileExists(file);
    }
    
    console.log('');
    
    // Test 2: HTML content tests
    info('Testing HTML content...');
    await testHTMLContent();
    
    console.log('');
    
    // Test 3: CSS tests
    info('Testing CSS...');
    await testCSS();
    
    console.log('');
    
    // Test 4: JavaScript tests
    info('Testing JavaScript...');
    await testJavaScript();
    
    console.log('');
    
    // Test 5: Performance tests
    await testPerformance();
    
    console.log('');
    
    // Test 6: AWS Amplify configuration
    info('Testing AWS Amplify configuration...');
    await testAmplifyConfig();
    
    console.log('');
    
    // Test 7: GitHub Pages compatibility
    await testGitHubPagesCompatibility();
    
    // Generate report
    generateCoverageReport();
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error(colors.red + 'Test runner error: ' + error.message + colors.reset);
    process.exit(1);
});