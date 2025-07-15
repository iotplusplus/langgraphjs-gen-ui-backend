import { BaseMessage } from "@langchain/core/messages";

// Approximate token count for different content types
const TOKENS_PER_CHAR = 0.25; // Rough estimate for text
const MAX_CONTEXT_TOKENS = 80000; // Very conservative limit (80k)
const MAX_IMAGE_TOKENS = 5000; // Further reduced
const SAFETY_BUFFER = 20000; // Larger safety buffer

/**
 * Estimates token count for a message
 */
function estimateMessageTokens(message: BaseMessage): number {
  if (typeof message.content === 'string') {
    return message.content.length * TOKENS_PER_CHAR;
  }
  
  if (Array.isArray(message.content)) {
    let totalTokens = 0;
    
    for (const block of message.content as any[]) {
      if (typeof block === 'string') {
        totalTokens += block.length * TOKENS_PER_CHAR;
      } else if (typeof block === 'object' && block !== null) {
        if ('type' in block) {
          if (block.type === 'text' && 'text' in block && typeof block.text === 'string') {
            totalTokens += block.text.length * TOKENS_PER_CHAR;
          } else if (block.type === 'image_url') {
            // Images can be very large - estimate conservatively
            totalTokens += MAX_IMAGE_TOKENS;
          } else if (block.type === 'image' && 'source' in block) {
            totalTokens += MAX_IMAGE_TOKENS;
          }
        }
      }
    }
    
    return totalTokens;
  }
  
  return 0;
}

/**
 * Estimates total tokens for an array of messages
 */
function estimateTotalTokens(messages: BaseMessage[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

/**
 * Compresses an image URL by adding size restrictions
 * This is a placeholder - in a real implementation you'd resize the image
 */
function compressImageUrl(url: string): string {
  // If the URL is a file_id reference, return as-is (do not attempt to compress)
  if (url.startsWith("file_id:")) {
    return url;
  }
  // For now, we'll keep the original URL but this could be enhanced
  // to actually resize/compress images
  return url;
}

/**
 * Compresses large images in message content
 */
function compressMessageImages(message: BaseMessage): BaseMessage {
  if (!Array.isArray(message.content)) {
    return message;
  }

  const compressedContent = message.content.map((block: any) => {
    if (typeof block === 'object' && block !== null && 'type' in block) {
      if (block.type === 'image_url' && 'image_url' in block && 
          typeof block.image_url === 'object' && block.image_url !== null &&
          'url' in block.image_url && typeof block.image_url.url === 'string') {
        return {
          ...block,
          image_url: {
            ...block.image_url,
            url: compressImageUrl(block.image_url.url),
            detail: 'low' // Use low detail to reduce token usage
          }
        };
      }
    }
    return block;
  });

  // Create a new message with the same type and properties
  const newMessage = message.constructor as any;
  return new newMessage({
    content: compressedContent,
    additional_kwargs: message.additional_kwargs,
    response_metadata: message.response_metadata,
  });
}

/**
 * Manages context length by removing old messages and compressing images
 */
export function manageContextLength(messages: BaseMessage[]): BaseMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  console.log(`[Context Manager] Starting with ${messages.length} messages`);

  // First, compress images in all messages
  let processedMessages = messages.map(compressMessageImages);
  
  // Calculate current token usage
  let currentTokens = estimateTotalTokens(processedMessages);
  console.log(`[Context Manager] Estimated tokens: ${currentTokens}, limit: ${MAX_CONTEXT_TOKENS}`);
  
  // If we're over the limit, remove older messages (keep system messages)
  if (currentTokens > MAX_CONTEXT_TOKENS) {
    console.log(`[Context Manager] Over limit, trimming messages...`);
    
    // Always keep the system message (usually first) and the last few messages
    const systemMessages = processedMessages.filter(msg => msg._getType() === 'system');
    const nonSystemMessages = processedMessages.filter(msg => msg._getType() !== 'system');
    
    console.log(`[Context Manager] Found ${systemMessages.length} system messages, ${nonSystemMessages.length} other messages`);
    
    // Start with just system messages
    let keptMessages = [...systemMessages];
    let tempTokens = estimateTotalTokens(systemMessages);
    
    // Keep only the most recent messages that fit within limit
    const maxAllowedTokens = MAX_CONTEXT_TOKENS - SAFETY_BUFFER;
    
    // Add messages from the end until we hit the limit
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const messageTokens = estimateMessageTokens(nonSystemMessages[i]);
      console.log(`[Context Manager] Message ${i} tokens: ${messageTokens}, current total: ${tempTokens}`);
      
      if (tempTokens + messageTokens > maxAllowedTokens) {
        console.log(`[Context Manager] Would exceed limit, stopping at message ${i}`);
        break;
      }
      keptMessages.push(nonSystemMessages[i]);
      tempTokens += messageTokens;
    }
    
    // Restore chronological order for non-system messages
    const finalNonSystemMessages = keptMessages
      .filter(msg => msg._getType() !== 'system')
      .reverse();
    
    processedMessages = [...systemMessages, ...finalNonSystemMessages];
    
    const finalTokens = estimateTotalTokens(processedMessages);
    console.log(`[Context Manager] Final: ${processedMessages.length} messages, ${finalTokens} estimated tokens`);
    
    // Emergency fallback: if still too many tokens, keep only last few messages
    if (finalTokens > MAX_CONTEXT_TOKENS) {
      console.log(`[Context Manager] Emergency fallback: keeping only last 5 messages`);
      const systemMessages = processedMessages.filter(msg => msg._getType() === 'system');
      const nonSystemMessages = processedMessages.filter(msg => msg._getType() !== 'system');
      const lastFewMessages = nonSystemMessages.slice(-5); // Keep only last 5 non-system messages
      processedMessages = [...systemMessages, ...lastFewMessages];
      
      const emergencyTokens = estimateTotalTokens(processedMessages);
      console.log(`[Context Manager] Emergency result: ${processedMessages.length} messages, ${emergencyTokens} estimated tokens`);
    }
  }
  
  return processedMessages;
}
