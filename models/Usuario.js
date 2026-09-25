const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha: { type: String, required: true, select: false }
}, { timestamps: true });

usuarioSchema.pre('save', async function criptografarSenha(next) {
    if (!this.isModified('senha')) return next();
    this.senha = await bcrypt.hash(this.senha, 10);
    next();
});

usuarioSchema.methods.compararSenha = function compararSenha(senha) {
    return bcrypt.compare(senha, this.senha);
};

module.exports = mongoose.model('Usuario', usuarioSchema);