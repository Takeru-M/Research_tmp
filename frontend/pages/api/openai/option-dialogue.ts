import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_SECRET_KEY;

if (!apiKey) {
    console.error("ERROR: OPENAI_SECRET_KEY is not defined.");
}

const openai = new OpenAI({ apiKey: apiKey });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // HTTPメソッドのチェック (POSTリクエストのみを許可)
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const { systemPrompt, userInput } = req.body;

    if (!systemPrompt) {
        return res.status(400).json({ error: 'Missing "systemPrompt" in request body.' });
    } else if (!userInput) {
        return res.status(400).json({ error: 'Missing "userInput" in request body.' });
    }

    // userInput のバリデーション
    if (!userInput.pdf_text) {
        return res.status(400).json({ error: 'Missing "pdf_text" in userInput.' });
    }
    if (!Array.isArray(userInput.selected_threads) || userInput.selected_threads.length === 0) {
        return res.status(400).json({ error: 'Missing or empty "selected_threads" in userInput.' });
    }

    try {
        console.log('[option-dialogue] Starting OpenAI API call...');
        console.log('[option-dialogue] Selected threads count:', userInput.selected_threads.length);

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: JSON.stringify(userInput, null, 2) }
            ],
            response_format: { type: "json_object" },
        });

        const analysisResult = response.choices[0].message.content;

        console.log('[option-dialogue] OpenAI API call successful');
        console.log('[option-dialogue] Response length:', analysisResult?.length || 0);

        return res.status(200).json({ analysis: analysisResult });

    } catch (error) {
        console.error("[option-dialogue] OpenAI API call failed:", error);

        // エラーの詳細をログ出力
        if (error instanceof Error) {
            console.error("[option-dialogue] Error message:", error.message);
            console.error("[option-dialogue] Error stack:", error.stack);
        }

        return res.status(500).json({
            error: 'Failed to fetch dialogue response from AI service.',
            details: process.env.NODE_ENV === 'development' ? (error as any).message : undefined
        });
    }
}