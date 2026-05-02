"use client";

import { useState, useRef, useEffect } from "react";
import { agentApi, api, AgentMessage, Owner } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function RAGChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Owner selection
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !selectedOwner && owners.length === 0) {
      setOwnerLoading(true);
      api.getOwners()
        .then(setOwners)
        .catch(() => setOwners([]))
        .finally(() => setOwnerLoading(false));
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    if (!selectedOwner) return;
    const question = (text ?? input).trim();
    if (!question || isLoading) return;

    setInput("");
    setIsLoading(true);

    // Build history from previous messages (excluding the one we're about to add)
    const history: AgentMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    // Add empty assistant message that we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      for await (const chunk of agentApi.chatStream(question, selectedOwner.id, history)) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        });
      }
      // Mark streaming done
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, streaming: false }];
      });
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const isEmpty = last.content === "";
        return [
          ...prev.slice(0, isEmpty ? -1 : prev.length),
          ...(isEmpty
            ? [{ role: "assistant" as const, content: "Sorry, could not reach the assistant. Please try again." }]
            : [{ ...last, streaming: false }]),
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    "What benefits are expiring soon?",
    "Does Venture X have lounge access?",
    "What's my Bilt Cash balance?",
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
          isOpen
            ? "bg-gray-600 hover:bg-gray-700"
            : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
        }`}
        title="Card Assistant"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-40 right-6 z-50 w-96 h-[520px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold">Card Assistant</h3>
              <p className="text-white/70 text-xs truncate">
                {selectedOwner ? `Logged in as ${selectedOwner.name}` : "Ask about cards & your benefits"}
              </p>
            </div>
            {selectedOwner && (
              <button
                onClick={() => {
                  setSelectedOwner(null);
                  setMessages([]);
                }}
                className="text-white/60 hover:text-white text-xs px-2 py-1 rounded-full hover:bg-white/10 transition-colors"
              >
                Switch
              </button>
            )}
          </div>

          {/* Owner picker */}
          {!selectedOwner ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <div className="text-4xl">👤</div>
              <p className="text-gray-600 dark:text-gray-400 text-sm text-center">
                Who are you? I'll personalise answers about your benefits and balances.
              </p>
              {ownerLoading ? (
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <div className="w-full space-y-2">
                  {owners.map((owner) => (
                    <button
                      key={owner.id}
                      onClick={() => setSelectedOwner(owner)}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 border border-transparent hover:border-teal-300 rounded-xl text-left transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{owner.name}</p>
                      {owner.cards.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {owner.cards.map((c) => c.name).join(", ")}
                        </p>
                      )}
                    </button>
                  ))}
                  {owners.length === 0 && (
                    <p className="text-xs text-gray-400 text-center">No owners found.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-3xl mb-3">✨</div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                      Ask about your benefits, card policies, balances, and more.
                    </p>
                    <div className="space-y-2">
                      {quickQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(q)}
                          className="block w-full text-left px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "user" ? (
                        <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-teal-600 text-white rounded-br-md">
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ) : (
                        <div className="max-w-[90%] px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md">
                          {msg.content === "" && msg.streaming ? (
                            // Tool-call phase — no text yet, show dots
                            <div className="flex gap-1 py-1">
                              <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content}
                              {msg.streaming && (
                                <span className="inline-block w-0.5 h-4 bg-teal-500 ml-0.5 animate-pulse align-middle" />
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your cards..."
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="w-10 h-10 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 rounded-full flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
