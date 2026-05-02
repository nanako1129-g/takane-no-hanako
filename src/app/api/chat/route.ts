import { NextResponse } from "next/server";
import { getCharacter } from "@/characters/hanasaki";
import { extractJson, getModel, toGeminiHistory } from "@/lib/gemini";
import {
  buildInnerPrompt,
  buildInnerUserMessage,
  buildSurfacePrompt,
} from "@/lib/prompts";
import type { ChatRequestBody, ChatResponseBody } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { charId, messages, userMessage, affinity } = body;

  if (!charId || !userMessage) {
    return NextResponse.json(
      { error: "charId and userMessage are required" },
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
      {
        error:
          "GEMINI_API_KEY が未設定です。プロジェクトルートの .env.local に設定してください。",
      },
      { status: 500 }
    );
  }

  const surfaceModel = getModel(buildSurfacePrompt(character));
  const innerModel = getModel(buildInnerPrompt(character));

  // 表面応答 ─ 既存の会話履歴 + 今回のユーザー発言
  const surfacePromise = (async () => {
    const chat = surfaceModel.startChat({
      history: toGeminiHistory(messages ?? []),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 256,
      },
    });
    const result = await chat.sendMessage(userMessage);
    return result.response.text().trim();
  })();

  // 内心生成 ─ 直前のユーザー発言 + 現在の好感度
  const innerPromise = (async () => {
    const result = await innerModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: buildInnerUserMessage(userMessage, affinity) },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
      },
    });
    return result.response.text();
  })();

  const [surfaceSettled, innerSettled] = await Promise.allSettled([
    surfacePromise,
    innerPromise,
  ]);

  let reply = "";
  if (surfaceSettled.status === "fulfilled") {
    reply = surfaceSettled.value;
  } else {
    const reason = surfaceSettled.reason;
    console.error(
      "[chat] surface failed:",
      reason instanceof Error ? `${reason.name}: ${reason.message}` : reason
    );
    if (reason instanceof Error && reason.stack) {
      console.error(reason.stack);
    }
    reply =
      "（少し考えていますね……。すみません、もう一度伺ってもよいですか？）";
  }

  let inner = "";
  let affinityChange = 0;
  if (innerSettled.status === "fulfilled") {
    try {
      const json = JSON.parse(extractJson(innerSettled.value)) as {
        inner?: unknown;
        affinityChange?: unknown;
      };
      if (typeof json.inner === "string") {
        inner = json.inner.slice(0, 60);
      }
      if (typeof json.affinityChange === "number" && Number.isFinite(json.affinityChange)) {
        affinityChange = Math.max(-15, Math.min(15, Math.round(json.affinityChange)));
      }
    } catch (err) {
      console.error("[chat] inner JSON parse failed", err, innerSettled.value);
      inner = "";
      affinityChange = 0;
    }
  } else {
    const reason = innerSettled.reason;
    console.error(
      "[chat] inner failed:",
      reason instanceof Error ? `${reason.name}: ${reason.message}` : reason
    );
  }

  const payload: ChatResponseBody = {
    reply,
    inner,
    affinityChange,
  };

  return NextResponse.json(payload);
}
