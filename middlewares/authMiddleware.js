const jwt = require('jsonwebtoken');

function autenticarToken(req, res, next) {
    const authorization = req.headers.authorization;
    const [tipo, token] = authorization ? authorization.split(' ') : [];

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ erro: 'Token de acesso ausente.' });
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch (erro) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
}

module.exports = autenticarToken;