import { NextResponse } from "next/server";
import { getCharacter } from "@/characters";
import {
  LIMITS,
  sanitizeAnalysisBullets,
  sanitizeAnalysisComment,
  sanitizeCharId,
  sanitizeConversationMessages,
} from "@/lib/apiValidation";
import { extractJson, getModel } from "@/lib/gemini";
import { buildAnalysisPrompt, buildAnalysisUserMessage } from "@/lib/prompts";
import type { AnalysisAxes, AnalysisResult } from "@/types";

export const runtime = "nodejs";

const AXIS_KEYS: (keyof AnalysisAxes)[] = [
  "listening",
  "expressing",
  "acting",
  "protecting",
  "perceiving",
];

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const charId = sanitizeCharId(b.charId);
  const messages = sanitizeConversationMessages(
    b.messages,
    LIMITS.MAX_ANALYSIS_MESSAGES
  );

  if (!charId || messages.length === 0) {
    return NextResponse.json(
      {
        error:
          "無効なリクエストです。会話が空か、許容件数・文字数を超えています。",
      },
      { status: 400 }
    );
  }

  const character = getCharacter(charId);
  if (!character) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "サーバーが正しく設定されていません。" },
      { status: 500 }
    );
  }

  const model = getModel(buildAnalysisPrompt(character));

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: buildAnalysisUserMessage(messages) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    });

    const raw = result.response.text();
    const parsed = JSON.parse(extractJson(raw)) as {
      totalScore?: unknown;
      axes?: Record<string, unknown>;
      goodPoints?: unknown;
      improvements?: unknown;
      comment?: unknown;
    };

    const axes: AnalysisAxes = {
      listening: 0,
      expressing: 0,
      acting: 0,
      protecting: 0,
      perceiving: 0,
    };
    if (parsed.axes && typeof parsed.axes === "object") {
      for (const key of AXIS_KEYS) {
        axes[key] = clampScore(parsed.axes[key]);
      }
    }

    const analysis: AnalysisResult = {
      totalScore: clampScore(parsed.totalScore),
      axes,
      goodPoints: sanitizeAnalysisBullets(parsed.goodPoints),
      improvements: sanitizeAnalysisBullets(parsed.improvements),
      comment: sanitizeAnalysisComment(parsed.comment) ?? "",
    };

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze] failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "分析処理に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
