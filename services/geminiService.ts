import { supabase } from '../src/integrations/supabase/client';
import type { Outfit, UserProfile } from '../types';
import { OUTFIT_STYLES } from '../constants';

export const generateOutfits = async (base64: string, mimeType: string, userProfile: UserProfile): Promise<Outfit[]> => {
  const { data, error } = await supabase.functions.invoke('generate-outfits', {
    body: { 
      base64, 
      mimeType, 
      userProfile,
      styles: OUTFIT_STYLES 
    }
  });

  if (error) {
    console.error('Error invoking generate-outfits:', error);
    throw new Error(error.message || 'Failed to generate outfits');
  }

  if (!data || !data.outfits) {
    throw new Error('No outfits returned from server');
  }

  // Filter out any outfits that failed and only return successful ones
  const successfulOutfits = data.outfits.filter((outfit: any) => outfit.imageUrl && !outfit.error);
  
  if (successfulOutfits.length === 0) {
    // Check if we have rate limit errors
    const rateLimitError = data.outfits.find((o: any) => o.error?.includes('Rate limit'));
    if (rateLimitError) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.');
    }
    
    const creditsError = data.outfits.find((o: any) => o.error?.includes('credits'));
    if (creditsError) {
      throw new Error('AI credits depleted. Please add credits to continue generating outfits.');
    }
    
    throw new Error('Failed to generate any outfits. Please try again.');
  }

  return successfulOutfits;
};

export const editOutfitImage = async (base64: string, mimeType: string, prompt: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('edit-outfit', {
    body: { base64, mimeType, prompt }
  });

  if (error) {
    console.error('Error invoking edit-outfit:', error);
    throw new Error(error.message || 'Failed to edit outfit');
  }

  if (!data || !data.imageUrl) {
    throw new Error('No image returned from server');
  }

  return data.imageUrl;
};
