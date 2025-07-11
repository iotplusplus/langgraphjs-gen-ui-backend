import {
  Annotation,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

const ChatAgentAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec["messages"],
});

const graph = new StateGraph(ChatAgentAnnotation)
  .addNode("chat", async (state) => {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const response = await model.invoke([
      { role: "system", content: "You are a helpful assistant." },
      ...state.messages,
    ]);

    return {
      messages: response,
    };
  })
  .addEdge(START, "chat");

export const agent = graph.compile();
agent.name = "Chat Agent";

/*
import {
  Annotation,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { Memory } from 'mem0ai/oss';
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages'; 

const mem0Instance = new Memory();
console.log("Mem0 AI instance initialized for Chat Agent.");

const ChatAgentAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec["messages"],
});

const graph = new StateGraph(ChatAgentAnnotation)
  .addNode("chat", async (state: { messages: BaseMessage[] }) => { 
    console.log("\nEntering Chat Agent Node");

    const model = new ChatOpenAI({
      model: "gpt-4o-mini", 
      temperature: 0.7, 
    });

    const latestHumanMessage = state.messages.findLast((msg) => msg._type === "human");
    let retrievedMemories = '';

    if (latestHumanMessage) {
      console.log(`Searching Mem0 for context related to: "${latestHumanMessage.content}"`);
      try {
        const searchResult: any = await mem0Instance.search(latestHumanMessage.content as string);
        const memories: any[] = searchResult.results || []; 

        if (memories.length > 0) { 
          retrievedMemories = `\n\n**Relevant past memories:**\n${memories.map((m: any) => m.memory).join('\n')}`;
          console.log("Memories retrieved successfully.");
        } else {
          console.log("No relevant memories found for this query.");
        }
      } catch (error) {
        console.error("Error searching Mem0:", error);
        retrievedMemories = "\n\n(Memory retrieval failed)";
      }
    }

    const systemPrompt = `You are a helpful and friendly assistant.
    ${retrievedMemories}
    Please respond concisely and helpfully.`;

    const messagesForLLM: BaseMessage[] = [ 
      new SystemMessage(systemPrompt), 
      ...state.messages.filter(msg => msg._type !== "system"),
    ];

    console.log("Invoking LLM with messages (including retrieved memories if any)...");
    const response = await model.invoke(messagesForLLM);
    console.log("LLM invocation complete.");

    if (latestHumanMessage) {
      const fullExchange = `User: ${latestHumanMessage.content}\nAssistant: ${response.content}`;
      console.log(`Adding recent exchange to Mem0: "${fullExchange.substring(0, 100)}..."`); 
      try {
        await mem0Instance.add(fullExchange);
        console.log("Exchange added to Mem0 successfully.");
      } catch (error) {
        console.error("Error adding to Mem0:", error);
      }
    }

    console.log("Exiting Chat Agent Node");
    return {
      messages: new AIMessage(response.content as string), 
    };
  })
  .addEdge(START, "chat");

export const agent = graph.compile();
agent.name = "Chat Agent (with Mem0)"; 
*/
