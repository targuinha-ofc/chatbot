const express = require('express');
const { registrar, entrar } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registrar);
router.post('/login', entrar);

module.exports = router;