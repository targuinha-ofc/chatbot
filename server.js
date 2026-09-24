require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const mongoUri = process.env.MONGO_URI;

if (!apiKey) {
    console.error('ERRO: Chave da API não encontrada. Verifique seu arquivo .env.');
    process.exit(1);
}

if (!mongoUri) {
    console.error('ERRO: MONGO_URI não encontrada. Configure a conexão do MongoDB Atlas no .env.');
    process.exit(1);
}

const app = express();
const genAI = new GoogleGenerativeAI(apiKey);
const porta = process.env.PORT || 3000;
const modelosDisponiveis = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
];
const mensagemSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'model'], required: true },
    parts: [{ text: { type: String, required: true } }],
    dataHora: { type: Date, default: Date.now }
});
const Mensagem = mongoose.model('Mensagem', mensagemSchema);

app.use(express.json());
app.use(cors());

app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'Servidor da IA Operacional' });
});

app.post('/api/chat', async (req, res) => {
    const { pergunta } = req.body || {};

    if (typeof pergunta !== 'string' || !pergunta.trim()) {
        return res.status(400).json({
            erro: "Você precisa enviar uma 'pergunta' no formato JSON."
        });
    }

    try {
        console.log(`Nova pergunta recebida: "${pergunta.trim()}"`);

        const historicoSalvo = await Mensagem.find()
            .select('role parts -_id')
            .sort({ dataHora: -1 })
            .limit(20)
            .lean();
        const historico = historicoSalvo.reverse();
        const promptFinal = [
            'Você é um narrador de futebol empolgado e bem-humorado.',
            'Responda em português do Brasil de forma clara e útil.',
            `Responda à seguinte pergunta: ${pergunta.trim()}`
        ].join(' ');
        const resultado = await gerarComFallback(promptFinal, historico);
        const resposta = resultado.response.text();

        await Mensagem.create([
            { role: 'user', parts: [{ text: pergunta.trim() }] },
            { role: 'model', parts: [{ text: resposta }] }
        ]);

        return res.status(200).json({
            sucesso: true,
            resposta
        });
    } catch (erro) {
        console.error('Erro no servidor:', erro.message);
        return res.status(500).json({ erro: 'Erro interno no servidor de IA.' });
    }
});

app.delete('/api/chat/limpar', async (req, res) => {
    try {
        const resultado = await Mensagem.deleteMany({});
        return res.status(200).json({
            sucesso: true,
            apagadas: resultado.deletedCount
        });
    } catch (erro) {
        console.error('Erro ao limpar memória:', erro.message);
        return res.status(500).json({ erro: 'Não foi possível apagar a memória.' });
    }
});

async function gerarComFallback(prompt, historico) {
    for (let indice = 0; indice < modelosDisponiveis.length; indice += 1) {
        const model = genAI.getGenerativeModel({ model: modelosDisponiveis[indice] });

        try {
            const chat = model.startChat({ history: historico });
            return await gerarComRetry(() => chat.sendMessage(prompt));
        } catch (erro) {
            const modeloOcupado = erro.message.includes('[503');
            const ultimoModelo = indice === modelosDisponiveis.length - 1;

            if (!modeloOcupado || ultimoModelo) {
                throw erro;
            }

            console.log(`Modelo ocupado. Tentando ${modelosDisponiveis[indice + 1]}...`);
        }
    }
}

async function gerarComRetry(operacao) {
    const maxTentativas = 3;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
        try {
            return await operacao();
        } catch (erro) {
            const modeloOcupado = erro.message.includes('[503');
            const ultimaTentativa = tentativa === maxTentativas;

            if (!modeloOcupado || ultimaTentativa) {
                throw erro;
            }

            await new Promise((resolve) => setTimeout(resolve, tentativa * 2000));
        }
    }
}

mongoose.connect(mongoUri)
    .then(() => {
        console.log('Conectado ao MongoDB Atlas.');
        app.listen(porta, () => {
            console.log(`Servidor da IA rodando em http://localhost:${porta}`);
            console.log(`Rota disponível: POST http://localhost:${porta}/api/chat`);
        });
    })
    .catch((erro) => {
        console.error('ERRO ao conectar ao MongoDB Atlas:', erro.message);
        process.exitCode = 1;
    });