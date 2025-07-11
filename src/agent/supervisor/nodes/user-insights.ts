import fs from "fs";
import { exec } from "child_process";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { SupervisorState } from "../types";
import type { MessageContent } from "@langchain/core/messages";

/**
 * Safely extract string from LangChain message content
 */
function extractTextContent(content: MessageContent | undefined): string {
  if (!content) return "";

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if ("text" in c && typeof c.text === "string") return c.text;
        if ("type" in c && c.type === "image_url") return "[Image]";
        return "";
      })
      .join(" ");
  }

  return "";
}

/**
 * Node to extract structured knowledge from user messages and update the KG
 */
export async function userInsights(state: SupervisorState): Promise<SupervisorState> {
  const lastMessageObj = state.messages?.at(-1);
  const lastMessage = extractTextContent(lastMessageObj?.content);

  if (!lastMessage) return state;

  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
  });

  const prompt = new HumanMessage({
    content: `Extract structured knowledge from this user message in a dynamic JSON format.

Only output a single JSON object.

Example input: "Book me a flight to Delhi on 5th August."
Output: {"intent": "book_flight", "destination": "Delhi", "date": "2024-08-05"}

User message:
"${lastMessage}"`,
  });

  const result = await llm.call([prompt]);

  let contentText: string;

if (typeof result.content === "string") {
  contentText = result.content;
} else if (Array.isArray(result.content)) {
  contentText = result.content.map((c: any) =>
    typeof c === "string" ? c : c?.text ?? "").join(" ");
} else {
  contentText = "";
}

let insight: Record<string, any>;
try {
  insight = JSON.parse(contentText);
} catch (e) {
  console.warn("LLM returned unparseable content:", contentText);
  return state;
}

  // Update the knowledge graph state
  const updatedGraph = [...(state.knowledgeGraph ?? []), insight];
  state.knowledgeGraph = updatedGraph;

  // Write to disk for visualization
  fs.writeFileSync("kg.json", JSON.stringify(updatedGraph, null, 2));

  // Trigger optional external visualizer
  exec("python3 visualize_kg.py", (err, stdout, stderr) => {
    if (err) console.error("Visualizer error:", err.message);
    if (stderr) console.error(stderr);
    if (stdout) console.log(stdout);
  });

  return state;
}
