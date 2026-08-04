const crypto = require("crypto");
// Geração
const rawBytes = crypto.randomBytes(32);
const rawKey = `sk-saas-${rawBytes.toString("hex")}`;
const keyPrefix = rawKey.substring(0, 15);
const hashBuffer = crypto.createHash("sha256").update(rawKey, "utf-8").digest("hex");
const keyHashSaved = hashBuffer;
console.log("=== GERAÇÃO DA CHAVE ===");
console.log("Chave Completa (Bruta, nunca salva):", rawKey);
console.log("Prefixo Salvo:", keyPrefix);
console.log("Hash Salvo:", keyHashSaved);

// Validação
console.log("\n=== VALIDAÇÃO (Ao receber no Endpoint) ===");
const authHeader = `Bearer ${rawKey}`;
const tokenReceived = authHeader.substring(7).trim(); // Remove "Bearer " and trims
const hashBufferVal = crypto.createHash("sha256").update(tokenReceived, "utf-8").digest("hex");
const keyHashCalculated = hashBufferVal;

console.log("Token extraído idêntico:", tokenReceived === rawKey);
console.log("Hash Calculado no Endpoint:", keyHashCalculated);
console.log("Os Hashs Bateram? ", keyHashSaved === keyHashCalculated);

