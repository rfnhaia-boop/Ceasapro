import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function cleanAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim();
  const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleaned = match[1].trim();
  } else {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(cleaned);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body as { text?: string };
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `Parse the following Whatsapp purchase/supply list into a structured JSON format.
The list contains items grouped by destinations/stores/locations. Each location is usually a header like "MORADA SP:" or "MORADA JUNDIAI:".
Inside each location, there are items, often with a supplier name in parentheses at the end or middle of the line (e.g. "(MAURO)"). If no supplier is found, use "Desconhecido".

List:
${text}` }]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            destinations: {
              type: 'ARRAY' as any,
              items: {
                type: 'OBJECT' as any,
                properties: {
                  name: { type: 'STRING' as any },
                  items: {
                    type: 'ARRAY' as any,
                    items: {
                      type: 'OBJECT' as any,
                      properties: {
                        supplier: { type: 'STRING' as any },
                        name: { type: 'STRING' as any },
                        quantity: { type: 'STRING' as any }
                      },
                      required: ['supplier', 'name', 'quantity']
                    }
                  }
                },
                required: ['name', 'items']
              }
            }
          },
          required: ['destinations']
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error('No text returned from Gemini API');

    const parsedData = cleanAndParseJSON(jsonText);
    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error('Gemini API Error /api/parse-purchase:', error);
    return res.status(500).json({ error: 'Failed to parse purchase list', details: error.message });
  }
}
