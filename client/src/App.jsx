import { useState, useRef, useEffect } from 'react'
import './App.css'
import ReactMarkdown from 'react-markdown'
import micIcon from './assets/microphone.png'

function App() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [minutes, setMinutes] = useState(null)
  const [minutesLoading, setMinutesLoading] = useState(false)

  // General conversation
  const [conversation, setConversation] = useState([
    {
      role: "assistant", content:
        `Please note that this is an AI chat bot, and there is no staff attending to this chat bot.

Please contact emergency hotlines for crisis matters requiring immediate attention:

- SOS (Samaritans of Singapore) Hotline: 1767 (24 hours)

- Mental Health Helpline: 6389 2222 (24 hours)

Please note that this is an AI chat bot, and there is no staff attending to this chat bot

You can type your question or select a topic below to get started!`
    }
  ]);

  const suggestions = [
    "Help on access arrangements",
    "Advice on transition and change in NYP",
    "Types of SEN support in NYP"
  ]

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  const chatContainerRef = useRef(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  // Random empathy phrases to use in responses
  const empathyPhrases = [
    "I'm here to support you.",
    "Thank you for reaching out.",
    "I'm listening.",
  ];
  const randomEmpathy = empathyPhrases[Math.floor(Math.random() * empathyPhrases.length)];

  // Special needs condition handling
  const [specialNeeds, setSpecialNeeds] = useState(null);
  const [awaitingCondition, setAwaitingCondition] = useState(false);
  const [refusedCondition, setRefusedCondition] = useState(false);
  const [simplify, setSimplify] = useState(false);

  const keywordCategories = {
    conditionRelated: [
      "want to share", "special needs", "disability", "condition"
    ],
    knownConditions: [
      "skeletal dysplasia", "dwarfism",
      "visual impairment", "blindness", "low vision",
      "autism spectrum disorder", "autism",
      "attention deficit hyperactivity disorder", "adhd", "dyslexia",
      "hearing impairment", "deafness"
    ],
    refusal: [
      "no", "don't want", "do not want", "prefer not", "rather not", "not comfortable", "don't wish", "no thanks", "don't feel like", "not interested", "no need", "idk", "nah", "nay", "nuh uh"
    ],
    summary: [
      "attention deficit hyperactivity disorder", "adhd", "dyslexia"
    ],
    yes: [
      "yes", "yeah", "yep", "sure", "please do", "ok", "okay", "pls", "please"
    ]
  };

  const matchesKeyword = (msg, category) => {
    const lower = msg.toLowerCase();
    return keywordCategories[category].some(keyword => lower.includes(keyword));
  };

  const lastAssistantMsg = conversation.filter(msg => msg.role === "assistant").slice(-1)[0];
  if (
    lastAssistantMsg &&
    lastAssistantMsg.content.includes("Would you like me to summarise") &&
    matchesKeyword(message, "yes")
  ) {
    setSimplify(true);
    setConversation([
      ...conversation,
      { role: "user", content: message },
      { role: "assistant", content: "Okay! I will provide my answers in point form or numbered lists to make them easier to understand. Please let me know your next question or request." }
    ]);
    setMessage('');
    return;
  }

  if (
    lastAssistantMsg &&
    lastAssistantMsg.content.includes("Would you like me to summarise") &&
    matchesKeyword(message, "refusal")
  ) {
    setConversation([
      ...conversation,
      { role: "user", content: message },
      { role: "assistant", content: "No problem! I will continue answering your questions as usual. Let me know how I can assist you further." }
    ]);
    setMessage('');
    return;
  }

  const sendMessage = async (msg) => {
    const userMsg = (typeof msg === "string" ? msg : message).trim();
    if (!userMsg) return;
    // if (!message.trim()) return;'

    if (awaitingCondition && !specialNeeds && !refusedCondition) {
      if (matchesKeyword(userMsg, "refusal")) {
        setRefusedCondition(true);
        setAwaitingCondition(false);
        setMessage('');
        setConversation([
          ...conversation,
          { role: "user", content: userMsg },
          { role: "assistant", content: "That's alright, you don't have to share if you feel uncomfortable. If you ever wish to share it, feel free to let me know. How can I assist you further?" }
        ]);
        return;
      } else if (matchesKeyword(userMsg, "knownConditions")) {
        setSpecialNeeds(userMsg);
        setAwaitingCondition(false);
        setMessage('');
        let followUp = "Thank you for sharing. How can I assist you further?";
        if (matchesKeyword(userMsg, "summary")) {
          followUp = "Thank you for sharing. Would you like me to summarise any text or information for you to make it easier to understand?";
        }
        setConversation([
          ...conversation,
          { role: "user", content: userMsg },
          { role: "assistant", content: followUp }
        ]);
        return;
      } else {
        // Not a refusal or a known condition, keep prompting
        setMessage('');
        setConversation([
          ...conversation,
          { role: "user", content: userMsg },
          {
            role: "assistant",
            content: `${randomEmpathy} Would you like to share your special needs condition? This will help me assist you better. If you prefer not to share, just let me know.`
          }
        ]);
        return;
      }
    }

    // Only prompt for condition if the message is condition-related
    if (
      matchesKeyword(userMsg, "conditionRelated") &&
      !specialNeeds &&
      !refusedCondition &&
      !awaitingCondition
    ) {
      setAwaitingCondition(true);
      setConversation([
        ...conversation,
        { role: "user", content: userMsg },
        { role: "assistant", content: "Would you like to share your special needs condition? This will help me assist you better. If you prefer not to share, just let me know." }
      ]);
      setMessage('');
      return;
    }

    // In your repeated prompt logic, after a few failed attempts:
    if (awaitingCondition && !specialNeeds && !refusedCondition && userMessages.length > 2) {
      setConversation([
        ...conversation,
        { role: "user", content: userMsg },
        { role: "assistant", content: "Let's continue with your questions. If you wish to share your special needs condition later, just let me know." }
      ]);
      setAwaitingCondition(false);
      setMessage('');
      return;
    }


    const newConversation = [
      ...conversation,
      { role: "user", content: userMsg }
    ];
    setConversation(newConversation);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newConversation,
          specialNeeds,
          refusedCondition,
          simplify
        }),
      })
      const data = await res.json()
      setConversation([
        ...newConversation,
        { role: "assistant", content: data.response }
      ])
      setResponse(data.response)
      setMessage('')
    } catch (err) {
      setResponse('Error: ' + err.message)
    }
    setLoading(false)
  }

  const fetchMinutes = async () => {
    setMinutesLoading(true)
    setMinutes(null)
    try {
      const res = await fetch('http://localhost:3000/minutes')
      const data = await res.json()
      setMinutes(data)
    } catch (err) {
      setMinutes({ error: err.message })
    }
    setMinutesLoading(false)
  }

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      setMessage(event.results[0][0].transcript);
    };
    recognition.onerror = (event) => {
      alert('Speech recognition error: ' + event.error);
    };
    recognition.start();
  };

  return (
    <div className="chatbot-container">
      <h2>NYP SEN Chatbot</h2>
      <div
        ref={chatContainerRef}
        style={{ marginBottom: '16px', maxHeight: 600, overflowY: 'auto' }}>
        {/* Display conversation history */}
        {conversation
          .filter(msg => msg.role !== "system")
          .map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message ${msg.role === "user" ? "user-message" : "bot-message"}`}
            >
              <b>{msg.role === "user" ? "You" : "NYP SEN Chatbot"}:</b>
              <br />
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ))}
        <div ref={chatEndRef} />
      </div>
      {loading && (
        <div style={{ marginBottom: '10px', color: '#888' }}>
          <span className="spinner" /> NYP SEN Chatbot is typing...
        </div>
      )}
      {conversation.length === 1 && (
        <div style={{ display: 'flex', gap: '12px', margin: '16px 0' }}>
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              style={{ flex: 1, minWidth: 0, padding: '12px', fontSize: '1rem', whiteSpace: 'normal', }}
              onClick={() => sendMessage(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={e => {
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.ctrlKey &&
            !loading &&
            message.trim()
          ) {
            sendMessage();
            setMessage('');
            e.preventDefault();
          }
        }}
        placeholder="Type your message..."
        rows={3}
        style={{ width: '600px', resize: 'vertical' }}
      />
      <div className="button-container">
        <button onClick={startListening} style={{ marginLeft: '10px' }}>
          <img src={micIcon} alt="🎤" style={{ width: 24, height: 24 }} />
        </button>
        <button onClick={sendMessage} disabled={loading || !message} style={{ marginLeft: '10px', width: 200 }}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/*
        # Error handling
        <pre>{response}</pre>
      */}

      <hr style={{ margin: '32px 0' }} />

      <button onClick={fetchMinutes} disabled={minutesLoading}>
        {minutesLoading ? 'Loading Minutes...' : 'Get Audio Summary'}
      </button>
      {minutes && (
        <div>
          <h2>Meeting Minutes</h2>
          {minutes.error ? (
            <p>Error: {minutes.error}</p>
          ) : (
            <ul>
              {Object.entries(minutes).map(([key, value]) => (
                <li key={key}>
                  <strong>{key.replace(/_/g, ' ')}:</strong>
                  <pre>{value}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default App