import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'admin';
  adminName?: string;
  timestamp: Date;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAdminTakeover, setIsAdminTakeover] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Load chat history when widget opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  // Poll for new messages when admin has taken over
  useEffect(() => {
    if (isOpen && isAdminTakeover) {
      pollIntervalRef.current = window.setInterval(() => {
        loadHistory();
      }, 3000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, isAdminTakeover]);

  async function loadHistory() {
    try {
      const res = await fetch('/api/chat?action=history');
      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } else {
        // Set initial welcome message if no history
        setMessages([{
          id: 'welcome',
          text: "Welcome to KruigerLabs! I'm KRUIGER AI, your assistant. How can I help you today?",
          sender: 'bot',
          timestamp: new Date()
        }]);
      }

      setIsAdminTakeover(data.isAdminTakeover || false);
      setAdminName(data.adminName || null);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Set initial message on error
      setMessages([{
        id: 'welcome',
        text: "Welcome to KruigerLabs! I'm KRUIGER AI, your assistant. How can I help you today?",
        sender: 'bot',
        timestamp: new Date()
      }]);
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputValue })
      });

      const data = await res.json();

      if (data.adminTakeover) {
        setIsAdminTakeover(true);
        setAdminName(data.adminName);
        setIsTyping(false);
        // Don't add bot message, admin will respond
      } else if (data.botMessage) {
        const botMessage: Message = {
          id: data.botMessage.id,
          text: data.botMessage.text,
          sender: data.botMessage.sender,
          adminName: data.botMessage.adminName,
          timestamp: new Date(data.botMessage.timestamp)
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsTyping(false);
      // Fallback response
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        text: "I'm having trouble connecting. Please try again or join our Discord for support.",
        sender: 'bot',
        timestamp: new Date()
      }]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      <style>{`
        .chatbot-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          font-family: Inter, system-ui, -apple-system, sans-serif;
        }

        .chatbot-toggle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(18, 18, 25, 0.9));
          border: 2px solid rgba(168, 85, 247, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 25px rgba(168, 85, 247, 0.4), 0 4px 15px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .chatbot-toggle:hover {
          transform: scale(1.1);
          box-shadow: 0 0 35px rgba(168, 85, 247, 0.6), 0 6px 20px rgba(0, 0, 0, 0.4);
          border-color: rgba(168, 85, 247, 0.8);
        }

        .chatbot-toggle svg {
          width: 28px;
          height: 28px;
          color: #A855F7;
          filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.6));
          transition: transform 0.3s ease;
        }

        .chatbot-toggle.open svg {
          transform: rotate(90deg);
        }

        .chatbot-window {
          position: absolute;
          bottom: 75px;
          right: 0;
          width: 380px;
          max-width: calc(100vw - 48px);
          height: 500px;
          max-height: calc(100vh - 150px);
          background: rgba(7, 7, 10, 0.95);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 0 40px rgba(168, 85, 247, 0.2), 0 10px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          pointer-events: none;
          transition: all 0.3s ease;
        }

        .chatbot-window.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .chatbot-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(18, 18, 25, 0.86));
          border-bottom: 1px solid rgba(168, 85, 247, 0.2);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chatbot-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #A855F7, #0099cc);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.4);
        }

        .chatbot-avatar svg {
          width: 22px;
          height: 22px;
          color: #0d0d12;
        }

        .chatbot-info {
          flex: 1;
        }

        .chatbot-name {
          font-family: Orbitron, system-ui;
          font-size: 14px;
          font-weight: 600;
          color: #F1F1F3;
          letter-spacing: 0.04em;
        }

        .chatbot-status {
          font-size: 12px;
          color: #A855F7;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chatbot-status.admin-active {
          color: #64c864;
        }

        .chatbot-status::before {
          content: '';
          width: 8px;
          height: 8px;
          background: #A855F7;
          border-radius: 50%;
          box-shadow: 0 0 8px #A855F7;
          animation: pulse 2s infinite;
        }

        .chatbot-status.admin-active::before {
          background: #64c864;
          box-shadow: 0 0 8px #64c864;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .chatbot-close {
          background: none;
          border: none;
          color: #A1A1AA;
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }

        .chatbot-close:hover {
          color: #A855F7;
        }

        .chatbot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chatbot-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chatbot-messages::-webkit-scrollbar-track {
          background: rgba(168, 85, 247, 0.05);
        }

        .chatbot-messages::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.3);
          border-radius: 3px;
        }

        .chatbot-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.5);
        }

        .chatbot-message {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chatbot-message.user {
          align-self: flex-end;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1));
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #F1F1F3;
        }

        .chatbot-message.bot {
          align-self: flex-start;
          background: rgba(24, 24, 33, 0.86);
          border: 1px solid rgba(168, 85, 247, 0.15);
          color: #A1A1AA;
        }

        .chatbot-message.admin {
          align-self: flex-start;
          background: rgba(100, 200, 100, 0.15);
          border: 1px solid rgba(100, 200, 100, 0.3);
          color: #F1F1F3;
        }

        .chatbot-message .admin-badge {
          font-size: 10px;
          color: #64c864;
          display: block;
          margin-bottom: 4px;
          font-weight: 600;
        }

        .chatbot-typing {
          align-self: flex-start;
          padding: 12px 16px;
          background: rgba(24, 24, 33, 0.86);
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: 12px;
          display: flex;
          gap: 4px;
          animation: fadeIn 0.3s ease;
        }

        .chatbot-typing span {
          width: 8px;
          height: 8px;
          background: #A855F7;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .chatbot-typing span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .chatbot-typing span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .chatbot-input-container {
          padding: 16px;
          background: rgba(18, 18, 25, 0.86);
          border-top: 1px solid rgba(168, 85, 247, 0.15);
          display: flex;
          gap: 10px;
        }

        .chatbot-input {
          flex: 1;
          padding: 12px 16px;
          background: rgba(24, 24, 33, 0.92);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 10px;
          color: #F1F1F3;
          font-size: 14px;
          font-family: Inter, system-ui, sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .chatbot-input::placeholder {
          color: #A1A1AA;
          opacity: 0.6;
        }

        .chatbot-input:focus {
          border-color: rgba(168, 85, 247, 0.5);
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.15);
        }

        .chatbot-send {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.1));
          border: 1px solid rgba(168, 85, 247, 0.4);
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .chatbot-send:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(168, 85, 247, 0.2));
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.3);
        }

        .chatbot-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chatbot-send svg {
          width: 20px;
          height: 20px;
          color: #A855F7;
        }

        @media (max-width: 480px) {
          .chatbot-container {
            bottom: 16px;
            right: 16px;
          }

          .chatbot-toggle {
            width: 54px;
            height: 54px;
          }

          .chatbot-window {
            bottom: 70px;
            width: calc(100vw - 32px);
            height: calc(100vh - 120px);
            right: -8px;
          }
        }
      `}</style>

      <div className="chatbot-container">
        <div className={`chatbot-window ${isOpen ? 'open' : ''}`}>
          <div className="chatbot-header">
            <div className="chatbot-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                <circle cx="8" cy="14" r="1"/>
                <circle cx="16" cy="14" r="1"/>
              </svg>
            </div>
            <div className="chatbot-info">
              <div className="chatbot-name">KRUIGER AI</div>
              <div className={`chatbot-status ${isAdminTakeover ? 'admin-active' : ''}`}>
                {isAdminTakeover ? `${adminName || 'Admin'} is here` : 'Online'}
              </div>
            </div>
            <button className="chatbot-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chatbot-message ${msg.sender}`}>
                {msg.sender === 'admin' && msg.adminName && (
                  <span className="admin-badge">{msg.adminName} (Support)</span>
                )}
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="chatbot-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-container">
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button
              className="chatbot-send"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>

        <button
          className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          {isOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
