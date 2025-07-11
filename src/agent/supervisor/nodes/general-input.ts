import { SupervisorState, SupervisorUpdate } from "../types";
import { ALL_TOOL_DESCRIPTIONS } from "../index";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import { Memory } from 'mem0ai/oss';

const USER_PROFILE = {
      "id": "user123",
      "name": "Alice",
      "profile": {
        "personalHistory": "Alice was born in Munich and moved to Berlin for her studies. She holds a Master’s degree in Computer Science from TU Berlin. From a young age, she was fascinated by how machines learn and evolve, which led her into the field of artificial intelligence. She started her career as a backend developer and gradually transitioned into AI-focused roles. Outside of work, Alice enjoys hiking in the Alps, painting, and participating in tech meetups.",
        "education": "M.Sc. in Computer Science, Technische Universität Berlin",
        "expertise": "Machine learning, deep learning, distributed systems, transformer models, and open-source AI contributions.",
        "projectA": {
          "title": "Multilingual Generative Language Model",
          "description": "Led the development of a multilingual transformer-based model capable of generating coherent text in over 15 languages. The project aimed to enhance NLP capabilities in underrepresented languages.",
          "technologies": ["PyTorch", "Transformers", "HuggingFace", "TensorBoard"]
        },
        "projectB": {
          "title": "Federated Learning System",
          "description": "Built a federated learning pipeline enabling training on decentralized datasets across devices to maintain data privacy while improving model generalizability.",
          "technologies": ["Python", "gRPC", "TensorFlow Federated", "Docker", "Kubernetes"]
        },
        "ongoingProjects": [
          "Experimenting with sparse attention mechanisms for large language models.",
          "Mentoring junior developers in the open-source AI community.",
          "Collaborating with a university lab on adversarial robustness in deep models."
        ]
      }
    }

export async function generalInput(
  state: SupervisorState,
  mem0Instance: Memory 
): Promise<SupervisorUpdate> {
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

  const GENERAL_INPUT_SYSTEM_PROMPT = `You are a friendly and cheerful assistant, here to help out your friend.
  Here is the background of your friend from ${JSON.stringify(USER_PROFILE, null, 2)}.
  ${retrievedMemories}
  Give some personal touch in language to show friendliness.

  If the user asks what you can do, describe these tools:
  ${ALL_TOOL_DESCRIPTIONS}

  If the last message is a tool result, describe what the action was, congratulate the user, or send a friendly followup in response to the tool action. Ensure this is a clear and concise message.

  Otherwise, just answer as normal.`;

  const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

  const messagesForLLM: BaseMessage[] = [
    new SystemMessage(GENERAL_INPUT_SYSTEM_PROMPT),
    ...state.messages.filter(msg => msg._type !== "system"),
  ];

  const response = await llm.invoke(messagesForLLM);

  if (latestHumanMessage) {
    const fullExchange = `User: ${latestHumanMessage.content}\nAssistant: ${response.content}`;
    console.log(`Adding recent exchange to Mem0 from generalInput: "${fullExchange.substring(0, Math.min(fullExchange.length, 100))}..."`);
    try {
      await mem0Instance.add(fullExchange);
      console.log("Exchange added to Mem0 successfully by generalInput.");
    } catch (error) {
      console.error("Error adding to Mem0 from generalInput:", error);
    }
  }

  return {
    messages: [response],
  };
}
