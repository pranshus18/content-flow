import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export interface GenerateCaptionInput {
  userDescription?: string;
  title?: string;
  platform?: string;
  mediaType?: string;
}

export interface GenerateCaptionResult {
  success: boolean;
  caption?: string;
  error?: string;
}

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
- Feels authentic and relatable`,
};

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textItem = content.find((item) => item && typeof item === 'object' && 'text' in item);
    return textItem && typeof textItem === 'object' && 'text' in textItem
      ? String((textItem as { text: unknown }).text || '')
      : '';
  }
  return '';
}

function cleanCaption(caption: string): string {
  return caption.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
}

export async function generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionResult> {
  const { userDescription, title, platform, mediaType } = input;

  logger.info('generate-caption', 'Request received', {
    hasUserDescription: !!userDescription,
    title: title?.substring(0, 50),
    platform,
    mediaType,
  });

  if (!title) {
    return { success: false, error: 'Title is required' };
  }
  if (!platform) {
    return { success: false, error: 'Platform is required' };
  }

  const useGemini = !!env.geminiApiKey;
  const useOpenRouter = !!env.openRouterApiKey;
  const useOpenAI = !!env.openaiApiKey;
  const captionErrors: string[] = [];

  logger.info('generate-caption', 'API keys status', {
    hasGemini: useGemini,
    hasOpenRouter: useOpenRouter,
    hasOpenAI: useOpenAI,
    textModel: env.geminiTextModel,
  });

  if (!useGemini && !useOpenRouter && !useOpenAI) {
    return {
      success: false,
      error:
        'GEMINI_API_KEY is missing from backend/.env. Add your Gemini key and restart the backend.',
    };
  }

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

  if (useGemini) {
    const textModels = [...new Set([
      env.geminiTextModel || 'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ])];

    for (const model of textModels) {
      try {
        logger.info('generate-caption', `Using Gemini model ${model}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          generatedCaption = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!generatedCaption && data.candidates?.[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
              if (part.text) {
                generatedCaption = part.text;
                break;
              }
            }
          }
          if (generatedCaption) {
            logger.info('generate-caption', 'Gemini caption generated', {
              model,
              length: generatedCaption.length,
            });
            break;
          }
          captionErrors.push(`${model}: empty response`);
        } else {
          const errorText = await response.text();
          let errorMessage = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson?.error?.message || errorJson?.error || errorText;
          } catch {
            // keep text
          }
          logger.error('generate-caption', `Gemini ${model} error ${response.status}`, errorMessage);
          captionErrors.push(`${model}: ${errorMessage}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('generate-caption', `Gemini ${model} exception`, error);
        captionErrors.push(`${model}: ${message}`);
      }
    }
  }

  if (!generatedCaption && useOpenRouter) {
    try {
      logger.info('generate-caption', 'Using OpenRouter API');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://contentflow.app',
          'X-Title': 'ContentFlow Caption Generation',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        generatedCaption = extractTextContent(data.choices?.[0]?.message?.content);
        logger.info('generate-caption', 'OpenRouter caption generated', {
          length: generatedCaption.length,
        });
      } else {
        logger.error('generate-caption', `OpenRouter API error ${response.status}`, await response.text());
      }
    } catch (error) {
      logger.error('generate-caption', 'OpenRouter API exception', error);
    }
  }

  if (!generatedCaption && useOpenAI) {
    try {
      logger.info('generate-caption', 'Using OpenAI API');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        generatedCaption = extractTextContent(data.choices?.[0]?.message?.content);
        logger.info('generate-caption', 'OpenAI caption generated', { length: generatedCaption.length });
      } else {
        logger.error('generate-caption', `OpenAI API error ${response.status}`, await response.text());
      }
    } catch (error) {
      logger.error('generate-caption', 'OpenAI API exception', error);
    }
  }

  if (!generatedCaption) {
    const detail = captionErrors[0] || 'No caption was returned.';
    const error = `Caption generation failed: ${detail}`;
    logger.error('generate-caption', error);
    return { success: false, error };
  }

  return { success: true, caption: cleanCaption(generatedCaption) };
}
