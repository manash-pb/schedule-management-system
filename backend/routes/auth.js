const express = require('express');
const router = express.Router();
const { googleCallback, googleAuthRedirect, manualLogin, signup, checkCalendar, updateProfile, generateMeet, logout, forgotPassword, resetPassword, verifyResetToken } = require('../controllers/authController');

router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleCallback);
router.post('/manual', manualLogin);
router.post('/signup', signup);
router.post('/logout', logout);
router.get('/check-calendar', checkCalendar);
router.patch('/profile', updateProfile);
router.post('/meet/generate', generateMeet);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

module.exports = router;
