const express = require('express');
const router = express.Router();
const { googleCallback, googleAuthRedirect, manualLogin, signup, checkCalendar, updateProfile, generateMeet } = require('../controllers/authController');

router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleCallback);
router.post('/manual', manualLogin);
router.post('/signup', signup);
router.get('/check-calendar', checkCalendar);
router.patch('/profile', updateProfile);
router.post('/meet/generate', generateMeet);

module.exports = router;
