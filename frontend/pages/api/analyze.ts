// pages/api/analyze.ts

import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_SECRET_KEY;

if (!apiKey) {
    console.error("ERROR: OPENAI_SECRET_KEY is not defined.");
    // 開発時に気づきやすくするため、サーバー起動時にエラーをスローする方が望ましいですが、
    // API Route内ではリクエスト時にエラーレスポンスを返します。
}

const openai = new OpenAI({ apiKey: apiKey });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // HTTPメソッドのチェック (POSTリクエストのみを許可)
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const { instruction } = req.body;

    if (!instruction) {
        return res.status(400).json({ error: 'Missing "instruction" in request body.' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: instruction }],
            max_tokens: 800,
            temperature: 0.2,
        });

        const analysisResult = response.choices[0].message.content;

        return res.status(200).json({ analysis: analysisResult });

    } catch (error) {
        console.error("OpenAI API call failed:", error);

        return res.status(500).json({
            error: 'Failed to fetch analysis from AI service.',
            details: process.env.NODE_ENV === 'development' ? (error as any).message : undefined // 開発環境でのみ詳細を返す
        });
    }
}
