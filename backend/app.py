import os
import pdfplumber
import pytesseract # For Image OCR
from PIL import Image # For Image processing
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
from werkzeug.utils import secure_filename
from transformers import pipeline, AutoModelForSeq2SeqLM, AutoTokenizer

app = Flask(__name__)
CORS(app)

# Point Python to your Tesseract installation
# Change this path if you installed Tesseract in a different folder
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

model_name = "sshleifer/distilbart-cnn-12-6"

try:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    summarizer = pipeline(
        "summarization", 
        model=model, 
        tokenizer=tokenizer,
        force_bos_token_id=0
    )
    print("AI Model loaded successfully!")
except Exception as e:
    print(f"AI Model failed to load: {e}")
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
    query = db.Column(db.String(200), nullable=False)
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
        "file_url": n.file_url, "type": n.file_type 
    } for n in notes])

@app.route('/summarize/<filename>')
def summarize_note(filename):
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        text = ""

        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404

        # 1. Handle Images (NEW)
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            text = pytesseract.image_to_string(Image.open(filepath))
            
        # 2. Handle PDFs
        elif filename.lower().endswith('.pdf'):
            with pdfplumber.open(filepath) as pdf:
                pages = pdf.pages[:2]
                text = " ".join([p.extract_text() for p in pages if p.extract_text()])
        
        # 3. Handle Text files
        else:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()

        if len(text.strip()) < 30:
            return jsonify({"summary": "Could not extract enough text to summarize."})

        # Process with AI
        summary = summarizer(text[:1000], max_length=130, min_length=30, do_sample=False)
        return jsonify({"summary": summary[0]['summary_text']})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    # as_attachment=True ensures the browser downloads the file instead of opening it
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/ticket', methods=['POST'])
def raise_ticket():
    data = request.json
    new_ticket = Ticket(query=data['query'])
    db.session.add(new_ticket)
    db.session.commit()
    return jsonify({"message": "Ticket raised"}), 201

@app.route('/tickets', methods=['GET'])
def get_tickets():
    try:
        tickets = Ticket.query.all()
        return jsonify([{"id": t.id, "query": t.query, "status": t.status} for t in tickets]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)