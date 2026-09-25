require('dotenv').config();

const path = require('path');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

const apiKey = process.env.GEMINI_API_KEY;
const mongoUri = process.env.MONGO_URI;
const jwtSecret = process.env.JWT_SECRET;
const porta = process.env.PORT || 3000;

if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não encontrada.');
    process.exit(1);
}

if (!mongoUri) {
    console.error('ERRO: MONGO_URI não encontrada.');
    process.exit(1);
}

if (!jwtSecret) {
    console.error('ERRO: JWT_SECRET não encontrada.');
    process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'Servidor da IA Operacional' });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        servico: 'campo-aberto',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

let conexaoMongo;

function conectarMongo() {
    if (!conexaoMongo) {
        conexaoMongo = mongoose.connect(mongoUri)
            .then(() => console.log('Conectado ao MongoDB Atlas.'))
            .catch((erro) => {
                conexaoMongo = undefined;
                throw erro;
            });
    }

    return conexaoMongo;
}

app.use(async (req, res, next) => {
    try {
        await conectarMongo();
        next();
    } catch (erro) {
        console.error('ERRO ao conectar ao MongoDB Atlas:', erro.message);
        res.status(503).json({ erro: 'Banco de dados indisponível.' });
    }
});

if (require.main === module) {
    conectarMongo()
        .then(() => {
            app.listen(porta, () => {
                console.log(`Servidor da IA rodando em http://localhost:${porta}`);
            });
        })
        .catch((erro) => {
            console.error('ERRO ao conectar ao MongoDB Atlas:', erro.message);
            process.exitCode = 1;
        });
}

module.exports = app;