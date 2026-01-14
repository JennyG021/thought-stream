import { GoogleGenAI, Type } from "@google/genai";
import { ThoughtAnalysis } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("API Key is missing. Please set API_KEY in your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeThought = async (content: string, images?: string[]): Promise<{ analysis: ThoughtAnalysis, questions: string[] }> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const parts: any[] = [{ 
    text: `You are a dual-mode AI assistant: 
    1. THE LISTENER: Quietly archive the user's thought. Extract 2-4 tags (categories) and a concise summary.
    2. THE COACH: Based on the content, provide 1 or 2 growth-oriented, challenging follow-up questions to help them reflect or improve.
    
    Format the output as JSON.
    
    User Entry: "${content}"` 
  }];

  if (images && images.length > 0) {
    for (const img of images) {
      const base64Data = img.includes(',') ? img.split(',')[1] : img;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
    }
    parts[0].text += "\n\nPlease also consider the visual context from the attached images.";
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING, description: "A neutral, brief archival summary of the entry." },
          questions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Coaching questions for self-improvement." }
        },
        required: ['sentiment', 'tags', 'summary', 'questions']
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  
  return {
    analysis: {
      sentiment: result.sentiment || 'neutral',
      tags: result.tags || [],
      summary: result.summary || ''
    },
    questions: result.questions || []
  };
};

export const getReflectionPrompt = async (recentThoughts: string[]): Promise<string> => {
    try {
      const ai = getAI();
      const model = "gemini-3-flash-preview";
      const promptText = `Based on these recent thoughts: ${recentThoughts.join(' | ')}. Ask one intriguing reflection question to help the user grow or find clarity. Be crisp and professional.`;
      
      const response = await ai.models.generateContent({
          model,
          contents: promptText
      });
      
      return response.text || "What's the one thing you want to achieve today?";
    } catch (e) {
      console.warn("Could not fetch reflection prompt (likely missing API key):", e);
      return "What are you thinking about right now?";
    }
};
