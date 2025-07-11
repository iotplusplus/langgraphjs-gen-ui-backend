import { SupervisorState, SupervisorUpdate } from "../types";
import { Memory } from "mem0ai/oss"; // Make sure this package is installed correctly

const mem = new Memory();

export async function mem0Node(
  state: SupervisorState
): Promise<SupervisorUpdate> {
  const last = state.messages.at(-1);
  const text =
    typeof last?.content === "string"
      ? last.content
      : Array.isArray(last?.content)
      ? last.content.map(c => (typeof c === "string" ? c : "")).join(" ")
      : "";

  const userId = String(state.context?.userId ?? "anonymous");

  if (text.trim()) {
    await mem.add(text, { userId });
  }
  const USER_ID = "user123";
  const memory = await mem.search("", {userId: USER_ID}); // Second param required
  console.log("📚 Retrieved memory graph data:", JSON.stringify(memory, null, 2));

  return {
    messages: [
      {
        role: "system",
        content: `🧠 Stored to Mem0 memory for ${userId}: "${text}"`,
      },
    ],
    context: {
      mem0Memory: memory,
    },
  };
}
