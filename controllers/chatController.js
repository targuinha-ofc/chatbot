const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v2: cloudinary } = require('cloudinary');
const Mensagem = require('../models/Mensagem');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const modelosDisponiveis = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
];
const declaracaoClima = {
    name: 'buscarClimaTempoReal',
    description: 'Obtém a temperatura e a descrição do clima atual de uma cidade. Use quando a pergunta envolver tempo, temperatura ou chuva.',
    parameters: {
        type: 'OBJECT',
        properties: {
            cidade: {
                type: 'STRING',
                description: 'Nome da cidade para consultar. Exemplo: Londres ou Curitiba.'
            }
        },
        required: ['cidade']
    }
};

async function conversar(req, res) {
    const { pergunta } = req.body || {};

    if (typeof pergunta !== 'string' || !pergunta.trim()) {
        return res.status(400).json({
            erro: "Você precisa enviar uma 'pergunta' no formato JSON."
        });
    }

    try {
        const textoPergunta = pergunta.trim();
        const usuarioId = req.usuario.id;
        console.log(`Nova pergunta recebida: "${textoPergunta}"`);

        const historicoSalvo = await Mensagem.find({ usuarioId })
            .select('role parts -_id')
            .sort({ dataHora: -1 })
            .limit(20)
            .lean();
        const historico = normalizarHistorico(historicoSalvo.reverse());
        const prompt = [
            'Você é um narrador de futebol empolgado e bem-humorado.',
            'Responda em português do Brasil de forma clara e útil.',
            `Responda à seguinte pergunta: ${textoPergunta}`
        ].join(' ');
        const resultado = await gerarComFallback(prompt, historico);
        const resposta = resultado.response.text();

        await Mensagem.create([
            { usuarioId, role: 'user', parts: [{ text: textoPergunta }] },
            { usuarioId, role: 'model', parts: [{ text: resposta }] }
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

function normalizarHistorico(mensagens) {
    const historico = [];

    for (const mensagem of mensagens) {
        const partes = mensagem.parts
            .filter((parte) => typeof parte.text === 'string' && parte.text.trim())
            .map((parte) => ({ text: parte.text }));

        if (!partes.length) continue;
        if (!historico.length && mensagem.role !== 'user') continue;

        const ultimaMensagem = historico[historico.length - 1];

        if (ultimaMensagem && ultimaMensagem.role === mensagem.role) {
            ultimaMensagem.parts.push(...partes);
        } else {
            historico.push({ role: mensagem.role, parts: partes });
        }
    }

    return historico;
}

async function limparMemoria(req, res) {
    try {
        const resultado = await Mensagem.deleteMany({ usuarioId: req.usuario.id });
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

async function listarHistorico(req, res) {
    try {
        const mensagens = await Mensagem.find({ usuarioId: req.usuario.id })
            .select('role parts imagemUrl dataHora -_id')
            .sort({ dataHora: 1 })
            .lean();

        return res.status(200).json({ mensagens });
    } catch (erro) {
        console.error('Erro ao carregar histórico:', erro.message);
        return res.status(500).json({ erro: 'Não foi possível carregar o histórico.' });
    }
}

async function analisarImagem(req, res) {
    if (!req.file) {
        return res.status(400).json({ erro: 'Envie uma imagem no campo "imagem".' });
    }

    const prompt = typeof req.body.prompt === 'string' && req.body.prompt.trim()
        ? req.body.prompt.trim()
        : 'Descreva detalhadamente o que aparece nesta imagem.';

    try {
        const urlImagem = await enviarParaCloudinary(req.file.buffer);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
        const resultado = await gerarComRetry(() => model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    data: req.file.buffer.toString('base64'),
                    mimeType: req.file.mimetype
                }
            }
        ]));
        const resposta = resultado.response.text();
        const usuarioId = req.usuario.id;

        await Mensagem.create([
            { usuarioId, role: 'user', parts: [{ text: prompt }], imagemUrl: urlImagem },
            { usuarioId, role: 'model', parts: [{ text: resposta }] }
        ]);

        return res.status(200).json({ sucesso: true, resposta, imagemUrl: urlImagem });
    } catch (erro) {
        console.error('Erro na análise de imagem:', erro.message);

        if (erro.message.includes('[429')) {
            return res.status(429).json({ erro: 'Limite da API Gemini atingido. Tente novamente mais tarde.' });
        }

        return res.status(500).json({ erro: 'Não foi possível analisar a imagem.' });
    }
}

function enviarParaCloudinary(buffer) {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return Promise.reject(new Error('Credenciais do Cloudinary não configuradas.'));
    }

    return new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
            { folder: 'campo-aberto' },
            (erro, resultado) => erro ? reject(erro) : resolve(resultado.secure_url)
        );
        upload.end(buffer);
    });
}

async function gerarComFallback(prompt, historico) {
    for (let indice = 0; indice < modelosDisponiveis.length; indice += 1) {
        const model = genAI.getGenerativeModel({
            model: modelosDisponiveis[indice],
            tools: [{ functionDeclarations: [declaracaoClima] }]
        });

        try {
            return await executarConversa(model, prompt, historico);
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

async function executarConversa(model, prompt, historico) {
    const chat = model.startChat({ history: historico });
    let resultado = await gerarComRetry(() => chat.sendMessage(prompt));

    for (let rodada = 0; rodada < 3; rodada += 1) {
        const chamadas = resultado.response.functionCalls?.() || [];

        if (!chamadas.length) {
            return resultado;
        }

        const respostas = await Promise.all(chamadas.map(async (chamada) => ({
            functionResponse: {
                name: chamada.name,
                response: await executarFerramenta(chamada.name, chamada.args || {})
            }
        })));

        resultado = await gerarComRetry(() => chat.sendMessage(respostas));
    }

    throw new Error('O agente excedeu o limite de chamadas de ferramentas.');
}

async function executarFerramenta(nome, argumentos) {
    if (nome === 'buscarClimaTempoReal') {
        return buscarClimaTempoReal(argumentos.cidade);
    }

    return { erro: `Ferramenta desconhecida: ${nome}` };
}

async function buscarClimaTempoReal(cidade) {
    const chaveClima = process.env.WEATHER_API_KEY;

    if (!chaveClima) {
        return { erro: 'A ferramenta de clima está sem WEATHER_API_KEY configurada.' };
    }

    if (typeof cidade !== 'string' || !cidade.trim()) {
        return { erro: 'A cidade não foi informada.' };
    }

    const parametros = new URLSearchParams({
        q: cidade.trim(),
        appid: chaveClima,
        units: 'metric',
        lang: 'pt_br'
    });
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${parametros}`);

    if (!response.ok) {
        if (response.status === 404) {
            return { erro: `Cidade não encontrada: ${cidade.trim()}.` };
        }

        return { erro: `A API de clima respondeu com status ${response.status}.` };
    }

    const dados = await response.json();

    return {
        cidade: dados.name,
        pais: dados.sys?.country,
        temperatura_celsius: dados.main?.temp,
        sensacao_termica_celsius: dados.main?.feels_like,
        descricao: dados.weather?.[0]?.description,
        umidade_percentual: dados.main?.humidity,
        vento_metros_por_segundo: dados.wind?.speed
    };
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

module.exports = { conversar, limparMemoria, listarHistorico, analisarImagem };