import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

function App() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [loadingAI, setLoadingAI] = useState(null);

  const fetchNotes = async (query = "") => {
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/notes?search=${query}`,
      );
      setNotes(res.data);
    } catch (err) {
      console.error("Error fetching notes", err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title)
      return alert("Please provide both a title and a file.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    try {
      await axios.post("http://127.0.0.1:5000/upload", formData);
      setTitle("");
      setFile(null);
      fetchNotes();
    } catch (err) {
      alert("Upload failed.");
    }
  };

  const handleSummarize = async (noteId, filename) => {
    setLoadingAI(noteId);
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/summarize/${filename}`,
      );
      alert("✨ AI Summary: " + res.data.summary);
    } catch (err) {
      alert("Summarization failed.");
    } finally {
      setLoadingAI(null);
    }
  };

  const handleTicket = async () => {
    if (!ticketQuery) return;
    await axios.post("http://127.0.0.1:5000/ticket", { query: ticketQuery });
    alert("Ticket Raised!");
    setTicketQuery("");
  };

  return (
    <div className="App">
      {/* Background Glows */}
      <div className="bg-glow-1"></div>
      <div className="bg-glow-2"></div>

      <motion.h1
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="main-title"
      >
        Resource Sharing <span>Hub</span>
      </motion.h1>

      {/* SEARCH */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="search-container"
      >
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search the archives..."
          onChange={(e) => fetchNotes(e.target.value)}
        />
      </motion.div>

      {/* UPLOAD FORM */}
      <motion.div whileHover={{ scale: 1.01 }} className="upload-section glass">
        <h3>Upload New Intelligence</h3>
        <form onSubmit={handleUpload} className="futuristic-form">
          <input
            placeholder="Document Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="file"
            className="file-input"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button type="submit" className="btn-primary">
            Initialize Upload
          </button>
        </form>
      </motion.div>

      {/* DISPLAY NOTES */}
      <div className="grid">
        <AnimatePresence>
          {notes.map((n, index) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -10 }}
              className="card glass"
            >
              <div className="card-badge">{n.type.toUpperCase()}</div>
              <h3>{n.title}</h3>
              <div className="card-actions">
                <a
                  className="btn-view"
                  href={`http://127.0.0.1:5000/download/${n.file_url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Access File
                </a>
                <button
                  className="btn-ai"
                  onClick={() => handleSummarize(n.id, n.file_url)}
                  disabled={loadingAI === n.id}
                >
                  {loadingAI === n.id ? "Processing..." : "✨ AI Summary"}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* TICKET SYSTEM */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="ticket-section glass"
      >
        <h3>Request Specific Data</h3>
        <div className="ticket-form">
          <input
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            placeholder="What knowledge are you seeking?"
          />
          <button onClick={handleTicket} className="btn-secondary">
            Submit Ticket
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
