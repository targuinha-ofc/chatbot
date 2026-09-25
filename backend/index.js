require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('ERRO: Chave da API não encontrada. Verifique seu arquivo .env.');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const modelosDisponiveis = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
];

async function executarAgente() {
    try {
        console.log('Conectando aos servidores do Google...');

        const prompt = [
            'Explique o que é uma API em exatamente um parágrafo curto.',
            'Responda em português do Brasil.',
            'Use a personalidade de um narrador de futebol empolgado, com humor leve.',
            'Não use listas, títulos ou mais de um parágrafo.'
        ].join(' ');

        const result = await gerarComFallback(prompt);
        const resposta = result.response.text();

        console.log('\n[AGENTE GEMINI]');
        console.log(resposta);
        console.log('\nMissão concluída.');
    } catch (erro) {
        console.error('Ocorreu um erro na conexão:', erro.message);
        process.exitCode = 1;
    }
}

async function gerarComFallback(prompt) {
    for (let indice = 0; indice < modelosDisponiveis.length; indice += 1) {
        const nomeModelo = modelosDisponiveis[indice];
        const model = genAI.getGenerativeModel({ model: nomeModelo });

        try {
            return await gerarComRetry(model, prompt);
        } catch (erro) {
            const modeloOcupado = erro.message.includes('[503');
            const ultimoModelo = indice === modelosDisponiveis.length - 1;

            if (!modeloOcupado || ultimoModelo) {
                throw erro;
            }

            console.log(`O modelo ${nomeModelo} continua ocupado. Tentando ${modelosDisponiveis[indice + 1]}...`);
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

            const esperaMs = tentativa * 2000;
            console.log(`Modelo ocupado. Nova tentativa em ${esperaMs / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, esperaMs));
        }
    }
}

executarAgente();