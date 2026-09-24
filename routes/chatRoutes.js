const express = require('express');
const { conversar, limparMemoria } = require('../controllers/chatController');
const autenticarToken = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticarToken);
router.post('/', conversar);
router.delete('/limpar', limparMemoria);

module.exports = router;