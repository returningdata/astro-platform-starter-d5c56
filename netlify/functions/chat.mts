import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface SessionData {
  userId: string;
  username: string;
  displayName: string;
  permissions: string[];
  isAdmin: boolean;
  isOwner: boolean;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  text: string;
  sender: "user" | "bot" | "admin";
  adminId?: string;
  adminName?: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  messages: ChatMessage[];
  isAdminTakeover: boolean;
  adminId?: string;
  adminName?: string;
  userIp: string;
  createdAt: string;
  lastActivity: string;
}

interface BotConfig {
  responses: Record<string, string>;
  fallbackResponse: string;
  enableAI: boolean;
  aiApiKey?: string;
}

function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "session") return value;
  }
  return null;
}

async function getSession(sessionId: string): Promise<SessionData | null> {
  const store = getStore("sessions");
  return await store.get(sessionId, { type: "json" });
}

function getClientIp(req: Request, context: Context): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    context.ip ||
    "unknown"
  );
}

async function getBotConfig(): Promise<BotConfig> {
  const store = getStore("admin-config");
  const config = await store.get("bot-config", { type: "json" });

  return (
    config || {
      responses: {
        hello: "Hello! Welcome to KruigerLabs. How can I assist you today?",
        hi: "Hi there! I'm here to help you learn about our Discord bots and services.",
        help: "I can help you with information about our bots, services, and how to get started. Just ask away!",
        bots: "We offer several powerful Discord bots including Elite Pulse, Elite Welcomer, Kruigers Assistant, Kruiger Tickets, Elite MultiPurpose, Elite Relay, Elite Logger, and Elite Sector. Would you like to know more about any specific bot?",
        services:
          "KruigerLabs provides moderation, automation, ticketing, role sync, AI assistance, analytics, webhooks, music bots, forms, logging, Twitch integration, security, APIs, and dev tools. What would you like to explore?",
        discord:
          "Join our Discord community to get support, updates, and connect with other users! Click the 'Join Our Discord' button in the navigation.",
        contact:
          "You can reach us through our Discord server. We're always happy to help with questions about our services!",
        pricing:
          "For pricing information and custom solutions, please join our Discord server and open a ticket. We offer flexible plans for communities of all sizes.",
        support: "For support, please join our Discord server and create a ticket. Our team will assist you as soon as possible!",
        features: "Our bots come with a wide range of features including moderation, logging, welcome messages, ticket systems, and much more. What specific feature are you interested in?"
      },
      fallbackResponse:
        "Thanks for your message! For detailed inquiries, please join our Discord server where our team can assist you better. Is there anything specific about our bots or services I can help with?",
      enableAI: false
    }
  );
}

function getKeywordResponse(message: string, config: BotConfig): string {
  const lowerMessage = message.toLowerCase();

  for (const [keyword, response] of Object.entries(config.responses)) {
    if (lowerMessage.includes(keyword)) {
      return response;
    }
  }

  return config.fallbackResponse;
}

async function getAIResponse(message: string, conversation: Conversation): Promise<string> {
  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return "AI is not configured. Please contact an administrator.";
  }

  try {
    // Build conversation context
    const messages = [
      {
        role: "system",
        content: `You are KRUIGER AI, a helpful assistant for KruigerLabs. KruigerLabs specializes in Discord bots and automation tools.

Available bots: Elite Pulse (server monitoring), Elite Welcomer (welcome messages), Kruigers Assistant (AI-powered moderation), Kruiger Tickets (support tickets), Elite MultiPurpose (all-in-one), Elite Relay (cross-server messaging), Elite Logger (audit logs), Elite Sector (security).

Services: Moderation, Automation, Ticketing, Role Sync, AI Assistance, Analytics, Webhooks, Music, Forms, Logging, Twitch Integration, Security, APIs, Dev Tools.

Be helpful, friendly, and concise. For complex issues, suggest joining the Discord server for direct support.`
      }
    ];

    // Add recent conversation history
    const recentMessages = conversation.messages.slice(-10);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return "I'm having trouble processing your request. Please try again or join our Discord for direct support.";
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("AI response error:", error);
    return "I'm having trouble processing your request. Please try again or join our Discord for direct support.";
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const conversationsStore = getStore("chat-conversations");

  // Get or create conversation ID
  const getConversationId = (req: Request): string => {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        const [name, value] = cookie.split("=");
        if (name === "chat_conversation") return value;
      }
    }
    return crypto.randomUUID();
  };

  // Send a message (user)
  if (req.method === "POST" && action === "send") {
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const conversationId = getConversationId(req);
    const clientIp = getClientIp(req, context);

    // Get or create conversation
    let conversation: Conversation | null = await conversationsStore.get(conversationId, {
      type: "json"
    });

    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [],
        isAdminTakeover: false,
        userIp: clientIp,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      text: message.trim(),
      sender: "user",
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(userMessage);
    conversation.lastActivity = new Date().toISOString();

    // If admin has taken over, don't auto-respond
    if (conversation.isAdminTakeover) {
      await conversationsStore.setJSON(conversationId, conversation);
      return new Response(
        JSON.stringify({
          success: true,
          userMessage,
          adminTakeover: true,
          adminName: conversation.adminName
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": `chat_conversation=${conversationId}; Path=/; Max-Age=${30 * 24 * 60 * 60}`
          }
        }
      );
    }

    // Get bot config and generate response
    const botConfig = await getBotConfig();
    let botResponseText: string;

    if (botConfig.enableAI) {
      botResponseText = await getAIResponse(message, conversation);
    } else {
      botResponseText = getKeywordResponse(message, botConfig);
    }

    const botMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      text: botResponseText,
      sender: "bot",
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(botMessage);

    await conversationsStore.setJSON(conversationId, conversation);

    return new Response(JSON.stringify({ success: true, userMessage, botMessage }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `chat_conversation=${conversationId}; Path=/; Max-Age=${30 * 24 * 60 * 60}`
      }
    });
  }

  // Get conversation history
  if (req.method === "GET" && action === "history") {
    const conversationId = getConversationId(req);
    const conversation: Conversation | null = await conversationsStore.get(conversationId, {
      type: "json"
    });

    return new Response(
      JSON.stringify({
        conversationId,
        messages: conversation?.messages || [],
        isAdminTakeover: conversation?.isAdminTakeover || false,
        adminName: conversation?.adminName
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // Admin: List active conversations
  if (req.method === "GET" && action === "list") {
    const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = await getSession(sessionId);
    if (!session || !session.isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // List all conversations
    const { blobs } = await conversationsStore.list();
    const conversations: Conversation[] = [];

    for (const blob of blobs) {
      const conv: Conversation | null = await conversationsStore.get(blob.key, { type: "json" });
      if (conv) {
        // Only include conversations from last 24 hours with messages
        const lastActivity = new Date(conv.lastActivity);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (lastActivity > oneDayAgo && conv.messages.length > 0) {
          conversations.push(conv);
        }
      }
    }

    // Sort by last activity
    conversations.sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    return new Response(JSON.stringify({ conversations }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Admin: Take over conversation
  if (req.method === "POST" && action === "takeover") {
    const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = await getSession(sessionId);
    if (!session || !session.isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { conversationId, release } = body;

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "Conversation ID required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const conversation: Conversation | null = await conversationsStore.get(conversationId, {
      type: "json"
    });

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (release) {
      conversation.isAdminTakeover = false;
      conversation.adminId = undefined;
      conversation.adminName = undefined;

      // Add system message
      conversation.messages.push({
        id: crypto.randomUUID(),
        conversationId,
        text: "An admin has left the conversation. KRUIGER AI is now responding.",
        sender: "bot",
        timestamp: new Date().toISOString()
      });
    } else {
      conversation.isAdminTakeover = true;
      conversation.adminId = session.userId;
      conversation.adminName = session.displayName;

      // Add system message
      conversation.messages.push({
        id: crypto.randomUUID(),
        conversationId,
        text: `${session.displayName} from KruigerLabs has joined the conversation.`,
        sender: "bot",
        timestamp: new Date().toISOString()
      });
    }

    conversation.lastActivity = new Date().toISOString();
    await conversationsStore.setJSON(conversationId, conversation);

    return new Response(JSON.stringify({ success: true, conversation }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Admin: Send message as admin
  if (req.method === "POST" && action === "admin-send") {
    const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = await getSession(sessionId);
    if (!session || !session.isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: "Conversation ID and message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const conversation: Conversation | null = await conversationsStore.get(conversationId, {
      type: "json"
    });

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const adminMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      text: message,
      sender: "admin",
      adminId: session.userId,
      adminName: session.displayName,
      timestamp: new Date().toISOString()
    };

    conversation.messages.push(adminMessage);
    conversation.lastActivity = new Date().toISOString();
    conversation.isAdminTakeover = true;
    conversation.adminId = session.userId;
    conversation.adminName = session.displayName;

    await conversationsStore.setJSON(conversationId, conversation);

    return new Response(JSON.stringify({ success: true, message: adminMessage }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Admin: Update bot config
  if (req.method === "POST" && action === "config") {
    const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = await getSession(sessionId);
    if (!session || !session.isOwner) {
      return new Response(JSON.stringify({ error: "Only owners can update bot config" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { responses, fallbackResponse, enableAI } = body;

    const configStore = getStore("admin-config");
    const currentConfig = await getBotConfig();

    const newConfig: BotConfig = {
      ...currentConfig,
      responses: responses || currentConfig.responses,
      fallbackResponse: fallbackResponse || currentConfig.fallbackResponse,
      enableAI: enableAI !== undefined ? enableAI : currentConfig.enableAI
    };

    await configStore.setJSON("bot-config", newConfig);

    return new Response(JSON.stringify({ success: true, config: newConfig }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Get bot config (admin only)
  if (req.method === "GET" && action === "config") {
    const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = await getSession(sessionId);
    if (!session || !session.isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const config = await getBotConfig();
    return new Response(JSON.stringify({ config }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
};

export const config: Config = {
  path: "/api/chat"
};
