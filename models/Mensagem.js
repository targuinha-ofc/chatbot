const mongoose = require('mongoose');

const mensagemSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    role: { type: String, enum: ['user', 'model'], required: true },
    parts: [{ text: { type: String, required: true } }],
    dataHora: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mensagem', mensagemSchema);