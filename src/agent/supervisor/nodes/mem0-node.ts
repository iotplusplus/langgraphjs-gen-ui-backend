import { SupervisorState, SupervisorUpdate } from "../types";
import { Memory } from "mem0ai/oss";
import dotenv from "dotenv";
dotenv.config();

const config = {
  enableGraph: true,
  graphStore: {
    provider: "neo4j",
    config: {
      url: process.env.NEO4J_URL!,
      username: process.env.NEO4J_USERNAME!,
      password: process.env.NEO4J_PASSWORD!,
    },
  },
};


const mem = new Memory(config);
export async function mem0Node(
  state: SupervisorState
): Promise<SupervisorUpdate> {
  const lastMessage = state.messages.at(-1);

  // Normalize text content from last user message
const text = Array.isArray(lastMessage?.content)
  ? lastMessage.content.map((c) => {
      if (typeof c === "string") return c;
      if (typeof c === "object" && "text" in c) return c.text;
      return "";
    }).join(" ")
  : typeof lastMessage?.content === "string"
  ? lastMessage.content
  : "";


  const userId = String(state.context?.userId ?? "anonymous");

  try {
    if (text.trim()) {
      //console.log(`📝 Adding message to Mem0 memory:\nUser: ${userId}\nText: "${text}"`);

      // Use extractor inline to avoid config errors
      await mem.add(text, {userId});
    }

    // Search the memory graph
    const memory = await mem.search("", { userId });
    //console.log("🔍 Raw user message received:", JSON.stringify(lastMessage, null, 2));
    //console.log("📝 Parsed text:", text);

    //console.log("📚 Retrieved in-memory graph data:", JSON.stringify(memory, null, 2));

    if (!memory?.results?.length) {
      console.warn("⚠️ No facts extracted from the user's message.");
    }

    return {
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `🧠 Temporarily stored in Mem0 for ${userId}: "${text}"`,
        },
      ],
      context: {
        ...state.context,
        mem0Memory: memory,
      },
    };
  } catch (error) {
    console.error("❌ Mem0 error:", error);
    return {
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `⚠️ Could not store message in Mem0 for ${userId}.`,
        },
      ],
      context: {
        ...state.context,
      },
    };
  }
}
