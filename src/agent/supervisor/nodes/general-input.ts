import { SupervisorState, SupervisorUpdate } from "../types";
import { ALL_TOOL_DESCRIPTIONS } from "../index";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import axios from 'axios';

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
};

interface Mem0ApiClient {
    search: (query: string, user_id?: string, session_id?: string) => Promise<any>;
    add: (data: string | { role: string; content: string }[], user_id?: string, session_id?: string) => Promise<any>;
    addWithFacts: (messages: { role: string; content: string }[], fact_extraction_prompt: string, user_id?: string, session_id?: string) => Promise<any>;
    get: (id: string, user_id?: string, session_id?: string) => Promise<any>;
    delete: (id: string, user_id?: string, session_id?: string) => Promise<any>;
}

const MEM0_API_BASE_URL = "http://localhost:8888"; 

const mem0ApiClient: Mem0ApiClient = {
    search: async (query: string, user_id?: string, session_id?: string) => {
        try {
            const response = await axios.post(`${MEM0_API_BASE_URL}/api/v1/memory/search`, {
                query: query,
                user_id: user_id,
                session_id: session_id,
            });
            return response.data;
        } catch (error) {
            console.error("Error searching Mem0:", error);
            return [];
        }
    },
    add: async (data: string | { role: string; content: string }[], user_id?: string, session_id?: string) => {
        try {
            const payload = Array.isArray(data) ? { messages: data } : { data: data };
            const response = await axios.post(`${MEM0_API_BASE_URL}/api/v1/memory/add`, {
                ...payload,
                user_id: user_id,
                session_id: session_id,
            });
            return response.data;
        } catch (error) {
            console.error("Error adding to Mem0:", error);
            return null;
        }
    },
    addWithFacts: async (messages: { role: string; content: string }[], fact_extraction_prompt: string, user_id?: string, session_id?: string) => {
        try {
            const response = await axios.post(`${MEM0_API_BASE_URL}/api/v1/memory/add_with_facts`, {
                messages: messages,
                fact_extraction_prompt: fact_extraction_prompt,
                user_id: user_id,
                session_id: session_id,
            });
            return response.data;
        } catch (error) {
            console.error("Error adding facts to Mem0:", error);
            return null;
        }
    },
    get: async (id: string, user_id?: string, session_id?: string) => {
        try {
            const response = await axios.get(`${MEM0_API_BASE_URL}/api/v1/memory/${id}`, {
                params: { user_id, session_id }
            });
            return response.data;
        } catch (error) {
            console.error(`Error getting memory with ID ${id}:`, error);
            return null;
        }
    },
    delete: async (id: string, user_id?: string, session_id?: string) => {
        try {
            const response = await axios.delete(`${MEM0_API_BASE_URL}/api/v1/memory/${id}`, {
                params: { user_id, session_id }
            });
            return response.data;
        } catch (error) {
            console.error(`Error deleting memory with ID ${id}:`, error);
            return null;
        }
    },
};
console.log("Mem0 AI client initialized within general-input.ts, connected to local REST API.");

const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

export async function generalInput(
    state: SupervisorState,
): Promise<SupervisorUpdate> {
    const userId = USER_PROFILE.id; 
    const sessionId = `session-${userId}`; 

    const lastMessage = state.messages[state.messages.length - 1];
    let currentInput = "";
    if (lastMessage instanceof HumanMessage || lastMessage instanceof AIMessage) {
        currentInput = lastMessage.content;
    } else {
        console.warn("Last message is not a HumanMessage or AIMessage:", lastMessage);
    }

    let relevantMemories: any[] = [];
    try {
        if (currentInput) { 
            relevantMemories = await mem0ApiClient.search(currentInput, userId, sessionId);
            console.log("Relevant memories from Mem0 (raw search results):", relevantMemories);
        }
    } catch (error) {
        console.error("Failed to retrieve memories from Mem0:", error);
    }

    let GENERAL_INPUT_SYSTEM_PROMPT = `You are a friendly and cheerful assistant, here to help out to your friend .Here is the background of your friend from ${JSON.stringify(USER_PROFILE, null, 2)} give some personal touch in language to show friendliness.
If the user asks what you can do, describe these tools.
${ALL_TOOL_DESCRIPTIONS}

`;

    let conversationalMemories: string[] = [];
    let extractedProfileFacts: string[] = [];

    relevantMemories.forEach((mem: any) => {
        try {
            const parsedContent = JSON.parse(mem.text);
            if (typeof parsedContent === 'object' && parsedContent !== null && !Array.isArray(parsedContent)) {
                extractedProfileFacts.push(JSON.stringify(parsedContent, null, 2));
            } else {
                conversationalMemories.push(mem.text);
            }
        } catch (e) {
            conversationalMemories.push(mem.text);
        }
    });

    if (conversationalMemories.length > 0) {
        GENERAL_INPUT_SYSTEM_PROMPT += `\n\nHere's some relevant past conversation/information from memory:\n${conversationalMemories.join('\n')}`;
    }

    if (extractedProfileFacts.length > 0) {
        GENERAL_INPUT_SYSTEM_PROMPT += `\n\nHere are some **structured profile facts** about the user from memory (use these for precise, personalized responses):\n${extractedProfileFacts.join('\n')}`;
    }

    GENERAL_INPUT_SYSTEM_PROMPT += `
If the last message is a tool result, describe what the action was, congratulate the user, or send a friendly followup in response to the tool action. Ensure this is a clear and concise message.

Otherwise, just answer as normal.`;

    const response = await llm.invoke([
        {
            role: "system",
            content: GENERAL_INPUT_SYSTEM_PROMPT,
        },
        ...state.messages,
    ]);

    const messagesToStore = [];
    if (lastMessage instanceof HumanMessage) {
        messagesToStore.push({ role: 'user', content: lastMessage.content as string });
    }
    messagesToStore.push({ role: 'assistant', content: response.content as string });

    try {
        const addResult = await mem0ApiClient.add(messagesToStore, userId, sessionId);
        console.log("Conversation turn added to Mem0. Memory ID:", addResult?.id);

        const FACT_EXTRACTION_PROMPT = `Based on the user's message, extract any key facts about their personal history, education, expertise, or projects mentioned. Format as a JSON object with relevant keys (e.g., {"education": "...", "expertise": ["...", "..."], "project_title": "..."}). If no such facts are extractable, return an empty JSON object {}.`;

        if (lastMessage instanceof HumanMessage) {
            console.log("Attempting to extract specific profile facts from the last user message...");
            const factsResult = await mem0ApiClient.addWithFacts(
                [{ role: 'user', content: lastMessage.content as string }], 
                FACT_EXTRACTION_PROMPT,
                userId,
                sessionId
            );
            console.log("Extracted facts from Mem0:", factsResult);
        }

    } catch (error) {
        console.error("Failed to interact with Mem0 for adding or fact extraction:", error);
    }

    return {
        messages: [response],
    };
}
