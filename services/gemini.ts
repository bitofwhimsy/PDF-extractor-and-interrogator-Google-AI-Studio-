
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedDocument } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractPdfMetadata(file: File): Promise<ExtractedDocument> {
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          {
            text: `Analyze this PDF document and extract structured metadata. 
            Focus on identifying the sender (who wrote it), the recipient, the date, and providing a comprehensive transcription of the content.
            Return the result in JSON format.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sender: { type: Type.STRING, description: "Name of the person or entity who sent the document." },
          recipient: { type: Type.STRING, description: "Name of the person or entity who received the document." },
          date: { type: Type.STRING, description: "Date of the document if available." },
          summary: { type: Type.STRING, description: "A brief 2-sentence summary of the document." },
          content: { type: Type.STRING, description: "Complete extracted text content of the document." },
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of key topics mentioned."
          },
          confidence: { type: Type.NUMBER, description: "Confidence score 0-1 for the extraction accuracy." }
        },
        required: ["sender", "recipient", "content", "summary"],
      },
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      ...data,
    };
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("Failed to process document");
  }
}

export async function interrogateDocuments(
  query: string,
  documents: ExtractedDocument[],
  history: { role: 'user' | 'assistant'; text: string }[]
): Promise<string> {
  const context = documents
    .map(
      (doc) =>
        `[Document: ${doc.fileName}, Sender: ${doc.sender}, Recipient: ${doc.recipient}, Date: ${doc.date}]\nContent: ${doc.content}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are a professional assistant analyzing a collection of uploaded documents. 
  Below is the content of all currently uploaded documents. 
  Your job is to answer the user's questions accurately based ONLY on the provided context. 
  If the user asks "What did Jane say?", find all documents where Jane is the sender and synthesize her messages.
  
  CONTEXT:
  ${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: query }] }
    ],
    config: {
      systemInstruction: systemPrompt,
    },
  });

  return response.text || "I couldn't find any information regarding that query in the provided documents.";
}
