import { NextResponse } from "next/server";
import { getCharacter } from "@/characters";
import {
  sanitizeAffinity,
  sanitizeCharId,
  sanitizeConversationMessages,
  sanitizeInviteType,
  sanitizeModelReply,
  sanitizeSystemPromptOverride,
  sanitizeUserMessage,
  LIMITS,
} from "@/lib/apiValidation";
import { extractJson, getModel, toGeminiHistory } from "@/lib/gemini";
import {
  buildInnerPrompt,
  buildInnerUserMessage,
  buildSurfacePrompt,
} from "@/lib/prompts";
import type { ChatResponseBody } from "@/types";

export const runtime = "nodejs";

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
  const userMessage = sanitizeUserMessage(b.userMessage);

  if (!charId || !userMessage) {
    return NextResponse.json(
      {
        error:
          "無効なリクエストです。文字数が多すぎるか、必須項目が不足しています。",
      },
      { status: 400 }
    );
  }

  const character = getCharacter(charId);
  if (!character) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

  const affinity = sanitizeAffinity(b.affinity);
  const inviteAcceptance = sanitizeInviteType(b.inviteType);
  const systemPromptOverride = sanitizeSystemPromptOverride(b.systemPromptOverride);
  const messages = sanitizeConversationMessages(
    b.messages,
    LIMITS.MAX_CHAT_HISTORY_MESSAGES
  );

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "サーバーが正しく設定されていません。" },
      { status: 500 }
    );
  }

  const inviteFallback =
    inviteAcceptance === "tea"
      ? character.teaAcceptanceSystemPrompt?.trim() ?? ""
      : inviteAcceptance === "drink"
        ? character.drinkAcceptanceSystemPrompt?.trim() ?? ""
        : "";

  const secondary = systemPromptOverride ?? inviteFallback ?? "";

  const surfaceSystem = [
    buildSurfacePrompt(character),
    secondary,
  ].filter(Boolean).join("\n\n");

  const surfaceModel = getModel(surfaceSystem);
  const innerModel = getModel(buildInnerPrompt(character));

  const surfacePromise = (async () => {
    const chat = surfaceModel.startChat({
      history: toGeminiHistory(messages),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 256,
      },
    });
    const result = await chat.sendMessage(userMessage);
    return sanitizeModelReply(result.response.text().trim());
  })();

  const innerPromise = (async () => {
    const result = await innerModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildInnerUserMessage(userMessage, affinity),
            },
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
        inner = sanitizeModelReply(json.inner).slice(0, 120);
      }
      if (
        typeof json.affinityChange === "number" &&
        Number.isFinite(json.affinityChange)
      ) {
        affinityChange = Math.max(
          -15,
          Math.min(15, Math.round(json.affinityChange))
        );
      }
    } catch {
      inner = "";
      affinityChange = 0;
      console.error("[chat] inner JSON parse failed");
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
