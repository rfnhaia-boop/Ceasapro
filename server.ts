import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
           { role: 'user', parts: [{ text: `Parse the following Whatsapp grocery/produce delivery list into a structured JSON format. 
The list contains items grouped by a supplier/box indicated in parentheses (e.g. (MAURO)). 
Sometimes there might be headers like "CAMPEAO 28: NF E BOLETO". Capture that as the clientName.
Return ONLY valid JSON that matches this schema:
{
  "clientName": "Extracted client name or 'Unknown'",
  "blocks": [
    {
      "supplierName": "String (e.g. MAURO)",
      "items": [
         { "name": "Item name", "quantity": "Quantity string (e.g. 40Un, 5Kg)" }
      ]
    }
  ]
}

List:
${text}` }] }
        ],
        config: {
           responseMimeType: "application/json",
        }
      });

      let jsonText = response.text;
      if (!jsonText) throw new Error("No text returned");
      jsonText = jsonText.replace(/^```json/im, '').replace(/```$/im, '').trim();
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: 'Failed to parse list', details: error.message });
    }
  });

  app.post('/api/parse-purchase', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
           { role: 'user', parts: [{ text: `Parse the following Whatsapp purchase/supply list into a structured JSON format. 
The list contains items grouped by destinations/stores/locations. Each location is usually a header like "MORADA SP:" or "MORADA JUNDIAI:".
Inside each location, there are items, often with a supplier name in parentheses at the end or middle of the line (e.g. "(MAURO)"). If no supplier is found, use "Desconhecido".
Return ONLY valid JSON that matches this schema:
{
  "destinations": [
    {
      "name": "String (e.g. MORADA SP)",
      "items": [
         { "supplier": "String", "name": "Item name without supplier or qty", "quantity": "Quantity string (e.g. 1Cx, 2Sc)" }
      ]
    }
  ]
}

List:
${text}` }] }
        ],
        config: {
           responseMimeType: "application/json",
        }
      });

      let jsonText = response.text;
      if (!jsonText) throw new Error("No text returned");
      jsonText = jsonText.replace(/^```json/im, '').replace(/```$/im, '').trim();
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: 'Failed to parse purchase list', details: error.message });
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
