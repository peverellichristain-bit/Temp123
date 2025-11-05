import { GoogleGenAI, Modality } from "@google/genai";
import type { Outfit, UserProfile } from '../types';
import { OUTFIT_STYLES } from '../constants';

// Gemini API key
const API_KEY = 'AIzaSyBvRerOdKfoXVueDHJH15wPnmL9I34xn1M';

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.5-flash-image';

const generateSingleOutfit = async (base64: string, mimeType: string, style: string, userProfile: UserProfile): Promise<Outfit> => {
  let prompt = `Analyze this clothing item. Based on its style and color palette, create a complete and distinct '${style}' outfit that includes it.`;

  // Add personalization from user profile
  if (userProfile.preferredStyles.length > 0) {
    prompt += ` The outfit should align with these preferred styles: ${userProfile.preferredStyles.join(', ')}.`;
  }
  if (userProfile.favoriteColors.trim()) {
    prompt += ` Try to incorporate these favorite colors: ${userProfile.favoriteColors}.`;
  }
  if (userProfile.disliked.trim()) {
    prompt += ` Please strictly avoid these colors, patterns, or items: ${userProfile.disliked}.`;
  }

  prompt += ` Visualize the entire outfit as a clean, minimalist 'flat-lay' style image on a neutral, solid-color background. Do not include any text, logos, or human models on the image. The item provided should be the central piece of the outfit.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  
  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
  if (!imagePart || !imagePart.inlineData) {
    throw new Error(`Failed to generate image for ${style} style.`);
  }

  const generatedBase64 = imagePart.inlineData.data;
  const generatedMimeType = imagePart.inlineData.mimeType;

  return {
    style,
    imageUrl: `data:${generatedMimeType};base64,${generatedBase64}`,
  };
};

export const generateOutfits = async (base64: string, mimeType: string, userProfile: UserProfile): Promise<Outfit[]> => {
  const promises = OUTFIT_STYLES.map(style => generateSingleOutfit(base64, mimeType, style, userProfile));
  return Promise.all(promises);
};

export const editOutfitImage = async (base64: string, mimeType: string, prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
  if (!imagePart || !imagePart.inlineData) {
    throw new Error('Failed to edit image.');
  }

  const newBase64 = imagePart.inlineData.data;
  const newMimeType = imagePart.inlineData.mimeType;

  return `data:${newMimeType};base64,${newBase64}`;
};
