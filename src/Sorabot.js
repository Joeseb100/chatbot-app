import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Sorabot.css'; // We'll create this next

const RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;

const Sorabot = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions] = useState([
    'Explain quantum computing',
    'How does blockchain work?',
    'What is artificial intelligence?'
  ]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const makeApiCall = async (userMessage, retryCount = 0) => {
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant. Provide clear, concise answers.'
            },
            ...messages.slice(-4),
            userMessage
          ],
          max_tokens: 150,
          temperature: 0.7,
          presence_penalty: 0.6,
          frequency_penalty: 0.5
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
        // Wait and retry
        await sleep(RETRY_DELAY * (retryCount + 1));
        return makeApiCall(userMessage, retryCount + 1);
      }
      throw error;
    }
  };

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const apiKey = process.env.REACT_APP_GOOGLE_API_KEY;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [{
              text: input
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }
      );

      const botMessage = { 
        role: 'assistant', 
        content: response.data.candidates[0].content.parts[0].text,
        sources: ['Google Gemini']
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      let errorMessage = 'Error fetching response';
      
      if (error.response?.status === 401) {
        errorMessage = 'Invalid API key. Please check your credentials.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.';
      }
      
      console.error('Gemini API Error:', error);
      
      const errorBotMessage = { 
        role: 'assistant', 
        content: errorMessage 
      };
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  return (
    <div className="chat-container">
      <div className="command-suggestions">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="suggestion-chip"
            onClick={() => handleSuggestionClick(suggestion)}
          >
            {suggestion}
          </div>
        ))}
      </div>
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`}
          >
            <div className="message-content">
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
            </div>
            {msg.sources && (
              <div className="sources-container">
                {msg.sources.map((source, idx) => (
                  <div key={idx} className="source-tag">
                    {source}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="loading-bubble">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-container glass-effect">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="chat-input"
          placeholder="Ask anything..."
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          className={`send-button ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </div>
    </div>
  );
};

export default Sorabot;