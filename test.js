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
            { pattern: /leadership-snapshot|leadership-card/i, name: 'Leadership snapshot (replaced Experience section in 4bd1e66)' },
            { pattern: /id="portfolio"/i, name: 'Portfolio section' },
            { pattern: /id="blog"/i, name: 'Blog section' },
            { pattern: /id="contact"/i, name: 'Contact section' },
            { pattern: /nitishagar\.medium\.com/i, name: 'Legacy Medium links intact' },
            { pattern: /BLOG-FEED-START[\s\S]*BLOG-FEED-END/, name: 'Publisher feed markers' },
            { pattern: /BLOG-CTA-START[\s\S]*BLOG-CTA-END/, name: 'Publisher CTA markers' },
            { pattern: /rel="canonical"/i, name: 'Canonical link' },
            { pattern: /href="\/blog"/, name: 'Blog index link' },
            { pattern: /class="hamburger"/, name: 'Mobile hamburger' },
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

const SITE_URL = 'https://res-blog.nitishagar.workers.dev';

async function testCloudflareConfig() {
    info('Testing Cloudflare configuration...');

    try {
        const cfg = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'wrangler.jsonc'), 'utf8'));
        if (cfg.name === 'res-blog' && cfg.assets && cfg.assets.directory === '.' && !cfg.main) {
            pass('Cloudflare: wrangler.jsonc', 'Assets-only worker, directory .');
        } else {
            fail('Cloudflare: wrangler.jsonc', 'Expected assets-only config with directory .');
        }
    } catch (error) {
        fail('Cloudflare: wrangler.jsonc', `Unreadable: ${error.message}`);
    }

    try {
        const headers = await fs.promises.readFile(path.join(__dirname, '_headers'), 'utf8');
        const checks = [
            { pattern: /Content-Security-Policy/, name: 'CSP present' },
            { pattern: /fonts\.googleapis\.com/, name: 'Google Fonts style-src' },
            { pattern: /fonts\.gstatic\.com/, name: 'Google Fonts font-src' },
            { pattern: /Strict-Transport-Security/, name: 'HSTS present' },
            { pattern: /^\/posts\/\*$/m, name: 'Posts header block' }
        ];
        checks.forEach(check => {
            if (check.pattern.test(headers)) {
                pass(`Cloudflare: _headers ${check.name}`, 'Found');
            } else {
                fail(`Cloudflare: _headers ${check.name}`, 'Not found');
            }
        });
    } catch (error) {
        fail('Cloudflare: _headers', `Error reading file: ${error.message}`);
    }

    try {
        const redirects = await fs.promises.readFile(path.join(__dirname, '_redirects'), 'utf8');
        if (redirects.includes('/index.html') && redirects.includes(' 301')) {
            pass('Cloudflare: _redirects', 'index.html canonical rule present');
        } else {
            fail('Cloudflare: _redirects', 'Missing /index.html rule');
        }
    } catch (error) {
        fail('Cloudflare: _redirects', `Error reading file: ${error.message}`);
    }

    try {
        const notFound = await fs.promises.readFile(path.join(__dirname, '404.html'), 'utf8');
        if (/noindex/i.test(notFound) && notFound.includes('/#blog') && notFound.includes('class="hamburger"')) {
            pass('Cloudflare: 404.html', 'noindex + writing link + hamburger');
        } else {
            fail('Cloudflare: 404.html', 'Missing noindex, writing link, or hamburger');
        }
    } catch (error) {
        fail('Cloudflare: 404.html', `Error reading file: ${error.message}`);
    }

    try {
        const ignore = await fs.promises.readFile(path.join(__dirname, '.assetsignore'), 'utf8');
        if (ignore.includes('.git/') && ignore.includes('server.js') && ignore.includes('scripts/')) {
            pass('Cloudflare: .assetsignore', 'Dev files and .git excluded');
        } else {
            fail('Cloudflare: .assetsignore', 'Missing exclusions (.git/, server.js, scripts/)');
        }
    } catch (error) {
        fail('Cloudflare: .assetsignore', `Error reading file: ${error.message}`);
    }
}

async function testBlogSystem() {
    info('Testing blog system...');

    const TOKENS = ['TITLE', 'DEK', 'DATE', 'DATE_ISO', 'SERIES_TAG', 'CANONICAL_URL',
        'COVER_URL', 'HERO_FIGURE', 'TAGS_HTML', 'READ_TIME', 'CONTENT_HTML',
        'PREV_LINK', 'NEXT_LINK', 'EA_PUBLISHER'];

    try {
        const template = await fs.promises.readFile(path.join(__dirname, 'scripts/post-template.html'), 'utf8');
        const missing = TOKENS.filter(t => !template.includes(`{{${t}}}`));
        if (missing.length === 0) {
            pass('Blog: post template tokens', `${TOKENS.length} tokens present`);
        } else {
            fail('Blog: post template tokens', `Missing: ${missing.join(', ')}`);
        }
        if (/data-ea-publisher="\{\{EA_PUBLISHER\}\}"/.test(template)) {
            pass('Blog: ad slot in template', 'Publisher-gated div present');
        } else {
            fail('Blog: ad slot in template', 'Missing gated ad-slot div');
        }
        if ((template.match(/href="\/blog"/g) || []).length >= 2) {
            pass('Blog: template index links', 'All-writing + nav point at /blog');
        } else {
            fail('Blog: template index links', 'Template should link /blog twice');
        }
        if (template.includes('class="hamburger"')) {
            pass('Blog: template hamburger', 'Mobile menu button present (script.js queries it)');
        } else {
            fail('Blog: template hamburger', 'Missing .hamburger crashes script.js reveals');
        }
    } catch (error) {
        fail('Blog: post template', `Error reading file: ${error.message}`);
    }

    try {
        const backfill = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'posts/medium-backfill.json'), 'utf8'));
        if (backfill.featured && backfill.featured.title && Array.isArray(backfill.archive) && backfill.archive.length === 4) {
            pass('Blog: medium backfill', 'Featured + 4 archive entries');
        } else {
            fail('Blog: medium backfill', 'Expected featured + 4 archive entries');
        }
    } catch (error) {
        fail('Blog: medium backfill', `Unreadable: ${error.message}`);
    }

    let postSlugs = [];
    try {
        postSlugs = (await fs.promises.readdir(path.join(__dirname, 'posts')))
            .filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));
        info(`Found ${postSlugs.length} published post(s).`);
    } catch (error) {
        fail('Blog: posts dir', `Unreadable: ${error.message}`);
    }

    try {
        const sitemap = await fs.promises.readFile(path.join(__dirname, 'sitemap.xml'), 'utf8');
        const missing = postSlugs.filter(s => !sitemap.includes(`/posts/${s}`));
        if (sitemap.includes(SITE_URL) && missing.length === 0) {
            pass('Blog: sitemap.xml', `Site URL + ${postSlugs.length} post(s) listed`);
        } else {
            fail('Blog: sitemap.xml', missing.length ? `Missing slugs: ${missing.join(', ')}` : 'Missing site URL');
        }
    } catch (error) {
        fail('Blog: sitemap.xml', `Error reading file: ${error.message}`);
    }

    try {
        const feed = await fs.promises.readFile(path.join(__dirname, 'feed.xml'), 'utf8');
        const missing = postSlugs.filter(s => !feed.includes(`/posts/${s}`));
        if (feed.includes('<rss') && feed.includes(SITE_URL) && missing.length === 0) {
            pass('Blog: feed.xml', `Valid channel + ${postSlugs.length} post(s) listed`);
        } else {
            fail('Blog: feed.xml', missing.length ? `Missing slugs: ${missing.join(', ')}` : 'Invalid channel');
        }
    } catch (error) {
        fail('Blog: feed.xml', `Error reading file: ${error.message}`);
    }

    for (const slug of postSlugs) {
        try {
            const html = await fs.promises.readFile(path.join(__dirname, 'posts', `${slug}.html`), 'utf8');
            const checks = [
                { pattern: /<title>[^<]+<\/title>/i, name: 'title' },
                { pattern: /rel="canonical"/i, name: 'canonical' },
                { pattern: /"@type":\s*"BlogPosting"/, name: 'BlogPosting JSON-LD' },
                { pattern: /data-ea-publisher=""/, name: 'inert ad slot' }
            ];
            const missing = checks.filter(c => !c.pattern.test(html)).map(c => c.name);
            const titleText = (html.match(/<title>([^<]*) — Nitish Agarwal<\/title>/) || [])[1] || '';
            const h2dupe = titleText !== '' && html.includes(`<h2>${titleText}</h2>`);
            const leftover = /\{\{[A-Z_]+\}\}/.test(html);
            const problems = [...missing.map(m => `missing ${m}`),
                ...(leftover ? ['leftover template tokens'] : []),
                ...(h2dupe ? ['body heading duplicates page title'] : [])];
            if (problems.length === 0) {
                pass(`Blog: post ${slug}`, 'SEO + inert slot + no dupes/tokens');
            } else {
                fail(`Blog: post ${slug}`, problems.join('; '));
            }
            if (!/\+91.*982.*120.*0201/i.test(html)) {
                pass(`Blog: post ${slug} privacy`, 'Phone number excluded');
            } else {
                fail(`Blog: post ${slug} privacy`, 'Phone number leaked into post');
            }
        } catch (error) {
            fail(`Blog: post ${slug}`, `Error reading file: ${error.message}`);
        }
    }

    try {
        const index = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
        const links = [...index.matchAll(/href="(\/posts\/[^"]+)"/g)].map(m => m[1]);
        const missing = links.filter(href => {
            const file = href.replace(/^\//, '');
            // Extensionless post URLs resolve to sibling .html files on Cloudflare.
            return !fs.existsSync(path.join(__dirname, file)) && !fs.existsSync(path.join(__dirname, `${file}.html`));
        });
        if (missing.length === 0) {
            pass('Blog: index post links', `${links.length} link(s), all resolve`);
        } else {
            fail('Blog: index post links', `Broken: ${missing.join(', ')}`);
        }
    } catch (error) {
        fail('Blog: index post links', `Error reading file: ${error.message}`);
    }

    try {
        const blog = await fs.promises.readFile(path.join(__dirname, 'blog.html'), 'utf8');
        const checks = [
            { pattern: /rel="canonical" href="[^"]*\/blog"/, name: 'canonical /blog' },
            { pattern: /<h2 class="section-title">All posts\.<\/h2>/, name: 'full archive' },
            { pattern: /class="hamburger"/, name: 'mobile hamburger' }
        ];
        const missing = checks.filter(c => !c.pattern.test(blog)).map(c => c.name);
        const slugsMissing = postSlugs.filter(s => !blog.includes(`/posts/${s}`));
        const links = [...blog.matchAll(/href="(\/posts\/[^"]+)"/g)].map(m => m[1]);
        const broken = links.filter(href => {
            const file = href.replace(/^\//, '');
            return !fs.existsSync(path.join(__dirname, file)) && !fs.existsSync(path.join(__dirname, `${file}.html`));
        });
        const problems = [...missing.map(m => `missing ${m}`),
            ...slugsMissing.map(s => `slug absent: ${s}`),
            ...broken.map(b => `broken link: ${b}`)];
        if (problems.length === 0) {
            pass('Blog: blog.html index', `Canonical + full archive (${postSlugs.length} post(s), ${links.length} link(s))`);
        } else {
            fail('Blog: blog.html index', problems.join('; '));
        }
    } catch (error) {
        fail('Blog: blog.html index', `Error reading file: ${error.message}`);
    }

    try {
        const queue = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'posts/queue.json'), 'utf8'));
        const badShape = queue.posts.filter(p => p.no == null && !p.tag).map(p => p.slug);
        if (badShape.length === 0) {
            pass('Blog: queue shape', 'Every entry has a series no. or a tag');
        } else {
            fail('Blog: queue shape', `Missing no/tag: ${badShape.join(', ')}`);
        }
        const pubs = queue.posts.filter(p => p.status === 'published')
            .sort((a, b) => (a.date < b.date ? 1 : -1));
        if (pubs.length > 0) {
            const newest = pubs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
            const cover = ['.jpg', '.png']
                .map(ext => `posts/covers/${newest.slug}${ext}`)
                .find(f => fs.existsSync(path.join(__dirname, f)));
            const index = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
            const feedRegion = index.split('BLOG-FEED-START')[1].split('BLOG-FEED-END')[0];
            const firstLink = (feedRegion.match(/href="(\/posts\/[^"]+)"/) || [])[1] || '';
            if (firstLink === `/posts/${newest.slug}`) {
                pass('Blog: featured is newest', `${newest.slug} leads the feed`);
            } else {
                fail('Blog: featured is newest', `Feed leads with ${firstLink}, newest is ${newest.slug}`);
            }
            const backfill = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'posts/medium-backfill.json'), 'utf8'));
            const hasCover = slug => ['.jpg', '.png', '.svg']
                .some(ext => fs.existsSync(path.join(__dirname, `posts/covers/${slug}${ext}`)));
            const seriesPubs = pubs.filter(p => p.no != null && hasCover(p.slug));
            const backfillSlides = [backfill.featured, ...backfill.archive].filter(e => e.slug && hasCover(e.slug));
            const expectedSlides = seriesPubs.length + backfillSlides.length;
            const carouselJson = (feedRegion.match(/<script type="application\/json" class="carousel-data">([\s\S]*?)<\/script>/) || [])[1];
            try {
                const slides = JSON.parse(carouselJson);
                const missing = slides.filter(s => !fs.existsSync(path.join(__dirname, s.cover)));
                const newestSeries = pubs.filter(p => p.no != null)
                    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
                const controls = feedRegion.includes('carousel-btn prev') && feedRegion.includes('carousel-btn next')
                    && feedRegion.includes(`1 / ${slides.length}`);
                if (slides.length === expectedSlides && missing.length === 0
                    && slides[0].url === `/posts/${newestSeries.slug}` && controls) {
                    pass('Blog: carousel slides', `${slides.length} slides, newest first, all covers on disk`);
                } else {
                    fail('Blog: carousel slides', `Got ${slides.length}/${expectedSlides} slides, ${missing.length} missing covers, first=${slides[0] && slides[0].url}, controls=${controls}`);
                }
            } catch (error) {
                fail('Blog: carousel slides', `Carousel JSON unparsable: ${error.message}`);
            }
            const archiveItems = (feedRegion.match(/<li><span class="mono-tag">/g) || []).length;
            if (feedRegion.includes('No. 7') && archiveItems <= 7 && feedRegion.includes('↗')) {
                pass('Blog: archive merged', `Backfill merged chronologically (${archiveItems} items, No. 7 present)`);
            } else {
                fail('Blog: archive merged', `No. 7 present=${feedRegion.includes('No. 7')}, items=${archiveItems}, ext-marker=${feedRegion.includes('↗')}`);
            }
        } else {
            pass('Blog: carousel slides', 'Nothing published yet');
        }
    } catch (error) {
        fail('Blog: carousel slides', `Error reading queue: ${error.message}`);
    }
}

async function testDevServerCleanUrls() {
    const { spawn } = require('child_process');
    const TEST_PORT = '8123';
    const get = urlPath => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: TEST_PORT, path: urlPath }, res => {
            res.resume();
            res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] }));
        }).on('error', reject);
    });
    const server = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: TEST_PORT },
        stdio: 'ignore'
    });
    try {
        let ready = false;
        for (let i = 0; i < 50 && !ready; i++) {
            try { await get('/'); ready = true; } catch { await new Promise(r => setTimeout(r, 100)); }
        }
        if (!ready) {
            fail('Dev server: clean URLs', 'server.js did not start on the test port');
            return;
        }
        const queue = JSON.parse(fs.readFileSync(path.join(__dirname, 'posts/queue.json'), 'utf8'));
        const slug = queue.posts.find(p => p.status === 'published').slug;
        const results = [];
        for (const urlPath of ['/blog', `/posts/${slug}`]) {
            results.push([urlPath, await get(urlPath)]);
        }
        const bad = results.filter(([, r]) => r.status !== 200 || !String(r.type).includes('text/html'));
        if (bad.length === 0) {
            pass('Dev server: clean URLs', '/blog and extensionless post URLs serve HTML like production');
        } else {
            fail('Dev server: clean URLs', bad.map(([c, r]) => `${c} -> ${r.status}`).join(', '));
        }
    } catch (error) {
        fail('Dev server: clean URLs', error.message);
    } finally {
        server.kill();
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
        console.log(colors.green + '✓ Cloudflare Workers compatible' + colors.reset);
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
    const requiredFiles = ['index.html', 'styles.css', 'script.js', 'amplify.yml', 'server.js', 'package.json',
        'wrangler.jsonc', '_headers', '_redirects', '404.html', '.assetsignore',
        'sitemap.xml', 'robots.txt', 'feed.xml', 'blog.html',
        'scripts/post-template.html', 'posts/medium-backfill.json'];
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

    console.log('');

    // Test 8: Cloudflare configuration
    await testCloudflareConfig();

    console.log('');

    // Test 9: Blog system
    await testBlogSystem();

    console.log('');

    // Test 10: Dev server clean URLs
    await testDevServerCleanUrls();

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