'use strict';

/**
 * Feedback Controller (Part G: i18n & l10n)
 * 
 * In this controller, I serve the course feedback and reflection HTML page.
 * Requirement Checklist:
 * - Exactly 5 essay questions, each answered in a <textarea>.
 * - Localization loaded dynamically from JSON files (locales/en.json and locales/fr.json).
 * - Visiting /feedback?lang=fr switches to French.
 * - Defaults to English ('en') and gracefully falls back to English for unsupported languages.
 * - Formats today's date using Intl.DateTimeFormat according to the active locale.
 */

const path = require('path');
const fs = require('fs');

// Path to localization directory
const LOCALES_DIR = path.join(__dirname, '..', '..', 'locales');

/**
 * Loads a locale JSON file safely, falling back to English if file not found.
 */
function loadLocale(lang) {
  const supported = ['en', 'fr'];
  const targetLang = supported.includes(lang) ? lang : 'en';
  const filePath = path.join(LOCALES_DIR, `${targetLang}.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return { data: JSON.parse(raw), activeLang: targetLang };
  } catch (err) {
    // If reading fails, load English as fallback
    const fallbackPath = path.join(LOCALES_DIR, 'en.json');
    const fallbackRaw = fs.readFileSync(fallbackPath, 'utf8');
    return { data: JSON.parse(fallbackRaw), activeLang: 'en' };
  }
}

/**
 * GET /feedback
 * Renders the localized course feedback page.
 */
async function getFeedbackPage(req, res, next) {
  try {
    // First, I inspected the 'lang' query parameter (e.g. ?lang=fr)
    const requestedLang = (req.query.lang || 'en').toLowerCase();

    // Next, I loaded the corresponding locale file with automatic English fallback
    const { data: locale, activeLang } = loadLocale(requestedLang);

    // Then, I formatted today's date dynamically using Intl.DateTimeFormat based on the active locale
    const formattedDate = new Intl.DateTimeFormat(locale.locale, {
      dateStyle: 'full',
    }).format(new Date());

    // Next, I constructed the language switch link URL
    const nextLang = activeLang === 'en' ? 'fr' : 'en';
    const switchLabel = activeLang === 'en' ? locale.switch_to_french : locale.switch_to_english;

    // Then, I generated the HTML markup for each of the 5 questions and their pre-filled answers
    const questionsHtml = locale.questions
      .map(
        (q) => `
        <div class="question-card">
          <div class="question-header">
            <span class="badge">${q.number}</span>
            <h3>${q.question}</h3>
          </div>
          <div class="form-group">
            <textarea readonly rows="5" class="feedback-textarea">${q.answer}</textarea>
          </div>
        </div>
      `
      )
      .join('\n');

    // Finally, I composed the complete HTML document and sent it with a 200 OK status
    const html = `<!DOCTYPE html>
<html lang="${activeLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${locale.page_title}</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --badge-bg: #dbeafe;
      --badge-text: #1e40af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    header {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.75rem;
      color: var(--text);
    }
    .lang-btn {
      display: inline-flex;
      align-items: center;
      background: var(--primary);
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: background 0.2s ease;
    }
    .lang-btn:hover {
      background: var(--primary-hover);
    }
    .meta-bar {
      display: flex;
      gap: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 1rem;
      margin-top: 1rem;
    }
    .meta-item strong {
      color: var(--text);
    }
    .question-card {
      background: var(--card-bg);
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .question-header {
      margin-bottom: 1rem;
    }
    .badge {
      display: inline-block;
      background: var(--badge-bg);
      color: var(--badge-text);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    h3 {
      font-size: 1.1rem;
      color: var(--text);
      font-weight: 600;
    }
    .feedback-textarea {
      width: 100%;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.95rem;
      font-family: inherit;
      background: #f1f5f9;
      color: #1e293b;
      resize: vertical;
      line-height: 1.5;
    }
    .feedback-textarea:focus {
      outline: 2px solid var(--primary);
      background: #ffffff;
    }
    footer {
      text-align: center;
      margin-top: 2rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <h1>${locale.heading}</h1>
        <a class="lang-btn" href="/feedback?lang=${nextLang}">${switchLabel} &rarr;</a>
      </div>
      <p style="color: var(--text-muted);">${locale.instructions}</p>
      <div class="meta-bar">
        <div class="meta-item">
          <strong>${locale.date_label}:</strong> ${formattedDate}
        </div>
        <div class="meta-item">
          <strong>Locale:</strong> ${locale.locale}
        </div>
      </div>
    </header>

    <main>
      ${questionsHtml}
    </main>

    <footer>
      <p>MediBook Backend — ALU BSE Summative Project</p>
    </footer>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFeedbackPage,
};
