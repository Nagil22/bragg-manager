import { Recommendation } from '../../shared/types';
import { getApiKey } from '../config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-haiku-3';

interface AISuggestion {
  id: string;
  action?: string;
  suggestedFolder?: string;
  aiReason?: string;
}

interface AIResponse {
  recommendations: AISuggestion[];
}

export async function enhanceWithAI(ruleRecs: Recommendation[]): Promise<Recommendation[]> {
  const apiKey = getApiKey() ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('No API key configured – AI enhancement disabled.');
    return ruleRecs;
  }

  try {
    const payload = ruleRecs.map(rec => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      actionType: rec.type,
      files: rec.files.slice(0, 10).map(f => ({       // cap at 10 to keep prompt small
        name: f.name,
        type: f.type,
        size: formatBytesAI(f.size),
        ageDays: Math.round((Date.now() - f.mtime) / (24 * 60 * 60 * 1000)),
      })),
    }));

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://braggmanager.app',
        'X-Title': 'Bragg Manager',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: [
              'You are a storage organisation expert. Analyse each recommendation and return a JSON object.',
              'For "move" actions: suggest a concise human-readable destination folder path on an external drive (e.g. "/Volumes/MyDrive/Old Videos").',
              'For "delete" actions: confirm or suggest a safer alternative.',
              'Add a brief "aiReason" (max 15 words) explaining the suggestion.',
              'Only change the "action" field if you are highly confident the original is wrong.',
              'Return ONLY valid JSON matching this schema: { "recommendations": [{ "id": string, "suggestedFolder"?: string, "aiReason"?: string, "action"?: string }] }',
            ].join(' '),
          },
          { role: 'user', content: JSON.stringify({ recommendations: payload }) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${body}`);
    }

    const data: any = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response from AI');

    const parsed: AIResponse = JSON.parse(raw);
    const suggestions: AISuggestion[] = Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
      : [];

    return ruleRecs.map(rec => {
      const aiRec = suggestions.find(a => a.id === rec.id);
      if (!aiRec) return rec;
      return {
        ...rec,
        action: aiRec.action || rec.action,
        description: aiRec.aiReason
          ? `${rec.description} — 🤖 ${aiRec.aiReason}`
          : rec.description,
        suggestedFolder: aiRec.suggestedFolder ?? undefined,
        aiEnhanced: true,
        aiReason: aiRec.aiReason ?? undefined,
      };
    });
  } catch (err) {
    console.error('AI enhancement failed, falling back to rules:', err);
    return ruleRecs;
  }
}

function formatBytesAI(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 ** 3)).toFixed(2) + ' GB';
}
