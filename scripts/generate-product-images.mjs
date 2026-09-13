// Gera as fotos de produto da vitrine pública com o Gemini (13/09/2026).
// Uso: node scripts/generate-product-images.mjs   (lê GEMINI_API_KEY do .env)
// Referência visual: docs/superpowers/plans/2026-07-22-barber-image-campaign.md
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY ausente no .env");

const style =
  "Editorial product photography for a premium barbershop. Single product centered on a dark warm graphite concrete surface, " +
  "matte black unbranded packaging with no readable text or logos, soft directional side light from the left, gentle shadow, " +
  "shallow depth of field, muted warm charcoal background with a blurred barbershop out of focus, subtle film grain, " +
  "square 1:1 composition, photorealistic, no people, no hands, no text.";

const products = [
  { file: "product-pomade-matte-club.png", prompt: "A short wide round matte black pomade jar with a black screw lid, slightly open showing matte cream texture inside." },
  { file: "product-beard-oil-n7.png", prompt: "A small dark amber glass beard oil bottle with a black dropper cap, a drop of golden oil on the surface beside it." },
  { file: "product-shampoo-daily-clean.png", prompt: "A tall matte black shampoo bottle with a black pump dispenser, water droplets on the bottle." },
  { file: "product-comb-carbon-pro.png", prompt: "A sleek black carbon fiber barber comb lying diagonally, fine and coarse teeth visible, a few water drops on the surface." },
];

const reference = readFileSync("public/images/staff/lucas-moreira.png").toString("base64");

for (const product of products) {
  const body = {
    contents: [{
      parts: [
        { text: `Use the attached portrait ONLY as a reference for lighting, colour grading and film grain — do not include the person. ${style} Subject: ${product.prompt}` },
        { inlineData: { mimeType: "image/png", data: reference } },
      ],
    }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
  };
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${product.file}: ${json.error?.message ?? response.status}`);
  const part = json.candidates?.[0]?.content?.parts?.find((item) => item.inlineData);
  if (!part) throw new Error(`${product.file}: resposta sem imagem (${JSON.stringify(json).slice(0, 200)})`);
  writeFileSync(`public/images/${product.file}`, Buffer.from(part.inlineData.data, "base64"));
  console.log("ok", product.file, part.inlineData.mimeType);
}
