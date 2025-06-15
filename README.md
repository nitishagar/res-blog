# Personal Portfolio Website

A clean, responsive portfolio website designed for hosting on AWS Amplify.

## Features

- Responsive design that works on all devices
- Resume/CV section with professional experience
- Portfolio section for showcasing projects
- Blog section for technical articles
- Smooth scrolling navigation
- Mobile-friendly hamburger menu

## Structure

```
res-blog/
├── index.html          # Main HTML file with portfolio content
├── styles.css          # CSS with animations and responsive design
├── script.js           # JavaScript for interactivity
├── server.js           # Node.js local development server
├── test.js             # Node.js test runner
├── test.html           # Browser-based test suite
├── amplify.yml         # AWS Amplify configuration
├── package.json        # NPM scripts
├── .nojekyll           # GitHub Pages configuration
├── .gitignore          # Git ignore file
├── resume.tex          # LaTeX resume source
└── README.md           # This file
```

## Deployment Options

### Option 1: GitHub Pages (Free)

1. **Prepare your repository**
   - Create a new GitHub repository
   - Initialize git: `git init`
   - Add files: `git add .`
   - Commit: `git commit -m "Initial portfolio website"`
   - Add remote: `git remote add origin https://github.com/yourusername/your-repo-name.git`
   - Push: `git push -u origin main`

2. **Enable GitHub Pages**
   - Go to your repository Settings
   - Navigate to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click Save
   - Your site will be available at: `https://yourusername.github.io/your-repo-name/`

### Option 2: AWS Amplify

1. **Prepare your repository** (same as above)

2. **Deploy to AWS Amplify**
   - Go to AWS Amplify Console
   - Click "Get Started" under "Host your web app"
   - Connect your repository
   - Choose the branch to deploy
   - Review build settings (amplify.yml is already configured)
   - Save and deploy

3. **Custom Domain (Optional)**
   - In Amplify Console, go to "Domain Management"
   - Add your custom domain
   - Follow DNS configuration instructions

## Testing

The project includes comprehensive testing:

### Run Tests
```bash
# Run Node.js test suite (recommended)
npm test

# Or run browser-based tests
npm run test:browser
```

The Node.js test suite checks:
- File integrity
- HTML structure and content
- CSS and JavaScript presence
- Performance metrics
- Accessibility basics
- GitHub Pages compatibility
- AWS Amplify configuration

## Customization

### Personal Information
The portfolio is already populated with content from resume.tex. To update:
- Edit professional experience in the Experience section
- Update LinkedIn and GitHub profile URLs in the Contact section
- Modify project descriptions in the Portfolio section
- Add new blog posts or link to specific Medium articles

### Styling
- Colors can be customized in the CSS variables at the top of `styles.css`
- Fonts can be changed by updating the Google Fonts link in `index.html`

### Content
- Add your blog posts by creating new HTML files and linking them
- Update portfolio projects with real project details
- Add or remove skill tags as needed

## Future Enhancements

- Add a blog system (consider using a static site generator)
- Implement a contact form with AWS Lambda
- Add project detail pages
- Include testimonials section
- Add dark mode toggle