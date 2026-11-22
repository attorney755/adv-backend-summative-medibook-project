'use strict';

const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// ── Course Feedback Page (Part G: i18n & l10n) ───────────────────
// GET /feedback           -> Renders feedback page in English (default)
// GET /feedback?lang=fr   -> Renders feedback page in French
router.get('/', feedbackController.getFeedbackPage);

module.exports = router;
