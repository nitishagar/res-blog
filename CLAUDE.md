# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

The res-blog directory contains a personal portfolio website designed for static hosting on AWS Amplify. It showcases education, skills, and projects.

## Repository Context

This project is part of the self-help repository, which contains various web applications, Shopify apps, and development tools.

## Project Structure

```
res-blog/
├── index.html          # Main portfolio page with resume content
├── styles.css          # Professional styling with responsive design
├── script.js           # Navigation and interaction functionality
├── server.js           # Node.js local development server
├── test.html           # Test suite for verifying functionality
├── amplify.yml         # AWS Amplify hosting configuration
├── package.json        # NPM scripts for local development
├── resume.tex          # LaTeX source for resume content
└── README.md           # Deployment instructions
```

## Key Features

- Static website optimized for AWS Amplify hosting
- Responsive design with mobile-friendly navigation
- Professional portfolio layout with resume content from resume.tex
- Blog and portfolio sections ready for expansion
- Local development server with auto-refresh disabled
- Comprehensive test suite

## Common Commands

```bash
# Local development
npm start              # Start local server on port 8000
npm run serve          # Alternative to start
npm test               # Open test suite in browser

# Or run directly:
node server.js         # Start server without npm
```

## AWS Amplify Deployment

The site is configured for optimal static hosting on AWS Amplify:
- No build phase required (pure static files)
- Automatic SSL certificate
- Global CDN distribution
- Minimal costs (only hosting and bandwidth)

## Testing

Run `npm test` or open `test.html` to verify:
- File integrity
- Responsive design
- Navigation functionality
- AWS Amplify configuration
- Performance metrics
- Basic accessibility

## Important Notes

- Personal contact information (phone number) has been excluded
- Email address is included for professional contact
- All content is derived from resume.tex
- Site is designed for future blog and portfolio expansion