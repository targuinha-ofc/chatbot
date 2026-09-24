const { GoogleGenerativeAI } = require('@google/generative-ai');
const Mensagem = require('../models/Mensagem');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelosDisponiveis = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
];

async function conversar(req, res) {
    const { pergunta } = req.body || {};

    if (typeof pergunta !== 'string' || !pergunta.trim()) {
        return res.status(400).json({
            erro: "Você precisa enviar uma 'pergunta' no formato JSON."
        });
    }

    try {
        const textoPergunta = pergunta.trim();
        console.log(`Nova pergunta recebida: "${textoPergunta}"`);

        const historicoSalvo = await Mensagem.find()
            .select('role parts -_id')
            .sort({ dataHora: -1 })
            .limit(20)
            .lean();
        const historico = historicoSalvo.reverse().map((mensagem) => ({
            role: mensagem.role,
            parts: mensagem.parts.map((parte) => ({ text: parte.text }))
        }));
        const prompt = [
            'Você é um narrador de futebol empolgado e bem-humorado.',
            'Responda em português do Brasil de forma clara e útil.',
            `Responda à seguinte pergunta: ${textoPergunta}`
        ].join(' ');
        const resultado = await gerarComFallback(prompt, historico);
        const resposta = resultado.response.text();

        await Mensagem.create([
            { role: 'user', parts: [{ text: textoPergunta }] },
            { role: 'model', parts: [{ text: resposta }] }
        ]);

        return res.status(200).json({ sucesso: true, resposta });
    } catch (erro) {
        console.error('Erro no servidor:', erro.message);

        if (erro.message.includes('[429')) {
            return res.status(429).json({
                erro: 'Limite da API Gemini atingido. Aguarde alguns segundos e tente novamente.'
            });
        }

        if (erro.message.includes('[503')) {
            return res.status(503).json({
                erro: 'O serviço Gemini está temporariamente indisponível. Tente novamente em instantes.'
            });
        }

        return res.status(500).json({ erro: 'Erro interno no servidor de IA.' });
    }
}

async function limparMemoria(req, res) {
    try {
        const resultado = await Mensagem.deleteMany({});
        return res.status(200).json({
            sucesso: true,
            apagadas: resultado.deletedCount,
            mensagem: 'Memória da conversa apagada com sucesso.'
        });
    } catch (erro) {
        console.error('Erro ao limpar memória:', erro.message);
        return res.status(500).json({ erro: 'Não foi possível apagar a memória.' });
    }
}

async function gerarComFallback(prompt, historico) {
    for (let indice = 0; indice < modelosDisponiveis.length; indice += 1) {
        const model = genAI.getGenerativeModel({ model: modelosDisponiveis[indice] });

        try {
            const chat = model.startChat({ history: historico });
            return await gerarComRetry(() => chat.sendMessage(prompt));
        } catch (erro) {
            const modeloIndisponivel = erro.message.includes('[429') || erro.message.includes('[503');
            const ultimoModelo = indice === modelosDisponiveis.length - 1;

            if (!modeloIndisponivel || ultimoModelo) {
                throw erro;
            }

            console.log(`Modelo indisponível. Tentando ${modelosDisponiveis[indice + 1]}...`);
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

module.exports = { conversar, limparMemoria };