import { Router } from "express";
import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import { GenerateStoreBody } from "@workspace/api-zod";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

// POST /ai/generate-store
router.post("/ai/generate-store", requireAuth, async (req: any, res) => {
  const parsed = GenerateStoreBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates WhatsApp store configurations. 
          When given a business description, generate a JSON object with:
          - name: store name (string)
          - description: brief store description (string)
          - categories: array of product category names (2-4 categories)
          - products: array of 4-6 sample products, each with:
            - name: product name
            - description: short description
            - price: price as a number
            - category: one of the categories
            - variants: array of {name, options} for size/color (or empty array)
          - whatsappNumber: null (user will set this later)
          
          Return only valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Generate a store for this business: ${parsed.data.description}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return res.status(500).json({ error: "AI generation failed" });

    const generated = JSON.parse(content);
    res.json(generated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
