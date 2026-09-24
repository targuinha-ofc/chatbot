require('dotenv').config();

const cors = require('cors');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('ERRO: Chave da API não encontrada. Verifique seu arquivo .env.');
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

        const promptFinal = [
            'Você é um narrador de futebol empolgado e bem-humorado.',
            'Responda em português do Brasil de forma clara e útil.',
            `Responda à seguinte pergunta: ${pergunta.trim()}`
        ].join(' ');
        const resultado = await gerarComFallback(promptFinal);

        return res.status(200).json({
            sucesso: true,
            resposta: resultado.response.text()
        });
    } catch (erro) {
        console.error('Erro no servidor:', erro.message);
        return res.status(500).json({ erro: 'Erro interno no servidor de IA.' });
    }
});

async function gerarComFallback(prompt) {
    for (let indice = 0; indice < modelosDisponiveis.length; indice += 1) {
        const model = genAI.getGenerativeModel({ model: modelosDisponiveis[indice] });

        try {
            return await gerarComRetry(model, prompt);
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

async function gerarComRetry(model, prompt) {
    const maxTentativas = 3;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
        try {
            return await model.generateContent(prompt);
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

app.listen(porta, () => {
    console.log(`Servidor da IA rodando em http://localhost:${porta}`);
    console.log(`Rota disponível: POST http://localhost:${porta}/api/chat`);
});