import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid request body. Expected JSON." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userDescription, title, platform, mediaType } = requestBody;
    
    console.log("Generate caption request received:", {
      hasUserDescription: !!userDescription,
      title: title?.substring(0, 50),
      platform,
      mediaType
    });
    
    // Validate required fields
    if (!title) {
      throw new Error("Title is required");
    }
    
    if (!platform) {
      throw new Error("Platform is required");
    }
    
    // Get API keys
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    console.log("API keys status:", {
      hasGemini: !!GEMINI_API_KEY,
      hasOpenRouter: !!OPENROUTER_API_KEY,
      hasOpenAI: !!OPENAI_API_KEY
    });
    
    const API_KEY = GEMINI_API_KEY || OPENROUTER_API_KEY || OPENAI_API_KEY;
    
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY is not configured in Supabase Edge Functions secrets. Please set one of these in your Supabase project settings.");
    }

    // Determine which API to use (prioritize GEMINI_API_KEY, but allow fallback)
    const useGemini = !!GEMINI_API_KEY;
    const useOpenRouter = !!OPENROUTER_API_KEY; // Allow OpenRouter even if Gemini exists (as fallback)
    const useOpenAI = !!OPENAI_API_KEY;

    // Platform-specific guidelines
    const platformGuidelines: Record<string, string> = {
      instagram: `Create an engaging Instagram caption that:
- Uses 5-10 relevant hashtags
- Is visually engaging and tells a story
- Includes a call-to-action
- Is optimized for engagement
- Keep it between 100-300 words`,
      twitter: `Create a concise Twitter post that:
- Stays within 280 characters
- Uses 1-2 relevant hashtags
- Is punchy and engaging
- Can include emojis for visual appeal`,
      linkedin: `Create a professional LinkedIn post that:
- Uses 3-5 relevant hashtags
- Has a professional and informative tone
- Includes industry insights or value
- Is between 100-300 words
- Encourages professional engagement`,
      facebook: `Create a conversational Facebook post that:
- Uses 2-3 relevant hashtags
- Has a friendly and engaging tone
- Asks questions to encourage engagement
- Is between 100-300 words
- Feels authentic and relatable`
    };

    const guidelines = platformGuidelines[platform] || platformGuidelines.instagram;

    const prompt = `You are an expert social media content writer. Based on the user's original description, create an optimized ${platform} post caption.

USER'S ORIGINAL DESCRIPTION:
"${userDescription || 'No description provided'}"

CONTENT TITLE: ${title}
PLATFORM: ${platform}
MEDIA TYPE: ${mediaType || 'image'}

${guidelines}

IMPORTANT REQUIREMENTS:
1. Use the user's description as inspiration, but rewrite it professionally for ${platform}
2. Make it engaging, professional, and optimized for the platform
3. Include appropriate hashtags based on the content
4. Ensure it's ready to post directly (no placeholders)
5. Do NOT include the user's description verbatim - rewrite it professionally
6. Make it compelling and platform-appropriate
7. NOTE: This generated caption will be saved as admin-written content (admin_description field)

Generate the optimized ${platform} caption now:`;

    let generatedCaption = '';

    // Use Gemini API (direct)
    if (useGemini) {
      try {
        console.log("Using Gemini API for caption generation...");
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }]
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          generatedCaption = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Also try alternative response structure
          if (!generatedCaption && data.candidates?.[0]?.content?.parts) {
            const parts = data.candidates[0].content.parts;
            for (const part of parts) {
              if (part.text) {
                generatedCaption = part.text;
                break;
              }
            }
          }
          
          console.log("Gemini caption generated successfully", { 
            length: generatedCaption.length,
            hasCaption: !!generatedCaption 
          });
        } else {
          let errorText = '';
          let errorJson: any = null;
          try {
            errorText = await response.text();
            try {
              errorJson = JSON.parse(errorText);
            } catch (e) {
              // Not JSON, use text as is
            }
          } catch (e) {
            errorText = `Status ${response.status}: ${response.statusText}`;
          }
          
          const errorMessage = errorJson?.error?.message || errorJson?.error || errorText || `HTTP ${response.status}`;
          console.error("Gemini API error response:", response.status, errorMessage);
          
          // If it's a clear API key issue, throw immediately
          if (response.status === 401 || response.status === 403 || errorMessage.includes('API key') || errorMessage.includes('invalid') || errorMessage.includes('quota')) {
            throw new Error(`Gemini API error: ${errorMessage}`);
          }
          // Don't throw for other errors, try next API
        }
      } catch (error) {
        console.error("Gemini API error:", error);
        // Don't throw here, try next API
      }
    }

    // Use OpenRouter (with Gemini or other models)
    if (!generatedCaption && useOpenRouter) {
      try {
        console.log("Using OpenRouter API for caption generation...");
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://contentflow.app",
            "X-Title": "ContentFlow Caption Generation"
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{
              role: "user",
              content: prompt
            }],
            max_tokens: 500
          }),
        });

        if (response.ok) {
          const data = await response.json();
          generatedCaption = data.choices?.[0]?.message?.content || '';
          
          // Handle string content or array content
          if (typeof generatedCaption === 'string') {
            // Already a string, good
          } else if (Array.isArray(generatedCaption)) {
            // Extract text from array
            const textItem = (generatedCaption as any[]).find((item: any) => item.type === 'text');
            generatedCaption = textItem?.text || '';
          }
          
          console.log("OpenRouter caption generated successfully", { 
            length: generatedCaption.length,
            hasCaption: !!generatedCaption 
          });
        } else {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = `Status ${response.status}: ${response.statusText}`;
          }
          console.error("OpenRouter API error response:", response.status, errorText);
          // Don't throw, try next API
        }
      } catch (error) {
        console.error("OpenRouter API error:", error);
        // Don't throw here, try next API
      }
    }

    // Use OpenAI as fallback
    if (!generatedCaption && useOpenAI) {
      try {
        console.log("Using OpenAI API for caption generation...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
              role: "user",
              content: prompt
            }],
            max_tokens: 500
          }),
        });

        if (response.ok) {
          const data = await response.json();
          generatedCaption = data.choices?.[0]?.message?.content || '';
          
          // Handle string content
          if (typeof generatedCaption === 'string') {
            // Already a string, good
          } else if (Array.isArray(generatedCaption)) {
            // Extract text from array
            const textItem = (generatedCaption as any[]).find((item: any) => item.type === 'text');
            generatedCaption = textItem?.text || '';
          }
          
          console.log("OpenAI caption generated successfully", { 
            length: generatedCaption.length,
            hasCaption: !!generatedCaption 
          });
        } else {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = `Status ${response.status}: ${response.statusText}`;
          }
          console.error("OpenAI API error response:", response.status, errorText);
          // Don't throw, try next API
        }
      } catch (error) {
        console.error("OpenAI API error:", error);
      }
    }

    if (!generatedCaption) {
      const triedApis: string[] = [];
      if (useGemini) triedApis.push('Gemini');
      if (useOpenRouter) triedApis.push('OpenRouter');
      if (useOpenAI) triedApis.push('OpenAI');
      
      const errorMsg = `Failed to generate caption. Tried: ${triedApis.join(', ')}. Please check your API keys in Supabase Edge Functions secrets and verify they are valid and have quota remaining.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Clean up the caption (remove markdown formatting if present)
    generatedCaption = generatedCaption
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim();

    return new Response(
      JSON.stringify({ 
        success: true,
        caption: generatedCaption
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-caption function:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Returning error response:", message);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

