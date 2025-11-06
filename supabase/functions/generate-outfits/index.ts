import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base64, mimeType, userProfile, styles } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating ${styles.length} outfits for user profile:`, userProfile);

    // Generate all outfits in parallel
    const outfitPromises = styles.map(async (style: string) => {
      let prompt = `Analyze this clothing item. Based on its style and color palette, create a complete and distinct '${style}' outfit that includes it.`;

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

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64}`
                    }
                  },
                  {
                    type: "text",
                    text: prompt
                  }
                ]
              }
            ],
            modalities: ["image", "text"]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`AI gateway error for ${style}:`, response.status, errorText);
          
          if (response.status === 429) {
            return { style, error: "Rate limit exceeded. Please try again later." };
          }
          if (response.status === 402) {
            return { style, error: "AI credits depleted. Please add credits to continue." };
          }
          
          return { style, error: `Failed to generate ${style} outfit` };
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          console.error(`No image returned for ${style}`);
          return { style, error: `Failed to generate ${style} outfit` };
        }

        console.log(`Successfully generated ${style} outfit`);
        return { style, imageUrl };
      } catch (error) {
        console.error(`Error generating ${style} outfit:`, error);
        return { style, error: error instanceof Error ? error.message : "Unknown error" };
      }
    });

    const outfits = await Promise.all(outfitPromises);

    return new Response(JSON.stringify({ outfits }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-outfits function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
