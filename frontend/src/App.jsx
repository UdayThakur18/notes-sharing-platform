import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

function App() {
  const [notes, setNotes] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [loadingAI, setLoadingAI] = useState(null);

  // 1. Fetching logic for Notes
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

  // 2. Fetching logic for Tickets (Live Requests)
  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5000/tickets");
      setTickets(res.data);
    } catch (err) {
      console.error("Error fetching tickets", err);
    }
  };

  // 3. Initial Load
  useEffect(() => {
    fetchNotes();
    fetchTickets();
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
      alert("Intelligence Uploaded!");
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
      alert(
        "Summarization failed. Check if Tesseract is configured for images.",
      );
    } finally {
      setLoadingAI(null);
    }
  };

  const handleTicket = async () => {
    if (!ticketQuery) return;
    try {
      await axios.post("http://127.0.0.1:5000/ticket", { query: ticketQuery });
      alert("Ticket Raised!");
      setTicketQuery("");
      fetchTickets(); // Refresh sidebar instantly
    } catch (err) {
      alert("Failed to raise ticket.");
    }
  };

  return (
    <div className="App">
      <div className="bg-glow-1"></div>
      <div className="bg-glow-2"></div>

      <div className="main-layout">
        {/* LEFT: MAIN CONTENT */}
        <div className="content-area">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="main-title"
          >
            Nexus <span>Notes</span>
          </motion.h1>

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

          <motion.div
            whileHover={{ scale: 1.01 }}
            className="upload-section glass"
          >
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
                    {/* VIEW BUTTON */}
                    <a
                      className="btn-view"
                      href={`http://127.0.0.1:5000/download/${n.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                    {/* DOWNLOAD BUTTON (Forces Download) */}
                    <a
                      className="btn-download"
                      href={`http://127.0.0.1:5000/download/${n.file_url}`}
                      download={n.title}
                    >
                      📥
                    </a>
                    {/* AI SUMMARIZE BUTTON */}
                    <button
                      className="btn-ai"
                      onClick={() => handleSummarize(n.id, n.file_url)}
                      disabled={loadingAI === n.id}
                    >
                      {loadingAI === n.id ? "..." : "✨ AI"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

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

        {/* RIGHT: TICKET SIDEBAR */}
        <motion.aside
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="ticket-sidebar glass"
        >
          <h3>📥 Live Requests</h3>
          <div className="ticket-list">
            {tickets.length > 0 ? (
              tickets.map((t) => (
                <div key={t.id} className="ticket-item">
                  <p>{t.query}</p>
                  <span className={`status-pill ${t.status.toLowerCase()}`}>
                    {t.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="no-tickets">No active requests.</p>
            )}
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

export default App;
