import { NextResponse } from "next/server";
import { getCharacter } from "@/characters";
import {
  sanitizeAffinity,
  sanitizeCharId,
  sanitizeCompanionIdlePoke,
  sanitizeCompanionIdleVenue,
  sanitizeConversationMessages,
  sanitizeInviteType,
  sanitizeModelReply,
  sanitizePostEndingCouplePlay,
  sanitizeTeaDateCafeFlag,
  sanitizeTeaDateBarFlag,
  sanitizeTeaDateCafeMaxTurns,
  sanitizeTeaDateCafeTurnsInScene,
  sanitizeUserMessage,
  LIMITS,
} from "@/lib/apiValidation";
import { companionIdleCueForVenue } from "@/lib/companionIdle";
import { interpolateCafeSceneSystemPrompt } from "@/lib/cafeScenePrompt";
import { extractJson, getModel, toGeminiHistory } from "@/lib/gemini";
import {
  buildInnerRulesForUnified,
  buildPostEndingCoupleUnifiedAppend,
  buildSurfacePromptForUnified,
  buildUnifiedChatJsonContract,
} from "@/lib/prompts";
import { buildAddressingGuidance, interpolateUserName } from "@/lib/promptInterpolate";
import { sanitizeUserName } from "@/lib/userProfile";
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

  let charId = sanitizeCharId(b.charId);
  if (!charId && b.character != null && typeof b.character === "object") {
    charId = sanitizeCharId(
      (b.character as Record<string, unknown>).charId ??
        (b.character as Record<string, unknown>).id
    );
  }

  const postEndingCouplePlay = sanitizePostEndingCouplePlay(
    (b as Record<string, unknown>).postEndingCouplePlay
  );
  const companionIdlePoke = sanitizeCompanionIdlePoke(
    (b as Record<string, unknown>).companionIdlePoke
  );

  let userMessage: string | null = sanitizeUserMessage(b.userMessage);
  if (companionIdlePoke) {
    if (!postEndingCouplePlay) {
      return NextResponse.json(
        { error: "無言イベントは続きモードでのみ利用できます。" },
        { status: 400 }
      );
    }
    const venue = sanitizeCompanionIdleVenue(
      (b as Record<string, unknown>).companionIdleVenue
    );
    userMessage = companionIdleCueForVenue(venue);
  }

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

  const affinityCap = postEndingCouplePlay ? 200 : 100;
  const affinity = sanitizeAffinity(b.affinity, affinityCap);
  const inviteAcceptance = sanitizeInviteType(b.inviteType);
  const teaDateCafe = sanitizeTeaDateCafeFlag(b.teaDateCafe);
  const teaDateBar = sanitizeTeaDateBarFlag(b.teaDateBar);
  const teaDateVenueMode: "cafe" | "bar" | null = teaDateCafe
    ? "cafe"
    : teaDateBar
      ? "bar"
      : null;
  const teaDateCafeTurns = sanitizeTeaDateCafeTurnsInScene(b.turnsInScene);
  const teaDateCafeMaxTurns = sanitizeTeaDateCafeMaxTurns(b.maxTurns);
  const rawUserName =
    typeof b.userName === "string"
      ? b.userName
      : typeof b.playerDisplayName === "string"
        ? b.playerDisplayName
        : "";

  const userName = sanitizeUserName(rawUserName) || "あなた";

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
        ? character.barInviteAcceptanceSystemPrompt?.trim() ||
          character.drinkAcceptanceSystemPrompt?.trim() ||
          ""
        : "";

  const venueScenarioStatic =
    teaDateVenueMode === "cafe"
      ? character.teaDateScenePrompt?.trim() ?? ""
      : "";

  const venueScenarioDynamicRaw =
    teaDateVenueMode === "cafe"
      ? character.cafeSceneSystemPrompt?.trim() ?? ""
      : teaDateVenueMode === "bar"
        ? character.barSceneSystemPrompt?.trim() ?? ""
        : "";
  const venueScenarioDynamic =
    teaDateVenueMode && venueScenarioDynamicRaw
      ? interpolateCafeSceneSystemPrompt(
          venueScenarioDynamicRaw,
          teaDateCafeTurns,
          teaDateCafeMaxTurns
        )
      : "";

  const venueScenarioAppendUncapped =
    teaDateVenueMode ?
      [
        venueScenarioStatic,
        ...(venueScenarioDynamic ? [venueScenarioDynamic] : []),
      ].filter(Boolean).join("\n\n")
    : "";

  const venueScenarioAppend =
    teaDateVenueMode ?
      venueScenarioAppendUncapped.slice(0, LIMITS.MAX_SYSTEM_PROMPT_APPEND)
    : "";

  const addressingGuidance = buildAddressingGuidance(userName, affinity);
  const surfaceUnifiedInterpolated = interpolateUserName(
    buildSurfacePromptForUnified(character),
    userName
  );
  const innerRulesInterpolated = interpolateUserName(
    buildInnerRulesForUnified(character),
    userName
  );

  const venuePromptInterpolated =
    teaDateVenueMode && venueScenarioAppend
      ? interpolateUserName(venueScenarioAppend, userName)
      : "";

  const inviteInterpolatedOnly =
    !teaDateVenueMode && inviteFallback.trim()
      ? interpolateUserName(inviteFallback.trim(), userName)
      : "";

  const postEndingCoupleUnified = postEndingCouplePlay
    ? buildPostEndingCoupleUnifiedAppend(character, userName)
    : "";

  const idlePokeUnified = companionIdlePoke
    ? `【無言イベント】ユーザーはこの〜30秒ほど自分から喋っていない（システム裏指示）。キャラ側から短いひとことを返してください。reply は1〜2文、押しつけがましくしない。親密トリガであり雑談でよい。affinityChange は 0 が中心（強い感情の揺らぎのみ ±1〜2）。内心はより素直でもよいが30文字以内。`
    : "";

  const unifiedSystem = [
    addressingGuidance,
    surfaceUnifiedInterpolated,
    venuePromptInterpolated,
    inviteInterpolatedOnly,
    postEndingCoupleUnified,
    idlePokeUnified,
    innerRulesInterpolated,
    buildUnifiedChatJsonContract(),
    `【参照】このターン直前のユーザー好感度は ${affinity} / ${affinityCap} です。affinityChange はこの発言への反応としての増減のみ。`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const unifiedModel = getModel(unifiedSystem);

  let reply = "";
  let inner = "";
  let affinityChange = 0;

  try {
    const chat = unifiedModel.startChat({
      history: toGeminiHistory(messages),
      generationConfig: {
        temperature: 0.84,
        maxOutputTokens: 640,
        responseMimeType: "application/json",
      },
    });
    const result = await chat.sendMessage(userMessage);
    const raw = result.response.text().trim();
    try {
      const json = JSON.parse(extractJson(raw)) as {
        reply?: unknown;
        inner?: unknown;
        affinityChange?: unknown;
      };
      if (typeof json.reply === "string" && json.reply.trim()) {
        reply = sanitizeModelReply(json.reply.trim());
      }
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
      console.error("[chat] unified JSON parse failed:", raw.slice(0, 200));
    }
    if (!reply) {
      reply =
        "（少し考えていますね……。すみません、もう一度伺ってもよいですか？）";
    }
  } catch (err) {
    console.error(
      "[chat] unified model failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    if (err instanceof Error && err.stack) console.error(err.stack);
    reply =
      "（少し考えていますね……。すみません、もう一度伺ってもよいですか？）";
    inner = "";
    affinityChange = 0;
  }

  const payload: ChatResponseBody = {
    reply,
    inner,
    affinityChange,
  };

  return NextResponse.json(payload);
}
