import { NextResponse } from "next/server";
import { getCharacter } from "@/characters/hanasaki";
import { extractJson, getModel } from "@/lib/gemini";
import { buildAnalysisPrompt, buildAnalysisUserMessage } from "@/lib/prompts";
import type {
  AnalysisAxes,
  AnalysisResult,
  AnalyzeRequestBody,
} from "@/types";

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

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 5);
}

export async function POST(req: Request) {
  let body: AnalyzeRequestBody;
  try {
    body = (await req.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { charId, messages } = body;
  if (!charId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "charId と messages（非空）が必要です" },
      { status: 400 }
    );
  }

  const character = getCharacter(charId);
  if (!character) {
    return NextResponse.json(
      { error: `Unknown character: ${charId}` },
      { status: 404 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が未設定です。" },
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
      goodPoints: ensureStringArray(parsed.goodPoints),
      improvements: ensureStringArray(parsed.improvements),
      comment:
        typeof parsed.comment === "string" ? parsed.comment : undefined,
    };

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze] failed", err);
    return NextResponse.json(
      { error: "分析に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
