import type { Config } from "@netlify/functions";
import { verifyAssistantJob } from "./_assistant-auth.mts";
import { formatAssistantResponse, readOpenAIResponse } from "./_assistant-response.mts";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function sameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}

export default async (request: Request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  if (!sameOrigin(request)) return json({ error: "Cross-site requests are not allowed." }, 403);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json({ error: "The assistant is not configured yet." }, 503);

  const url = new URL(request.url);
  const responseId = url.searchParams.get("responseId")?.trim() ?? "";
  const pollToken = url.searchParams.get("pollToken")?.trim() ?? "";
  if (!/^resp_[A-Za-z0-9_-]{8,}$/.test(responseId) || !pollToken) {
    return json({ error: "Invalid assistant job." }, 400);
  }
  if (!verifyAssistantJob(responseId, pollToken, apiKey)) {
    return json({ error: "Assistant job access was rejected." }, 403);
  }

  const openAIUrl = new URL(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`);
  openAIUrl.searchParams.append("include[]", "file_search_call.results");
  const response = await fetch(openAIUrl, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const data = await readOpenAIResponse(response);
  if (!response.ok) {
    console.error("OpenAI retrieval error", response.status, data.error?.message ?? "Unknown error");
    return json({ error: "The source-controlled assistant is temporarily unavailable." }, 502);
  }

  if (data.status === "queued" || data.status === "in_progress") {
    return json({ pending: true, status: data.status }, 202);
  }
  if (data.status && data.status !== "completed") {
    console.error("OpenAI background response ended", data.status, data.incomplete_details?.reason ?? "");
    return json({
      error: "The answer could not be completed. Please try the question again.",
      failureCode: data.status,
      failureReason: data.incomplete_details?.reason || "unknown",
    }, 502);
  }

  return json(formatAssistantResponse(data));
};

export const config: Config = {
  path: "/api/assistant/status",
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
