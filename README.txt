STUDYHUB PREMIUM — SETUP GUIDE

Project structure
- index.html
- css/style.css
- js/app.js

How to run on Mac
1. Extract StudyHub_Premium.zip.
2. Open the extracted StudyHub_Premium folder in VS Code.
3. Open index.html in a browser. Recommended: install the VS Code Live Server extension, right-click index.html, and choose "Open with Live Server".

Features
- Premium dark purple/blue glassmorphism UI.
- Responsive layout for desktop, tablet and mobile.
- Existing dashboard, task manager, coding tracker, notes and analytics.
- Task create/edit/delete/complete and filters.
- Coding create/edit/delete, search and difficulty/language filters.
- Notes create/edit/delete/search.
- Light/dark theme toggle (saved separately as studyhub-theme).
- Mouse tilt effects for pointer devices; respects reduced-motion settings.
- 25-minute focus timer with pause/resume/reset.
- Chart.js dashboard and analytics charts.
- JSON data export.

DATA SAFETY
The app keeps the original localStorage key: studyhub-data-v1.
It does not clear or overwrite the user's data on startup. Existing tasks, problems, notes and activity are loaded from that key and preserved when saving. The theme preference is stored separately under studyhub-theme.

Notes
- Chart.js and Google Fonts are loaded from CDNs, so those parts need internet access. The main task, notes and coding features run in the browser.
- Browser localStorage is local to the browser and origin. If you previously used file:// and now use Live Server, the browser may treat them as separate storage origins. Keep using the same origin where your old data was stored, and export a JSON backup before switching environments.
