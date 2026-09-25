const express = require('express');
const multer = require('multer');
const { conversar, limparMemoria, listarHistorico, analisarImagem } = require('../controllers/chatController');
const autenticarToken = require('../middlewares/authMiddleware');

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, callback) => {
		if (file.mimetype.startsWith('image/')) return callback(null, true);
		return callback(new Error('Apenas arquivos de imagem são aceitos.'));
	}
});

router.use(autenticarToken);
router.get('/historico', listarHistorico);
router.post('/vision', (req, res, next) => {
	upload.single('imagem')(req, res, (erro) => {
		if (erro) return res.status(400).json({ erro: erro.message });
		return next();
	});
}, analisarImagem);
router.post('/', conversar);
router.delete('/limpar', limparMemoria);

module.exports = router;