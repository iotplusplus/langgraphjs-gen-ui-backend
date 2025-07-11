import { StateGraph, START, END } from "@langchain/langgraph";
import { stockbrokerGraph } from "../stockbroker";
import { tripPlannerGraph } from "../trip-planner";
import { graph as openCodeGraph } from "../open-code";
import { graph as orderPizzaGraph } from "../pizza-orderer";
import {
  SupervisorAnnotation,
  SupervisorState,
  SupervisorZodConfiguration,
} from "./types";
import { generalInput } from "./nodes/general-input";
import { router } from "./nodes/router";
import { graph as writerAgentGraph } from "../writer-agent";
import { mem0Node } from "./nodes/mem0-node";

export const ALL_TOOL_DESCRIPTIONS = `- stockbroker: can fetch the price of a ticker, purchase/sell a ticker, or get the user's portfolio
- tripPlanner: helps the user plan their trip. it can suggest restaurants, and places to stay in any given location.
- openCode: can write a React TODO app for the user. Only call this tool if they request a TODO app.
- orderPizza: can order a pizza for the user
- writerAgent: can write a text document for the user. Only call this tool if they request a text document.`;

function handleRoute(
  state: SupervisorState,
):
  | "stockbroker"
  | "tripPlanner"
  | "openCode"
  | "orderPizza"
  | "generalInput"
  | "writerAgent" {
  return state.next;
}

const builder = new StateGraph(SupervisorAnnotation, SupervisorZodConfiguration)
  const builder = new StateGraph(SupervisorAnnotation, SupervisorZodConfiguration)
  .addNode("mem0", mem0Node)                 // ✅ Mem0 node to log memory
  .addNode("router", router) 
  .addNode("stockbroker", stockbrokerGraph)
  .addNode("tripPlanner", tripPlannerGraph)
  .addNode("openCode", openCodeGraph)
  .addNode("orderPizza", orderPizzaGraph)
  .addNode("generalInput", generalInput)
  .addNode("writerAgent", writerAgentGraph)
  .addEdge(START, "mem0")                    // ✅ Start -> Mem0
  .addEdge("mem0", "router")  
  .addConditionalEdges("router", handleRoute, [
    "stockbroker",
    "tripPlanner",
    "openCode",
    "orderPizza",
    "generalInput",
    "writerAgent",
  ])
  .addEdge("stockbroker", END)
  .addEdge("tripPlanner", END)
  .addEdge("openCode", END)
  .addEdge("orderPizza", END)
  .addEdge("generalInput", END)
  .addEdge("writerAgent", END);

export const graph = builder.compile();
graph.name = "Generative UI Agent";

