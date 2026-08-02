export type FileCitation = {
  type: "file_citation";
  file_id?: string;
  filename?: string;
  index?: number;
};

export type SearchResult = {
  file_id?: string;
  filename?: string;
  text?: string;
  score?: number;
};

type OpenAIOutput = {
  type?: string;
  results?: SearchResult[];
  content?: Array<{
    type?: string;
    text?: string;
    annotations?: FileCitation[];
  }>;
};

export type OpenAIResponse = {
  id?: string;
  status?: string;
  output?: OpenAIOutput[];
  error?: { message?: string };
  incomplete_details?: { reason?: string };
};

function uniqueCitations(items: FileCitation[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.file_id ?? ""}:${item.filename ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function citationsFromResults(results: SearchResult[]) {
  return uniqueCitations(results
    .filter((item) => item.file_id || item.filename)
    .map((item) => ({
      type: "file_citation" as const,
      file_id: item.file_id,
      filename: item.filename,
    })));
}

export async function readOpenAIResponse(response: Response): Promise<OpenAIResponse> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as OpenAIResponse;
  } catch {
    console.error("OpenAI returned a non-JSON response", response.status, raw.slice(0, 180));
    return { error: { message: "The model service returned an unexpected response." } };
  }
}

export function formatAssistantResponse(data: OpenAIResponse) {
  const output = data.output ?? [];
  const results = output
    .filter((item) => item.type === "file_search_call")
    .flatMap((item) => item.results ?? []);
  const textItems = output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text);
  const answer = textItems.map((item) => item.text).join("\n").trim();
  const nativeCitations = uniqueCitations(textItems.flatMap((item) => item.annotations ?? []));
  const citations = nativeCitations.length > 0 ? nativeCitations : citationsFromResults(results);

  if (!answer || (results.length === 0 && citations.length === 0)) {
    return {
      answer: "The approved corpus did not provide enough citable evidence for this question. Check the current authority requirements, approved TDP/TMP, and the relevant code section before making a decision.",
      abstained: true,
      citations: [],
      evidence: results.slice(0, 3).map((item) => ({
        filename: item.filename || "Approved source",
        excerpt: String(item.text ?? "").slice(0, 450),
        score: item.score,
      })),
      responseId: data.id,
    };
  }

  return {
    answer,
    abstained: false,
    citations: citations.map((item) => ({
      fileId: item.file_id,
      filename: item.filename || "Approved source",
    })),
    citationMode: nativeCitations.length > 0 ? "native-file-citation" : "retrieved-evidence",
    evidence: results.slice(0, 5).map((item) => ({
      filename: item.filename || "Approved source",
      excerpt: String(item.text ?? "").slice(0, 650),
      score: item.score,
    })),
    responseId: data.id,
  };
}
