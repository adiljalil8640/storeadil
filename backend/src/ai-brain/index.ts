import { Router } from "express";
import OpenAI from "openai";
import { GenerateStoreBody, GenerateProductDescriptionBody, SuggestProductPriceBody } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";
import { db } from "@workspace/db";
import { aiProvidersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getAiClient(): Promise<{ client: OpenAI; model: string }> {
  try {
    const [provider] = await db
      .select()
      .from(aiProvidersTable)
      .where(and(eq(aiProvidersTable.isDefault, true), eq(aiProvidersTable.isActive, true)))
      .limit(1);

    if (provider) {
      return {
        client: new OpenAI({ baseURL: provider.baseUrl, apiKey: provider.apiKey }),
        model: provider.defaultModel,
      };
    }
  } catch {
    // fall through to env fallback
  }

  return {
    client: new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    }),
    model: "gpt-4o-mini",
  };
}

// POST /ai/generate-store
router.post("/ai/generate-store", requireAuth, async (req: any, res) => {
  const parsed = GenerateStoreBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const { client, model } = await getAiClient();
    const completion = await client.chat.completions.create({
      model,
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
        { role: "user", content: `Generate a store for this business: ${parsed.data.description}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return res.status(500).json({ error: "AI generation failed" });
    res.json(JSON.parse(content));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// POST /ai/generate-description
router.post("/ai/generate-description", requireAuth, validate(GenerateProductDescriptionBody), async (req: any, res) => {
  const { productName, category, price } = req.body;

  try {
    const { client, model } = await getAiClient();
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a copywriter for WhatsApp stores. Write short, compelling product descriptions (2-3 sentences max). Be specific, friendly, and focus on benefits. No markdown, plain text only.",
        },
        {
          role: "user",
          content: `Write a product description for: "${productName}"${category ? ` (category: ${category})` : ""}${price ? ` (price: ${price})` : ""}.`,
        },
      ],
    });

    const description = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ description });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "AI description generation failed" });
  }
});

// POST /ai/suggest-price
router.post("/ai/suggest-price", requireAuth, validate(SuggestProductPriceBody), async (req: any, res) => {
  const { productName, description, category, currency } = req.body;

  try {
    const { client, model } = await getAiClient();
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a pricing advisor for small WhatsApp stores. Suggest fair market prices for products. Return only valid JSON with: suggestedPrice (number), minPrice (number), maxPrice (number), reasoning (string, 1 sentence). No markdown.`,
        },
        {
          role: "user",
          content: `Suggest a price for: "${productName}"${description ? ` — ${description}` : ""}${category ? ` (${category})` : ""}. Currency: ${currency ?? "USD"}.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return res.status(500).json({ error: "AI suggestion failed" });

    const result = JSON.parse(content);
    res.json({
      suggestedPrice: Number(result.suggestedPrice ?? result.suggested_price ?? 0),
      minPrice: Number(result.minPrice ?? result.min_price ?? 0),
      maxPrice: Number(result.maxPrice ?? result.max_price ?? 0),
      reasoning: result.reasoning ?? "",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "AI price suggestion failed" });
  }
});

export default router;
