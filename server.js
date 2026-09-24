require('dotenv').config();

const path = require('path');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const chatRoutes = require('./routes/chatRoutes');

const apiKey = process.env.GEMINI_API_KEY;
const mongoUri = process.env.MONGO_URI;
const porta = process.env.PORT || 3000;

if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não encontrada.');
    process.exit(1);
}

if (!mongoUri) {
    console.error('ERRO: MONGO_URI não encontrada.');
    process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'Servidor da IA Operacional' });
});

app.use('/api/chat', chatRoutes);

mongoose.connect(mongoUri)
    .then(() => {
        console.log('Conectado ao MongoDB Atlas.');
        app.listen(porta, () => {
            console.log(`Servidor da IA rodando em http://localhost:${porta}`);
        });
    })
    .catch((erro) => {
        console.error('ERRO ao conectar ao MongoDB Atlas:', erro.message);
        process.exitCode = 1;
    });