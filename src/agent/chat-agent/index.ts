import {
  Annotation,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { manageContextLength } from "../../utils/context-manager";

const ChatAgentAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec["messages"],
});

const graph = new StateGraph(ChatAgentAnnotation)
  .addNode("chat", async (state) => {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    // Manage context length to prevent token limit errors
    const managedMessages = manageContextLength([
      { role: "system", content: "You are a helpful assistant." } as any,
      ...state.messages,
    ]);

    const response = await model.invoke(managedMessages);

    return {
      messages: response,
    };
  })
  .addEdge(START, "chat");

export const agent = graph.compile();
agent.name = "Chat Agent";
