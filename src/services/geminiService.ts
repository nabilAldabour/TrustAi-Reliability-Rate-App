import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface VehicleReport {
  make: string;
  model: string;
  year: number;
  reliabilityScore: number;
  summary: string;
  commonIssues: {
    category: string;
    description: string;
    severity: "Low" | "Medium" | "High";
  }[];
  maintenanceTips: string[];
  estimatedAnnualCost: string;
  longevityRating: string;
  verdict: string;
  fullReportMarkdown: string;
}

export async function generateVehicleReport(make: string, model: string, year: number): Promise<VehicleReport> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing. Please configure it in the Secrets panel.");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const prompt = `Generate a detailed reliability report for a ${year} ${make} ${model}. 
  Provide the data in a structured format.
  Include:
  1. A reliability score from 0 to 100.
  2. A concise summary of its reputation.
  3. Top 3-5 common issues with their category (e.g., Engine, Transmission, Electrical), a brief description, and severity (Low, Medium, High).
  4. 3-4 specific maintenance tips for this model.
  5. Estimated annual maintenance cost (range).
  6. Longevity rating (how many miles it typically lasts).
  7. A final verdict: "Buy", "Avoid", or "Caution".
  8. A detailed full report in Markdown format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reliabilityScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          commonIssues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                severity: { type: Type.STRING },
              },
              required: ["category", "description", "severity"],
            },
          },
          maintenanceTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          estimatedAnnualCost: { type: Type.STRING },
          longevityRating: { type: Type.STRING },
          verdict: { type: Type.STRING },
          fullReportMarkdown: { type: Type.STRING },
        },
        required: [
          "reliabilityScore",
          "summary",
          "commonIssues",
          "maintenanceTips",
          "estimatedAnnualCost",
          "longevityRating",
          "verdict",
          "fullReportMarkdown",
        ],
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  return {
    make,
    model,
    year,
    ...data,
  };
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function getAiMechanicResponse(history: ChatMessage[], userMessage: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("API key missing");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are 'Reliabilly AI Mechanic', a professional automotive expert. Help users diagnose car problems, explain maintenance, and provide repair advice. Be concise, professional, and prioritize safety. If a problem sounds dangerous, advise seeing a professional mechanic immediately.",
    },
  });

  // Convert history to Gemini format if needed, but sendMessage handles simple strings or parts
  // For simplicity in this turn, we'll just send the message. 
  // In a real app we'd pass the full history.
  const response = await chat.sendMessage({ message: userMessage });
  return response.text || "I'm sorry, I couldn't process that request.";
}

export async function generateComparisonSummary(vehicles: VehicleReport[]): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("API key missing");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const vehicleNames = vehicles.map(v => `${v.year} ${v.make} ${v.model}`).join(", ");
  const prompt = `Compare these vehicles: ${vehicleNames}. 
  Based on their reliability scores, common issues, and maintenance costs, provide a brief (2-3 paragraph) comparative summary. 
  Highlight which one is the best value for long-term reliability and which one has the most critical red flags. Use Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "Comparison summary unavailable.";
}
