import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import 'dotenv/config';

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave GEMINI_API_KEY não foi encontrada nas variáveis de ambiente do servidor.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function cleanAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim();
  
  // Try to find markdown json codeblock first
  const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleaned = match[1].trim();
  } else {
    // If no backticks, locate first { and last } or [ and ]
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }
  
  return JSON.parse(cleaned);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/parse-list', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
           { role: 'user', parts: [{ text: `Parse the following Whatsapp grocery/produce delivery list into a structured JSON format. 
The list contains items that might be grouped by a supplier/box indicated in parentheses (e.g. (MAURO)). 
If some or all items lack a supplier/box, group them together or assign them to a block with supplierName "Fornecedor Não Identificado" (or "Box 1" if appropriate).
Sometimes there might be headers indicating a client name. Extract that as the clientName. If no client name is found, use 'Desconhecido'.

List:
${text}` }] }
        ],
        config: {
           responseMimeType: "application/json",
           responseSchema: {
             type: "OBJECT" as any,
             properties: {
               clientName: {
                 type: "STRING" as any,
                 description: "The name of the client or 'Desconhecido' if not found."
               },
               blocks: {
                 type: "ARRAY" as any,
                 items: {
                   type: "OBJECT" as any,
                   properties: {
                     supplierName: {
                       type: "STRING" as any,
                       description: "The name of the supplier/box, e.g. 'MAURO', or 'Fornecedor Não Identificado' if not found."
                     },
                     items: {
                       type: "ARRAY" as any,
                       items: {
                         type: "OBJECT" as any,
                         properties: {
                           name: { type: "STRING" as any, description: "The clean name of the product item." },
                           quantity: { type: "STRING" as any, description: "The quantity of the item, e.g., '4Cx', '15Cx', '10Sc'." }
                         },
                         required: ["name", "quantity"]
                       }
                     }
                   },
                   required: ["supplierName", "items"]
                 }
               }
             },
             required: ["clientName", "blocks"]
           }
        }
      });

      let jsonText = response.text;
      if (!jsonText) throw new Error("No text returned from Gemini API");
      
      let parsedData;
      try {
        parsedData = cleanAndParseJSON(jsonText);
      } catch (parseError: any) {
        console.error("JSON parsing failed in /api/parse-list, model response:", jsonText);
        throw new Error(`Não foi possível ler a resposta da IA como formato JSON válido: ${parseError.message}`);
      }
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini API Error /api/parse-list:", error);
      res.status(500).json({ 
        error: 'Failed to parse list', 
        details: error.stack || error.message || String(error) 
      });
    }
  });

  app.post('/api/parse-purchase', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
           { role: 'user', parts: [{ text: `Parse the following Whatsapp purchase/supply list into a structured JSON format. 
The list contains items grouped by destinations/stores/locations. Each location is usually a header like "MORADA SP:" or "MORADA JUNDIAI:".
Inside each location, there are items, often with a supplier name in parentheses at the end or middle of the line (e.g. "(MAURO)"). If no supplier is found, use "Desconhecido".

List:
${text}` }] }
        ],
        config: {
           responseMimeType: "application/json",
           responseSchema: {
             type: "OBJECT" as any,
             properties: {
               destinations: {
                 type: "ARRAY" as any,
                 items: {
                   type: "OBJECT" as any,
                   properties: {
                     name: { type: "STRING" as any, description: "The name of the destination, e.g. MORADA SP" },
                     items: {
                       type: "ARRAY" as any,
                       items: {
                         type: "OBJECT" as any,
                         properties: {
                           supplier: { type: "STRING" as any, description: "The name of the supplier or 'Desconhecido' if not found." },
                           name: { type: "STRING" as any, description: "The name of the product item." },
                           quantity: { type: "STRING" as any, description: "The quantity of the item, e.g., '1Cx', '2Sc'." }
                         },
                         required: ["supplier", "name", "quantity"]
                       }
                     }
                   },
                   required: ["name", "items"]
                 }
               }
             },
             required: ["destinations"]
           }
        }
      });

      let jsonText = response.text;
      if (!jsonText) throw new Error("No text returned from Gemini API");
      
      let parsedData;
      try {
        parsedData = cleanAndParseJSON(jsonText);
      } catch (parseError: any) {
        console.error("JSON parsing failed in /api/parse-purchase, model response:", jsonText);
        throw new Error(`Não foi possível ler a resposta de compra da IA como formato JSON válido: ${parseError.message}`);
      }
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini API Error /api/parse-purchase:", error);
      res.status(500).json({ 
        error: 'Failed to parse purchase list', 
        details: error.stack || error.message || String(error) 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
