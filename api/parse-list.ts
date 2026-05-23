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
        parts: [{ text: `Parse the following Whatsapp grocery/produce delivery list into a structured JSON format.
The list contains items that might be grouped by a supplier/box indicated in parentheses (e.g. (MAURO)).
If some or all items lack a supplier/box, group them together or assign them to a block with supplierName "Fornecedor Não Identificado".
Sometimes there might be headers indicating a client name. Extract that as the clientName. If no client name is found, use 'Desconhecido'.

List:
${text}` }]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            clientName: { type: 'STRING' as any },
            blocks: {
              type: 'ARRAY' as any,
              items: {
                type: 'OBJECT' as any,
                properties: {
                  supplierName: { type: 'STRING' as any },
                  items: {
                    type: 'ARRAY' as any,
                    items: {
                      type: 'OBJECT' as any,
                      properties: {
                        name: { type: 'STRING' as any },
                        quantity: { type: 'STRING' as any }
                      },
                      required: ['name', 'quantity']
                    }
                  }
                },
                required: ['supplierName', 'items']
              }
            }
          },
          required: ['clientName', 'blocks']
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error('No text returned from Gemini API');

    const parsedData = cleanAndParseJSON(jsonText);
    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error('Gemini API Error /api/parse-list:', error);
    return res.status(500).json({ error: 'Failed to parse list', details: error.message });
  }
}
