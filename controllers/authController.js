const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario._id.toString(), nome: usuario.nome, email: usuario.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function registrar(req, res) {
    try {
        const { nome, email, senha } = req.body || {};

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
        }

        const emailNormalizado = email.trim().toLowerCase();
        const existe = await Usuario.exists({ email: emailNormalizado });

        if (existe) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
        }

        const usuario = await Usuario.create({
            nome: nome.trim(),
            email: emailNormalizado,
            senha
        });

        return res.status(201).json({
            sucesso: true,
            token: gerarToken(usuario),
            usuario: { nome: usuario.nome, email: usuario.email }
        });
    } catch (erro) {
        console.error('Erro no cadastro:', erro.message);
        return res.status(500).json({ erro: 'Não foi possível concluir o cadastro.' });
    }
}

async function entrar(req, res) {
    try {
        const { email, senha } = req.body || {};

        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

        const usuario = await Usuario.findOne({ email: email.trim().toLowerCase() }).select('+senha');
        const senhaValida = usuario && await usuario.compararSenha(senha);

        if (!senhaValida) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        return res.status(200).json({
            sucesso: true,
            token: gerarToken(usuario),
            usuario: { nome: usuario.nome, email: usuario.email }
        });
    } catch (erro) {
        console.error('Erro no login:', erro.message);
        return res.status(500).json({ erro: 'Não foi possível realizar o login.' });
    }
}

module.exports = { registrar, entrar };