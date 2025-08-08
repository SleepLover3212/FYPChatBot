import { useState, useRef, useEffect } from 'react'
import './App.css'
import ReactMarkdown from 'react-markdown'
import micIcon from './assets/microphone.png'

function App() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [minutes, setMinutes] = useState(null);
  const [minutesLoading, setMinutesLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micCooldown, setMicCooldown] = useState(false);
  const recognitionRef = useRef(null);

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
      "I want to share my special needs condition", "disability"
    ],
    knownConditions: [
      "skeletal dysplasia", "dwarfism",
      "blind", "visual impairment", "visually impaired", "low vision",
      "autism spectrum disorder", "autism",
      "attention deficit hyperactivity disorder", "adhd", "dyslexia",
      "hearing impairment", "deafness", "deaf"
    ],
    refusal: [
      "no", "don't want", "do not want", "prefer not", "rather not", "not comfortable", "don't wish", "no thanks", "don't feel like", "not interested", "no need", "idk", "nah", "nay", "nuh uh"
    ],
    summary: [
      "attention deficit hyperactivity disorder", "adhd", "dyslexia"
    ],
    hearingRelated: [
      "hearing impairment", "deafness", "deaf"
    ],
    sightRelated: [
      "blind", "visual impairment", "visually impaired", "low vision"
    ],
    yes: [
      "yes", "yeah", "yep", "sure", "please do", "ok", "okay", "pls", "please"
    ]
  };

  const matchesKeyword = (message, category) => {
    const keywords = keywordCategories[category];
    const lowerCaseMessage = message.toLowerCase();
    return keywords.some(keyword => lowerCaseMessage.includes(keyword.toLowerCase())); // Check if any keyword is included
  };

  useEffect(() => {
    const lastAssistantMsg = conversation.filter(msg => msg.role === "assistant").slice(-1)[0];
    if (
      lastAssistantMsg &&
      lastAssistantMsg.content.includes("Would you like me to summarise")
    ) {
      if (matchesKeyword(message, "yes")) {
        setSimplify(true);
        setConversation(prev => [
          ...prev,
          { role: "user", content: message },
          { role: "assistant", content: "Okay! I will provide my answers in point form or numbered lists to make them easier to understand. Please let me know your next question or request." }
        ]);
        setMessage('');
      } else if (matchesKeyword(message, "refusal")) {
        setConversation(prev => [
          ...prev,
          { role: "user", content: message },
          { role: "assistant", content: "No problem! I will continue answering your questions as usual. Let me know how I can assist you further." }
        ]);
        setMessage('');
      }
    }
  }, [message, conversation]);

  const sendMessage = async (msg) => {
    const userMsg = (typeof msg === "string" ? msg : message).trim();
    if (!userMsg) return;

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
      }

      let followUp = "Thank you for sharing. How can I assist you further?";
      // Check for sight-related condition
      if (matchesKeyword(userMsg, "sightRelated")) {
        setSpecialNeeds("visual impairment");
        setVoiceMode(true);
        localStorage.setItem('voiceMode', true);
        setTimeout(() => startListening(), 500);
        followUp = "Thank you for sharing. Since you mentioned a visual impairment, voice mode has been enabled. Please speak your next message. You can also use CTRL + Spacebar keys to activate the microphone without using";
      }
      // Check for hearing-related condition
      else if (matchesKeyword(userMsg, "hearingRelated")) {
        setSpecialNeeds("hearing impairment");
        followUp = "Thank you for sharing. Since you mentioned hearing impairment or deafness, you might find the audio summary feature helpful. You can insert audio files under 25 MB and transcribe the video into text.";
      }
      // Check for adhd/dyslexia
      else if (matchesKeyword(userMsg, "summary")) {
        setSpecialNeeds("adhd/dyslexia");
        followUp = "Thank you for sharing. Would you like me to summarise any text or information for you to make it easier to understand?";
      } else if (matchesKeyword(userMsg, "knownConditions")) {
        setSpecialNeeds(userMsg);
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

      setAwaitingCondition(false);
      setMessage('');
      setConversation([
        ...conversation,
        { role: "user", content: userMsg },
        { role: "assistant", content: followUp }
      ]);
      return;
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
    if (awaitingCondition && !specialNeeds && !refusedCondition && conversation.filter(msg => msg.role === "user").length > 2) {
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

    console.log("Sending payload to backend:", {
      messages: newConversation,
      specialNeeds,
      refusedCondition,
      simplify,
      voiceMode
    });

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newConversation,
          specialNeeds,
          refusedCondition,
          simplify,
          voiceMode
        }),
      });

      const data = await res.json();
      console.log("Backend response data:", data);

      if (data.response) {
        const botResponse = data.response;
        setConversation([
          ...newConversation,
          { role: "assistant", content: botResponse }
        ]);

        if (voiceMode || data.tts) {
          speakText(botResponse);
        }
      }

      if (data.error) {
        setConversation([...newConversation, { role: "assistant", content: `Error: ${data.error}` }]);
      } else if (data.response) {
        setConversation([...newConversation, { role: "assistant", content: data.response }]);
        if (voiceMode || data.tts) speakText(data.response);
      }

      if (data.specialNeeds === "visual" && !voiceMode && !isListening) {
        setSpecialNeeds(data.specialNeeds);
        localStorage.setItem('specialNeeds', data.specialNeeds);

        // Enable voice mode if backend detected visual impairment
        if (data.specialNeeds === "visual" && !voiceMode) {
          setVoiceMode(true);
          localStorage.setItem('voiceMode', true);
          // Optionally, auto-start listening:
          setTimeout(() => startListening(), 500);
        }
      }
      if (typeof data.simplify === "boolean" && data.simplify !== simplify) {
        setSimplify(data.simplify);
      }

      setResponse(data.response || data.error);
      setMessage('');
    } catch (err) {
      // Handle network errors (e.g., backend not running)
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setConversation([
          ...newConversation,
          { role: "assistant", content: "The backend server is currently unreachable. Please try again later." }
        ]);
      } else {
        // Handle other types of errors
        setConversation([
          ...newConversation,
          { role: "assistant", content: `An error occurred: ${err.message}` }
        ]);
      }

      setResponse('Error: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // If space bar is pressed and not focused on a textarea/input
      if (
        e.ctrlKey &&
        e.code === "Space" &&
        document.activeElement.tagName !== "TEXTAREA" &&
        document.activeElement.tagName !== "INPUT"
      ) {
        e.preventDefault();
        if (!micCooldown && !isListening && !loading) {
          startListening();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [micCooldown, isListening, loading]);
  const [showChatbot, setShowChatbot] = useState(true);


  const startListening = () => {
    if (isListening || loading || micCooldown) return;
    setMicCooldown(true);
    setTimeout(() => setMicCooldown(false), 2000); // 2 seconds cooldown
    setShowChatbot(false);
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      setShowChatbot(true);
    };

    recognition.onresult = (event) => {
      const voiceTranscript = event.results[0][0].transcript
      setMessage(voiceTranscript);
      sendMessage(voiceTranscript);
      setIsListening(false);
      setShowChatbot(true);
      recognitionRef.current = null;
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        alert('Speech recognition error: ' + event.error);
      }
      setIsListening(false);
      setShowChatbot(true);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setShowChatbot(true);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // File Upload
  const handleFileChange = (e) => {
    setAudioFile(e.target.files[0]);
  };

  const uploadAudio = async () => {
    if (!audioFile) return;
    const formData = new FormData();
    formData.append('file', audioFile);

    setMinutesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      console.log("API Response:", data); // Debugging log

      if (data.error) {
        setMinutes({ error: data.error });
        setConversation([
          ...conversation,
          { role: "assistant", content: "There was an error transcribing the audio file. Please try again or upload a different file." }
        ]);
      } else {
        setMinutes(data);

        // Add the transcript to the chatbox so the chatbot can read it
        const transcript = data.transcript || "No transcript available.";
        console.log("Transcript:", transcript); // Debugging log
        setConversation([
          ...conversation,
          { role: "user", content: "Uploaded an audio file for transcription." },
          { role: "assistant", content: `Here is the transcript of your audio:\n\n${transcript}` }
        ]);
      }
    } catch (err) {
      console.error("Error:", err); // Debugging log

      // Handle network errors (e.g., backend not running)
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setConversation([
          ...conversation,
          { role: "assistant", content: "The backend server is currently unreachable. Please try again later." }
        ]);
      } else {
        // Handle other types of errors
        setMinutes({ error: err.message });
        setConversation([
          ...conversation,
          { role: "assistant", content: `An error occurred while processing the audio file: ${err.message}` }
        ]);
      }
    }
    setMinutesLoading(false);
  };

  useEffect(() => {
    // Cleanup function: stop any ongoing speech when component unmounts or window reloads
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  const audioRef = useRef(null);

  const speakText = async (text) => {
    try {
      // Stop previous audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      const res = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), // Optionally add voice: "onyx"
      });
      if (!res.ok) throw new Error('TTS request failed');
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioRef.current = audio; // Save reference

      setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);

      audio.play();
    } catch (err) {
      setIsSpeaking(false);
      console.error('OpenAI TTS error:', err);
    }
  };

  const toggleVoiceMode = () => {
    const newVoiceMode = !voiceMode;
    setVoiceMode(newVoiceMode);
    localStorage.setItem('voiceMode', newVoiceMode); // Persist state across sessions
  };

  return (

    <div className="chatbot-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      </div>
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
      {isSpeaking && (
        <div style={{ marginBottom: '10px', color: '#888' }}>
          🔊 NYP SEN Chatbot is speaking...
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

      {/* Chat Controls */}
      <div className="chat-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        {showChatbot && (
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
            style={{ width: '400px', resize: 'vertical' }}
          />
        )}
        <button
          onClick={handleMicClick}
          disabled={loading}
          style={{
            width: 55,
            height: 55,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: isListening ? '3px solid #e53935' : '2px solid black',
            background: isListening ? 'black' : 'white',
            transition: 'background 0.5s, border 0.5s'
          }}>
          <img src={micIcon} alt="🎤" style={{
            width: 24, height: 24, filter: isListening ? 'invert(0)' : 'invert(1)' // Black icon on white, white icon on black
          }} />
        </button>
        {isListening && (
          <span style={{ color: '#888', marginLeft: 8, }}>Listening...</span>
        )}
        <button onClick={sendMessage} disabled={loading || !message} style={{ width: 130, height: 50 }}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Audio Controls */}
      <div className="audio-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          style={{ width: 300 }}
        />
        <button
          onClick={uploadAudio}
          disabled={minutesLoading || !audioFile}
          style={{ width: 200, height: 70 }}
        >
          {minutesLoading ? 'Transcribing...' : 'Transcribe Audio'}
        </button>
        <button
          onClick={() => window.open(`${API_BASE_URL}/download-audio-docx`, '_blank')}
          disabled={minutesLoading || !minutes || minutes.error}
          style={{ width: 200, height: 70 }}
        >
          Download Audio Summary
        </button>
      </div>

      {/*
        # Error handling
        <pre>{response}</pre>
      */}

      <hr style={{ margin: '32px 0' }} />

      {minutes && (
        <div>
          <h2>Audio Summary</h2>
          {minutes.error ? (
            <p>Error: {minutes.error}</p>
          ) : (
            <ul>
              {Object.entries(minutes).map(([key, value]) => (
                <li key={key}>
                  <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong>
                  <ReactMarkdown>{value}</ReactMarkdown>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        className="voice-mode-btn"
        onClick={toggleVoiceMode}
      >
        {voiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
      </button>
    </div>
  );
}

export default App