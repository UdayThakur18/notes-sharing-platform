import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");

  // New states for AI
  const [loadingAI, setLoadingAI] = useState(null); // Stores ID of note being summarized
  const [summary, setSummary] = useState("");

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
      alert("Upload Successful!");
      setTitle("");
      setFile(null);
      fetchNotes();
    } catch (err) {
      alert("Upload failed.");
    }
  };

  const handleSummarize = async (noteId, filename) => {
    setLoadingAI(noteId); // Start loading for this specific card
    setSummary("");
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/summarize/${filename}`,
      );
      setSummary(res.data.summary);
      alert("AI Summary: " + res.data.summary);
    } catch (err) {
      alert(
        "AI summarization failed. Make sure the file contains readable text.",
      );
    } finally {
      setLoadingAI(null); // Stop loading
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
      <h1>Resource Sharing Hub</h1>

      {/* SEARCH */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search for notes (e.g. Data Structures)..."
          onChange={(e) => {
            setSearch(e.target.value);
            fetchNotes(e.target.value);
          }}
        />
      </div>

      {/* UPLOAD FORM */}
      <div className="upload-section">
        <h3>Upload New Note</h3>
        <form onSubmit={handleUpload}>
          <input
            placeholder="Note Title (e.g. OS Unit 2)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button type="submit" className="btn-primary">
            Upload Resource
          </button>
        </form>
      </div>

      {/* DISPLAY NOTES */}
      <div className="grid">
        {notes.length > 0 ? (
          notes.map((n) => (
            <div key={n.id} className="card">
              <div className="card-badge">{n.type.toUpperCase()}</div>
              <h3>{n.title}</h3>
              <div className="card-actions">
                <a
                  className="btn-view"
                  href={`http://127.0.0.1:5000/download/${n.file_url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View File
                </a>
                <button
                  className="btn-ai"
                  onClick={() => handleSummarize(n.id, n.file_url)}
                  disabled={loadingAI === n.id}
                >
                  {loadingAI === n.id ? "✨ AI Thinking..." : "✨ Summarize"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No notes found. Be the first to upload!</p>
        )}
      </div>

      {/* TICKET SYSTEM */}
      <div className="ticket-section">
        <h3>Can't find a note? Demand it here:</h3>
        <div className="ticket-form">
          <input
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            placeholder="Describe the notes you need..."
          />
          <button onClick={handleTicket} className="btn-secondary">
            Raise Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
