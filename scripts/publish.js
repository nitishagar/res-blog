#!/usr/bin/env node
/**
 * Weekly blog publisher for res-blog. Zero dependencies (stdlib only).
 *
 * Usage:
 *   node scripts/publish.js --check            validate queue/template/markers, render nothing
 *   node scripts/publish.js                    publish next queued/backfill-due post (date = today UTC)
 *   node scripts/publish.js --date=YYYY-MM-DD  publish with an explicit date (idempotent re-runs)
 *   node scripts/publish.js --slug=<slug>      publish one specific queued post
 *   node scripts/publish.js --rebuild          re-render all published posts + regions (no status flips)
 *
 * Reads posts/queue.json, renders posts/drafts/<slug>.md through
 * scripts/post-template.html into posts/<slug>.html, regenerates the index
 * #blog region, blog.html, sitemap.xml and feed.xml, and flips the queue
 * entry to published. Committing and deploying are the caller's job.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'posts/queue.json');
const TEMPLATE_PATH = path.join(ROOT, 'scripts/post-template.html');
const BACKFILL_PATH = path.join(ROOT, 'posts/medium-backfill.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

function read(p) {
    return fs.readFileSync(p, 'utf8');
}

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Frontmatter: tiny `key: value` parser, [a, b] values become arrays. ---
function parseFrontmatter(md) {
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!m) throw new Error('Draft is missing YAML frontmatter (title/dek/tags/cover/hero).');
    const fm = {};
    for (const line of m[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const idx = line.indexOf(':');
        if (idx < 0) throw new Error(`Bad frontmatter line: ${line}`);
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (val.startsWith('[') && val.endsWith(']')) {
            val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        }
        fm[key] = val;
    }
    for (const k of ['title', 'dek', 'tags', 'cover']) {
        if (!fm[k] || (Array.isArray(fm[k]) && fm[k].length === 0)) {
            throw new Error(`Frontmatter is missing required key: ${k}`);
        }
    }
    return { fm, body: md.slice(m[0].length) };
}

// --- Inline markdown: code spans are extracted first, then bold/italic/links. ---
function inline(md) {
    const codes = [];
    md = escHtml(md).replace(/`([^`]+)`/g, (_, c) => {
        codes.push(c);
        return `\u0000${codes.length - 1}\u0000`;
    });
    md = md
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(>])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
            /^https?:/.test(u)
                ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`
                : `<a href="${u}">${t}</a>`);
    return md.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

function isTableSep(line) {
    return /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-');
}

function renderTable(lines, start) {
    const rows = [];
    let i = start;
    const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const head = cells(lines[i]); i += 2; // skip header + separator
    while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
    let out = '<table>\n<thead>\n<tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr>\n</thead>\n<tbody>\n';
    for (const r of rows) out += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>\n';
    return { html: out + '</tbody>\n</table>', next: i };
}

// --- Block renderer. Drops the doc-opening H1/dek/hr (template owns them),
// hero-spec blockquotes, and the Medium-tags trailer. ---
function renderBody(body) {
    const lines = body.split(/\r?\n/);
    const out = [];
    let i = 0;
    let para = [];
    const flush = () => {
        if (para.length) {
            const text = para.join(' ').trim();
            para = [];
            if (!text) return;
            if (/^\*\*Suggested Medium tags:\*\*/.test(text)) return;
            out.push(`<p>${inline(text)}</p>`);
        }
    };
    // Skip leading H1 (title lives in the template) + italic dek + opening hr.
    while (i < lines.length && !lines[i].trim()) i++;
    if (lines[i] && /^# /.test(lines[i])) i++;
    while (i < lines.length && !lines[i].trim()) i++;
    if (lines[i] && /^\*[^*]+\*$/.test(lines[i].trim())) i++;
    while (i < lines.length && !lines[i].trim()) i++;
    if (lines[i] && /^---+$/.test(lines[i].trim())) i++;

    let inFence = false;
    let fence = [];
    while (i < lines.length) {
        const line = lines[i];
        const t = line.trim();
        if (/^```/.test(t)) {
            if (!inFence) { flush(); inFence = true; fence = []; }
            else { inFence = false; out.push(`<pre><code>${escHtml(fence.join('\n'))}</code></pre>`); }
            i++;
            continue;
        }
        if (inFence) { fence.push(line); i++; continue; }
        if (!t) { flush(); i++; continue; }
        const h = t.match(/^(#{1,3})\s+(.*)$/);
        if (h) { flush(); const lvl = h[1].length + 1; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }
        if (/^---+$/.test(t)) { flush(); out.push('<hr>'); i++; continue; }
        if (t.startsWith('|') && lines[i + 1] && isTableSep(lines[i + 1])) {
            flush();
            const r = renderTable(lines, i);
            out.push(r.html); i = r.next;
            continue;
        }
        if (t.startsWith('>')) {
            flush();
            const quote = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quote.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            const qtext = quote.join(' ');
            if (/hero image:/i.test(qtext)) continue; // hero spec lives in frontmatter
            out.push(`<blockquote><p>${inline(qtext)}</p></blockquote>`);
            continue;
        }
        const listM = t.match(/^(-|\*|\d+\.)\s+(.*)$/);
        if (listM) {
            flush();
            const ordered = /^\d/.test(listM[1]);
            const items = [];
            while (i < lines.length) {
                const lm = lines[i].trim().match(/^(-|\*|\d+\.)\s+(.*)$/);
                if (!lm) break;
                items.push(`<li>${inline(lm[2])}</li>`);
                i++;
            }
            out.push(ordered ? `<ol>\n${items.join('\n')}\n</ol>` : `<ul>\n${items.join('\n')}\n</ul>`);
            continue;
        }
        para.push(t);
        i++;
    }
    flush();
    return out.join('\n');
}

function words(md) {
    return md.split(/\s+/).filter(Boolean).length;
}

function readTimeMd(md) {
    return `${Math.max(1, Math.round(words(md) / 200))} min read`;
}

function fmtDate(iso) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const [y, m, d] = iso.split('-').map(Number);
    return `${months[m - 1]} ${d}, ${y}`;
}

function fmtShort(iso) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, d] = iso.split('-').map(Number);
    return `${months[m - 1]} ${d}, ${y}`;
}

function countWord(n) {
    return ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
        'Nine', 'Ten', 'Eleven', 'Twelve'][n - 1] || String(n);
}

// Cover art for a published slug, or null (covers live at posts/covers/<slug>.jpg|png).
function coverFor(slug) {
    for (const ext of ['.jpg', '.png']) {
        if (fs.existsSync(path.join(ROOT, 'posts/covers', `${slug}${ext}`))) {
            return `/posts/covers/${slug}${ext}`;
        }
    }
    return null;
}

// --- Shared listing components (index region + blog.html) -------------------
function selfLink(url, text, cls) {
    return `<a href="${url}" class="${cls}">${escHtml(text)}</a>`;
}

function extLink(url, text, cls) {
    return `<a href="${escHtml(url)}" class="${cls}" target="_blank" rel="noopener noreferrer">${escHtml(text)}</a>`;
}

function featureCard(p, cover) {
    const link = selfLink(p.url, 'Read →', 'blog-link');
    const thumb = cover
        ? `<a class="blog-feature-cover" href="${p.url}"><img src="${cover}" alt="" loading="lazy"></a>\n                    `
        : '';
    return `                <div class="blog-feature reveal">
                    ${thumb}<div class="blog-feature-main">
                        <div class="blog-date"><span class="mono-tag">${escHtml(p.tag)}</span> · ${escHtml(p.date)}</div>
                        <h3>${escHtml(p.title)}</h3>
                        <p>${escHtml(p.dek)}</p>
                        ${link}
                    </div>`;
}

function archiveItemSelf(p) {
    const tag = p.no != null ? `No. ${p.no}` : (p.tag || 'Field notes');
    return `<li><span class="mono-tag">${escHtml(tag)}</span>${selfLink(p.url, p.title, '')}<span class="blog-archive-date">${escHtml(p.short)}</span></li>`;
}

function archiveItemExt(no, title, date, url) {
    return `<li><span class="mono-tag">No. ${no}</span>${extLink(url, title, '')}<span class="blog-archive-date">${escHtml(date)}</span></li>`;
}

function fillArchive(olderPublished, backfill) {
    const archive = olderPublished.map(archiveItemSelf);
    if (olderPublished.length === 0) {
        const f = backfill.featured;
        archive.push(archiveItemExt(f.no, f.title, f.date.replace(/^\w+ (\d+), (\d+)$/, '$1'), f.url));
    }
    for (const a of backfill.archive) {
        if (archive.length >= 4 + olderPublished.length) break;
        archive.push(archiveItemExt(a.no, a.title, a.date, a.url));
    }
    return archive;
}

function renderFeed(published, backfill, series) {
    const newest = published[0];
    const total = 7 + published.length;
    const lede = `<p class="section-lede reveal">${countWord(total)} posts on what breaks when agents meet production — each one from a real incident, each with a checklist. Newest first.</p>`;
    const archive = fillArchive(published.slice(1), backfill);
    return lede + '\n' + featureCard(newest, coverFor(newest.slug)) + `
                    <ul class="blog-archive">
                        ${archive.join('\n                        ')}
                    </ul>
                </div>`;
}

function renderCta() {
    return `                <div class="blog-cta">
                    <p>New posts publish here weekly — <a href="/blog">browse the full index →</a>. Earlier series entries live on <a href="https://nitishagar.medium.com" target="_blank" rel="noopener noreferrer">Medium</a>.</p>
                </div>`;
}

function replaceRegion(html, start, end, content) {
    const si = html.indexOf(start);
    const ei = html.indexOf(end);
    if (si < 0 || ei < 0 || ei < si) throw new Error(`Index markers missing: ${start} / ${end}`);
    return html.slice(0, si + start.length) + '\n' + content + '\n                ' + html.slice(ei);
}

// --- Standalone blog index page --------------------------------------------
function renderBlogPage(site, published, backfill, series) {
    const newest = published[0];
    const total = 7 + published.length;
    const items = published.map(archiveItemSelf);
    const f = backfill.featured;
    items.push(archiveItemExt(f.no, f.title, f.date, f.url));
    for (const a of backfill.archive) items.push(archiveItemExt(a.no, a.title, a.date, a.url));
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Writing — Nitish Agarwal</title>
    <meta name="description" content="${countWord(total)} posts on what breaks when agents meet production — each one from a real incident, each with a checklist.">
    <link rel="canonical" href="${site}/blog">
    <meta property="og:title" content="Writing — Nitish Agarwal">
    <meta property="og:description" content="Agent reliability: evals, escalation queues, and multi-agent systems in production.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${site}/blog">
    <meta name="twitter:card" content="summary">
    <link rel="stylesheet" href="/styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
    <header>
        <nav class="navbar">
            <div class="nav-container">
                <a href="/" class="logo">Nitish Agarwal<span class="logo-dot">.</span></a>
                <ul class="nav-menu">
                    <li><a href="/#about" class="nav-link">About</a></li>
                    <li><a href="/#portfolio" class="nav-link">Work</a></li>
                    <li><a href="/blog" class="nav-link">Writing</a></li>
                    <li><a href="/#contact" class="nav-link">Contact</a></li>
                    <li><a href="https://github.com/nitishagar" class="nav-link nav-cta" target="_blank" rel="noopener noreferrer">GitHub ↗</a></li>
                </ul>
                <div class="hamburger">
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                </div>
            </div>
        </nav>
    </header>
    <main id="main-content">
        <section class="blog">
            <div class="container">
                <p><a href="/" class="blog-link">&larr; Nitish Agarwal</a></p>
                <p class="section-index">Writing</p>
                <h2 class="section-title">Latest from the agent-reliability series.</h2>
${featureCard(newest, coverFor(newest.slug))}
                    <ul class="blog-archive">
                        ${fillArchive(published.slice(1), backfill).join('\n                        ')}
                    </ul>
                </div>
                <h2 class="section-title">All posts.</h2>
                <div class="blog-archive-wrap">
                    <ul class="blog-archive">
                        ${items.join('\n                        ')}
                    </ul>
                </div>
                <div class="blog-cta">
                    <p>Earlier pieces live on <a href="https://nitishagar.medium.com" target="_blank" rel="noopener noreferrer">Medium</a>.</p>
                </div>
            </div>
        </section>
    </main>
    <footer class="footer">
        <div class="container footer-inner">
            <p>&copy; 2026 Nitish Agarwal. All rights reserved.</p>
            <p class="footer-note">Static site · No trackers</p>
        </div>
    </footer>
    <script src="/script.js"></script>
</body>
</html>
`;
}

// --- Sitemap + feed --------------------------------------------------------
function renderSitemap(site, published) {
    const urls = [`  <url>\n    <loc>${site}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
        `  <url>\n    <loc>${site}/blog</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`];
    for (const p of published) {
        urls.push(`  <url>\n    <loc>${site}${p.url}</loc>\n    <lastmod>${p.iso}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function renderFeedXml(site, published) {
    const items = published.slice(0, 10).map(p =>
        `    <item>\n      <title>${escXml(p.title)}</title>\n      <link>${site}${p.url}</link>\n      <guid>${site}${p.url}</guid>\n      <pubDate>${new Date(`${p.iso}T00:00:00Z`).toUTCString()}</pubDate>\n      <description>${escXml(p.dek)}</description>\n    </item>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Nitish Agarwal — Agent Reliability</title>\n    <link>${site}/</link>\n    <description>What breaks when agents meet production — each one from a real incident, each with a checklist.</description>\n    <language>en</language>\n${items.join('\n')}\n  </channel>\n</rss>\n`;
}

// --- Render one post -------------------------------------------------------
function renderPost(queue, entry, iso) {
    const draftPath = path.join(ROOT, entry.source);
    if (!fs.existsSync(draftPath)) throw new Error(`Draft not found: ${entry.source}`);
    const { fm, body } = parseFrontmatter(read(draftPath));
    const html = renderBody(body);
    const url = `/posts/${entry.slug}`;
    const canonical = `${queue.site}${url}`;

    const published = queue.posts
        .filter(p => p.status === 'published' && p.no != null)
        .sort((a, b) => a.no - b.no);
    const selfIdx = published.findIndex(p => p.slug === entry.slug);
    const older = selfIdx > 0 ? published[selfIdx - 1] : null;
    const newer = selfIdx >= 0 && selfIdx < published.length - 1 ? published[selfIdx + 1] : null;
    const prevLink = older
        ? `<a href="/posts/${older.slug}">&larr; No. ${older.no}: ${escHtml(older.title)}</a>`
        : '';
    const nextLink = newer
        ? `<a href="/posts/${newer.slug}">No. ${newer.no}: ${escHtml(newer.title)} &rarr;</a>`
        : '';

    const hero = fm.hero
        ? `<figure class="post-hero"><img src="/${fm.hero}" alt="${escHtml(fm.hero_alt || fm.title)}" loading="lazy">${fm.hero_caption ? `<figcaption>${escHtml(fm.hero_caption)}</figcaption>` : ''}</figure>`
        : '';
    const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
    const tagsHtml = `<ul class="tag-row">${tags.map(t => `<li><span class="mono-tag">${escHtml(t)}</span></li>`).join('')}</ul>`;

    let page = read(TEMPLATE_PATH);
    const subs = {
        TITLE: escHtml(fm.title), DEK: escHtml(fm.dek),
        DATE: fmtDate(iso), DATE_ISO: iso,
        SERIES_TAG: entry.no != null ? `${escHtml(queue.series)} · No. ${entry.no}` : escHtml(entry.tag || 'Field notes'),
        CANONICAL_URL: canonical, COVER_URL: `${queue.site}/${fm.cover}`,
        HERO_FIGURE: hero, TAGS_HTML: tagsHtml, READ_TIME: readTimeMd(body),
        CONTENT_HTML: html, PREV_LINK: prevLink, NEXT_LINK: nextLink,
        EA_PUBLISHER: ''
    };
    for (const [k, v] of Object.entries(subs)) page = page.split(`{{${k}}}`).join(v);
    if (/\{\{[A-Z_]+\}\}/.test(page)) throw new Error('Unresolved template tokens after render.');
    fs.writeFileSync(path.join(ROOT, 'posts', `${entry.slug}.html`), page);

    entry.title = fm.title;
    entry.dek = fm.dek;
    return entry;
}

function finalize(queue, backfill) {
    const all = queue.posts
        .filter(p => p.status === 'published')
        .map(p => ({ ...p, url: `/posts/${p.slug}`, tag: `${queue.series} · No. ${p.no}`, date: fmtDate(p.date), short: fmtShort(p.date), iso: p.date }))
        .sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
    let index = read(INDEX_PATH);
    index = replaceRegion(index, '<!-- BLOG-FEED-START: managed by scripts/publish.js — do not hand-edit inside -->',
        '<!-- BLOG-FEED-END -->', renderFeed(all, backfill, queue.series));
    index = replaceRegion(index, '<!-- BLOG-CTA-START: managed by scripts/publish.js — do not hand-edit inside -->',
        '<!-- BLOG-CTA-END -->', renderCta());
    fs.writeFileSync(INDEX_PATH, index);
    fs.writeFileSync(path.join(ROOT, 'blog.html'), renderBlogPage(queue.site, all, backfill, queue.series));
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), renderSitemap(queue.site, all));
    fs.writeFileSync(path.join(ROOT, 'feed.xml'), renderFeedXml(queue.site, all));
}

// --- Main ------------------------------------------------------------------
function parseArgs(argv) {
    const args = { check: false, rebuild: false, date: null, slug: null };
    for (const a of argv) {
        if (a === '--check') args.check = true;
        else if (a === '--rebuild') args.rebuild = true;
        else if (a.startsWith('--date=')) args.date = a.slice(7);
        else if (a.startsWith('--slug=')) args.slug = a.slice(7);
        else throw new Error(`Unknown argument: ${a}`);
    }
    if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error('--date must be YYYY-MM-DD');
    return args;
}

function loadQueue() {
    return JSON.parse(read(QUEUE_PATH));
}

function check() {
    const queue = loadQueue();
    if (!queue.site || !Array.isArray(queue.posts) || queue.posts.length === 0) {
        throw new Error('queue.json must define site + a non-empty posts array.');
    }
    const template = read(TEMPLATE_PATH);
    for (const t of ['TITLE', 'CONTENT_HTML', 'CANONICAL_URL', 'EA_PUBLISHER', 'PREV_LINK', 'NEXT_LINK']) {
        if (!template.includes(`{{${t}}}`)) throw new Error(`Template is missing {{${t}}}.`);
    }
    const backfill = JSON.parse(read(BACKFILL_PATH));
    if (!backfill.featured || !Array.isArray(backfill.archive)) throw new Error('medium-backfill.json is malformed.');
    const index = read(INDEX_PATH);
    for (const m of ['BLOG-FEED-START', 'BLOG-FEED-END', 'BLOG-CTA-START', 'BLOG-CTA-END']) {
        if (!index.includes(m)) throw new Error(`index.html is missing marker ${m}.`);
    }
    console.log(`check ok: ${queue.posts.length} queued post(s), template + markers present.`);
}

function main(argv) {
    const args = parseArgs(argv);
    const queue = loadQueue();
    const backfill = JSON.parse(read(BACKFILL_PATH));
    if (args.check) { check(); return; }
    if (args.rebuild) {
        const pubs = queue.posts.filter(p => p.status === 'published');
        if (pubs.length === 0) throw new Error('Nothing published yet; nothing to rebuild.');
        for (const entry of pubs) renderPost(queue, entry, entry.date);
        fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
        finalize(queue, backfill);
        console.log(`rebuilt ${pubs.length} post(s) + index + blog.html + sitemap + feed.`);
        return;
    }
    const next = args.slug
        ? queue.posts.find(p => p.slug === args.slug)
        : queue.posts.find(p => p.status === 'queued' || p.status === 'backfill');
    if (!next) { console.log('queue empty: nothing to publish.'); return; }
    if (next.status === 'published') throw new Error(`${next.slug} is already published.`);
    if (!fs.existsSync(path.join(ROOT, next.source))) {
        console.log(`SKIP: draft not ready yet (${next.source}); leaving queue untouched.`);
        return;
    }
    const iso = args.date || new Date().toISOString().slice(0, 10);
    // Flip status first so prev/next sees the final published set.
    next.status = 'published';
    next.date = iso;
    renderPost(queue, next, iso);
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
    finalize(queue, backfill);
    console.log(`published ${next.slug} (No. ${next.no}) -> posts/${next.slug}.html`);
}

main(process.argv.slice(2));
