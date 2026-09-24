const express = require('express');
const { conversar, limparMemoria } = require('../controllers/chatController');

const router = express.Router();

router.post('/', conversar);
router.delete('/limpar', limparMemoria);

module.exports = router;