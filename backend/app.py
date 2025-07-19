from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from models import db, Category, DocumentSample, Annotation, ExtractedResult
import os
from datetime import datetime
from dotenv import load_dotenv
from urllib.parse import quote_plus

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Update CORS to allow both React and vanilla frontend
CORS(app, origins=['http://localhost:3000', 'http://localhost:5000', 'http://localhost:8080'], supports_credentials=True)

# Read and encode database credentials from .env
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD_RAW = os.getenv("MYSQL_PASSWORD", "password")
MYSQL_PASSWORD = quote_plus(MYSQL_PASSWORD_RAW)  # Encode special characters
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "ocr_automation")

# Construct MySQL URI
SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"

# Use MySQL if a non-default password is set; fallback to SQLite otherwise
if MYSQL_PASSWORD_RAW and MYSQL_PASSWORD_RAW != 'password':
    app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
else:
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "database.db")}'

# Other Flask configs
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')

# Static folder for vanilla frontend
app.config['STATIC_FOLDER'] = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'static')

# Initialize DB and create folders
db.init_app(app)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['STATIC_FOLDER'], exist_ok=True)

# Register routes
from routes.training import training_bp
from routes.inference import inference_bp

app.register_blueprint(training_bp)
app.register_blueprint(inference_bp)

# Routes
@app.route('/')
def index():
    """Serve the vanilla frontend"""
    try:
        return send_from_directory(app.config['STATIC_FOLDER'], 'index.html')
    except FileNotFoundError:
        return jsonify({
            "message": "OCR Document Automation System API",
            "note": "Frontend not found. Please copy the vanilla-frontend files to the static folder.",
            "frontend_path": app.config['STATIC_FOLDER']
        })

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files for the vanilla frontend"""
    try:
        return send_from_directory(app.config['STATIC_FOLDER'], filename)
    except FileNotFoundError:
        # If file not found, serve index.html for SPA routing
        try:
            return send_from_directory(app.config['STATIC_FOLDER'], 'index.html')
        except FileNotFoundError:
            return jsonify({"error": "File not found"}), 404

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/test-proxy')
def test_proxy():
    return jsonify({"message": "Proxy is working!", "timestamp": datetime.now().isoformat()})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        print(f"🔍 Requested file: {filename}")
        print(f"🔍 Full path: {file_path}")
        print(f"🔍 File exists: {os.path.exists(file_path)}")

        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return jsonify({'error': 'File not found'}), 404

        # Get file info
        file_size = os.path.getsize(file_path)
        print(f"✅ Serving file: {file_path} (size: {file_size} bytes)")

        response = send_from_directory(app.config['UPLOAD_FOLDER'], filename)

        # Enhanced CORS headers for image loading
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Length, Content-Type'
        response.headers['Cache-Control'] = 'public, max-age=3600'  # Cache for 1 hour

        print(f"✅ Response headers set for {filename}")
        return response
    except Exception as e:
        print(f"❌ Error serving file {filename}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error serving file'}), 500

@app.route('/uploads/<filename>', methods=['OPTIONS'])
def uploaded_file_options(filename):
    """Handle CORS preflight requests for file uploads"""
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# Entry point
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("[INFO] Database initialized.")
        print(f"[INFO] Connected to: {app.config['SQLALCHEMY_DATABASE_URI']}")
        print(f"[INFO] Upload folder: {app.config['UPLOAD_FOLDER']}")
    app.run(debug=True, host='0.0.0.0', port=5000)