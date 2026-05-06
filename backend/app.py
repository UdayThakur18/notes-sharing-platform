import os
import pdfplumber
import pytesseract # For Image OCR
from PIL import Image # For Image processing
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
from werkzeug.utils import secure_filename
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline
import torch

app = Flask(__name__)
CORS(app)

# Point to your Tesseract installation
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- AI Loading Logic ---
model_name = "sshleifer/distilbart-cnn-12-6"

try:
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    model.config.forced_bos_token_id = 0
    
    # Manual function to bypass the broken 'summarization' task check
    def summarizer_function(text):
        inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True)
        summary_ids = model.generate(inputs["input_ids"], max_length=130, min_length=30, do_sample=False)
        return [{"summary_text": tokenizer.decode(summary_ids[0], skip_special_tokens=True)}]

    summarizer = summarizer_function
    print("🚀 Nexus AI: Manual Model loaded successfully!")
except Exception as e:
    print(f"❌ Nexus AI: Load failed. Error: {e}")
    summarizer = None

# --- Models ---
class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    file_path = db.Column(db.String(200)) 
    file_type = db.Column(db.String(50))
    date_posted = db.Column(db.DateTime, default=datetime.utcnow)

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    query = db.Column(db.String(200), nullable=False) # This name conflicts with .query method
    status = db.Column(db.String(20), default="Pending")

with app.app_context():
    db.create_all()

# --- Routes ---

@app.route('/upload', methods=['POST'])
def upload_note():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    title = request.form.get('title')
    description = request.form.get('description')

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    new_note = Note(
        title=title, 
        description=description, 
        file_path=filename, 
        file_type=filename.split('.')[-1]
    )
    db.session.add(new_note)
    db.session.commit()
    return jsonify({"message": "Uploaded successfully"}), 201

@app.route('/notes', methods=['GET'])
def get_notes():
    search_query = request.args.get('search', '')
    if search_query:
        notes = Note.query.filter(Note.title.contains(search_query)).all()
    else:
        notes = Note.query.all()
    
    return jsonify([{
        "id": n.id, "title": n.title, "description": n.description, 
        "file_url": n.file_path, "type": n.file_type 
    } for n in notes])

@app.route('/summarize/<filename>')
def summarize_note(filename):
    if not summarizer:
        return jsonify({"error": "AI Model not available"}), 500
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        text = ""

        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404

        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            text = pytesseract.image_to_string(Image.open(filepath))
        elif filename.lower().endswith('.pdf'):
            with pdfplumber.open(filepath) as pdf:
                pages = pdf.pages[:2]
                text = " ".join([p.extract_text() for p in pages if p.extract_text()])
        else:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()

        if not text or len(text.strip()) < 30:
            return jsonify({"summary": "Could not extract enough text to summarize."})

        # FIX: Call the manual function without the pipeline arguments
        summary = summarizer(text[:1000]) 
        return jsonify({"summary": summary[0]['summary_text']})

    except Exception as e:
        print(f"Summarize Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/ticket', methods=['POST'])
def raise_ticket():
    data = request.json
    if not data or 'query' not in data:
        return jsonify({"error": "Query required"}), 400
    new_ticket = Ticket(query=data['query'])
    db.session.add(new_ticket)
    db.session.commit()
    return jsonify({"message": "Ticket raised"}), 201

@app.route('/tickets', methods=['GET'])
def get_tickets():
    try:
        # FIX: Use db.session.query to avoid conflict with the 'query' column name
        tickets = db.session.query(Ticket).all()
        return jsonify([{"id": t.id, "query": t.query, "status": t.status} for t in tickets]), 200
    except Exception as e:
        print(f"Ticket Fetch Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)