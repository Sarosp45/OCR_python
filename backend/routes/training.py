from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
import os
import uuid
import logging
import time
from models import db, Category, DocumentSample, Annotation
from nanonets_api import nanonets_api, NanonetsAPIError
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

training_bp = Blueprint('training', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'tiff', 'bmp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@training_bp.route('/create-category', methods=['POST'])
def create_category():
    """Create a new document category"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Category name is required'}), 400
        
        category_name = data['name'].strip()
        model_type = data.get('model_type', 'cloud')  # Default to cloud
        
        if not category_name:
            return jsonify({'error': 'Category name cannot be empty'}), 400
        
        if model_type not in ['cloud', 'hf']:
            return jsonify({'error': 'Model type must be either "cloud" or "hf"'}), 400
        
        # Check if category already exists
        existing_category = Category.query.filter_by(name=category_name).first()
        if existing_category:
            return jsonify({'error': 'Category already exists'}), 400
        
        # Create new category
        category = Category(name=category_name, model_type=model_type)
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Category created successfully',
            'category': category.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@training_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all categories"""
    try:
        print("Fetching categories...")  # Debug log
        categories = Category.query.all()
        print(f"Found {len(categories)} categories")  # Debug log
        return jsonify({
            'categories': [category.to_dict() for category in categories]
        }), 200
        
    except Exception as e:
        print(f"Error fetching categories: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

@training_bp.route('/upload-training', methods=['POST'])
def upload_training():
    """Upload single document for training (vanilla frontend compatible)"""
    try:
        # Check if category_id is provided
        if 'category_id' not in request.form:
            return jsonify({'error': 'Category ID is required'}), 400

        category_id = request.form['category_id']

        # Verify category exists
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if file and allowed_file(file.filename):
            # Generate unique filename
            filename = str(uuid.uuid4()) + '_' + secure_filename(file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

            # Save file
            file.save(file_path)

            # Create document record
            document = DocumentSample(
                category_id=category_id,
                filename=filename,
                original_filename=file.filename,
                file_path=file_path
            )

            db.session.add(document)
            db.session.commit()

            return jsonify({
                'message': 'File uploaded successfully',
                'document': document.to_dict()
            }), 201
        else:
            return jsonify({'error': 'Invalid file type'}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@training_bp.route('/upload-documents', methods=['POST'])
def upload_documents():
    """Upload multiple documents for training"""
    try:
        # Check if category_id is provided
        if 'category_id' not in request.form:
            return jsonify({'error': 'Category ID is required'}), 400

        category_id = request.form['category_id']

        # Verify category exists
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        # Check if files are present
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')

        if not files or all(file.filename == '' for file in files):
            return jsonify({'error': 'No files selected'}), 400

        uploaded_documents = []

        for file in files:
            if file and allowed_file(file.filename):
                # Generate unique filename
                filename = str(uuid.uuid4()) + '_' + secure_filename(file.filename)
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

                # Save file
                file.save(file_path)

                # Create document record
                document = DocumentSample(
                    category_id=category_id,
                    filename=filename,
                    original_filename=file.filename,
                    file_path=file_path
                )

                db.session.add(document)
                db.session.flush()  # Get the ID without committing

                uploaded_documents.append(document.to_dict())

        db.session.commit()

        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_documents)} documents',
            'documents': uploaded_documents
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@training_bp.route('/save-annotations', methods=['POST'])
def save_annotations():
    """Save field annotations for a document"""
    try:
        data = request.get_json()
        
        if not data or 'document_id' not in data or 'annotations' not in data:
            return jsonify({'error': 'Document ID and annotations are required'}), 400
        
        document_id = data['document_id']
        annotations_data = data['annotations']
        
        # Verify document exists
        document = DocumentSample.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Delete existing annotations for this document
        Annotation.query.filter_by(document_id=document_id).delete()
        
        # Save new annotations
        saved_annotations = []
        for annotation_data in annotations_data:
            annotation = Annotation(
                document_id=document_id,
                field_name=annotation_data['field_name'],
                x=annotation_data['x'],
                y=annotation_data['y'],
                w=annotation_data.get('w', annotation_data.get('width', 0)),
                h=annotation_data.get('h', annotation_data.get('height', 0))
            )
            db.session.add(annotation)
            db.session.flush()
            saved_annotations.append(annotation.to_dict())
        
        db.session.commit()
        
        return jsonify({
            'message': 'Annotations saved successfully',
            'annotations': saved_annotations
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@training_bp.route('/train-model/<int:category_id>', methods=['POST'])
def train_model_by_id(category_id):
    """Train a model for a specific category by ID (vanilla frontend compatible)"""
    try:
        # Get category
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        return _train_model_logic(category)

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@training_bp.route('/train-model', methods=['POST'])
def train_model():
    """Train a model for a specific category (cloud or HF)"""
    try:
        data = request.get_json()

        if not data or 'category_id' not in data:
            return jsonify({'error': 'Category ID is required'}), 400

        category_id = data['category_id']

        # Get category
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        return _train_model_logic(category)

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def _train_model_logic(category):
    """Common training logic for both endpoints"""
    try:
        category_id = category.id
        
        # Get all documents with annotations for this category
        documents = DocumentSample.query.filter_by(category_id=category_id).all()
        
        if not documents:
            return jsonify({'error': 'No documents found for this category'}), 400
        
        # Check if documents have annotations
        annotated_documents = []
        for document in documents:
            annotations = Annotation.query.filter_by(document_id=document.id).all()
            if annotations:
                annotated_documents.append(document)
        
        if not annotated_documents:
            return jsonify({'error': 'No annotated documents found for training'}), 400
        
        # Route based on model type
        if category.model_type == 'cloud':
            # Enhanced Nanonets cloud training
            logger.info(f"🌩️ Starting cloud training for category {category.name}")

            # Validate Nanonets API availability
            if not nanonets_api:
                return jsonify({'error': 'Nanonets API not available. Please check configuration.'}), 500

            # Validate API connection
            if not nanonets_api.validate_api_connection():
                return jsonify({'error': 'Cannot connect to Nanonets API. Please check your API key.'}), 500

            # Validate minimum training data requirements
            min_documents = 5
            if len(annotated_documents) < min_documents:
                return jsonify({
                    'error': f'At least {min_documents} annotated documents are required for cloud training',
                    'current_count': len(annotated_documents),
                    'required_count': min_documents
                }), 400

            # Create or get Nanonets model
            if not category.model_id:
                logger.info(f"🔨 Creating new Nanonets model for category: {category.name}")
                try:
                    model_response = nanonets_api.create_model(f"{category.name}_model")
                    category.model_id = model_response.get('model_id')
                    if not category.model_id:
                        raise Exception("Model ID not returned from Nanonets")
                    logger.info(f"✅ Created model with ID: {category.model_id}")
                    db.session.commit()
                except NanonetsAPIError as e:
                    logger.error(f"❌ Failed to create Nanonets model: {e}")
                    return jsonify({'error': f'Failed to create model: {e}'}), 500
            else:
                logger.info(f"📋 Using existing model ID: {category.model_id}")

            model_id = category.model_id

            # Upload training data to Nanonets with enhanced error tracking
            uploaded_count = 0
            failed_uploads = []

            for document in annotated_documents:
                try:
                    logger.info(f"📤 Uploading document {document.id}: {document.original_filename}")

                    # Validate file exists
                    if not os.path.exists(document.file_path):
                        logger.warning(f"⚠️ File not found: {document.file_path}")
                        failed_uploads.append({
                            'document_id': document.id,
                            'filename': document.original_filename,
                            'error': 'File not found'
                        })
                        continue

                    # Get annotations
                    annotations = Annotation.query.filter_by(document_id=document.id).all()
                    annotations_data = [annotation.to_dict() for annotation in annotations]

                    if not annotations_data:
                        logger.warning(f"⚠️ No annotations found for document {document.id}")
                        failed_uploads.append({
                            'document_id': document.id,
                            'filename': document.original_filename,
                            'error': 'No annotations'
                        })
                        continue

                    # Upload to Nanonets
                    nanonets_api.upload_training_data(model_id, document.file_path, annotations_data)

                    # Mark document as used for training
                    document.is_trained = True
                    uploaded_count += 1
                    logger.info(f"✅ Successfully uploaded document {document.id}")

                except NanonetsAPIError as e:
                    logger.error(f"❌ Nanonets error uploading document {document.id}: {e}")
                    failed_uploads.append({
                        'document_id': document.id,
                        'filename': document.original_filename,
                        'error': str(e)
                    })
                except Exception as e:
                    logger.error(f"❌ Unexpected error uploading document {document.id}: {e}")
                    failed_uploads.append({
                        'document_id': document.id,
                        'filename': document.original_filename,
                        'error': str(e)
                    })

            logger.info(f"📊 Upload summary: {uploaded_count} successful, {len(failed_uploads)} failed")

            # Check if we have enough successful uploads
            if uploaded_count < min_documents:
                return jsonify({
                    'error': f'Only {uploaded_count} documents uploaded successfully. Minimum {min_documents} required.',
                    'successful_uploads': uploaded_count,
                    'failed_uploads': failed_uploads
                }), 400

            # Start training
            try:
                logger.info(f"🚀 Starting training for model {model_id}")
                training_response = nanonets_api.train_model(model_id)
                logger.info("✅ Training started successfully")
            except NanonetsAPIError as e:
                logger.error(f"❌ Failed to start training: {e}")
                return jsonify({'error': f'Failed to start training: {e}'}), 500

            db.session.commit()

            response_data = {
                'message': f'Cloud training started successfully with {uploaded_count} documents',
                'model_id': model_id,
                'model_type': 'cloud',
                'successful_uploads': uploaded_count,
                'total_documents': len(annotated_documents),
                'training_response': training_response
            }

            if failed_uploads:
                response_data['failed_uploads'] = failed_uploads
                response_data['warning'] = f'{len(failed_uploads)} documents failed to upload'

            return jsonify(response_data), 200
            
        elif category.model_type == 'hf':
            # Hugging Face local training
            from hf_ocr import hf_ocr
            
            # Prepare training data
            training_data = []
            for document in annotated_documents:
                annotations = Annotation.query.filter_by(document_id=document.id).all()
                annotations_data = [annotation.to_dict() for annotation in annotations]
                training_data.append({
                    'image_path': document.file_path,
                    'annotations': annotations_data
                })
                document.is_trained = True
            
            # Start training (placeholder)
            training_response = hf_ocr.train_model(training_data)
            
            # Generate model ID for HF model
            if not category.model_id:
                category.model_id = f"hf_{category.name}_{len(training_data)}_samples"
                
            db.session.commit()
            
            return jsonify({
                'message': f'HF training started successfully with {len(training_data)} documents',
                'model_id': category.model_id,
                'model_type': 'hf',
                'training_response': training_response
            }), 200
        
        else:
            return jsonify({'error': 'Invalid model type'}), 400
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@training_bp.route('/model-status/<model_id>', methods=['GET'])
def get_model_status(model_id):
    """Get the training status of a Nanonets model with enhanced information"""
    try:
        logger.info(f"📊 Checking status for model {model_id}")

        if not nanonets_api:
            return jsonify({'error': 'Nanonets API not available'}), 500

        # Get model status from Nanonets
        status = nanonets_api.get_model_status(model_id)

        # Find the category associated with this model
        category = Category.query.filter_by(model_id=model_id).first()

        # Enhance response with local information
        enhanced_status = {
            'nanonets_status': status,
            'model_id': model_id,
            'timestamp': time.time()
        }

        if category:
            # Get training documents count
            documents = DocumentSample.query.filter_by(category_id=category.id).all()
            trained_documents = [doc for doc in documents if doc.is_trained]

            enhanced_status.update({
                'category_name': category.name,
                'category_id': category.id,
                'model_type': category.model_type,
                'total_documents': len(documents),
                'trained_documents': len(trained_documents),
                'annotated_documents': len([doc for doc in documents if doc.annotations])
            })

        # Extract key information from Nanonets response
        if 'result' in status:
            result = status['result']
            enhanced_status.update({
                'state': result.get('state', 'unknown'),
                'accuracy': result.get('accuracy'),
                'categories': result.get('categories', []),
                'created_date': result.get('created_date'),
                'updated_date': result.get('updated_date')
            })

        return jsonify(enhanced_status), 200

    except NanonetsAPIError as e:
        logger.error(f"❌ Nanonets API error getting model status: {e}")
        return jsonify({'error': f'Nanonets API error: {e}'}), 500
    except Exception as e:
        logger.error(f"❌ Unexpected error getting model status: {e}")
        return jsonify({'error': str(e)}), 500

@training_bp.route('/model-fields/<model_id>', methods=['GET'])
def get_model_fields(model_id):
    try:
        fields = nanonets_api.get_model_fields(model_id)
        return jsonify({'fields': fields}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@training_bp.route('/document/<int:document_id>', methods=['GET'])
def get_document_by_id(document_id):
    """Get a specific document by ID with annotations"""
    try:
        document = DocumentSample.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404

        return jsonify(document.to_dict()), 200
    except Exception as e:
        print(f"Error fetching document {document_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@training_bp.route('/document/<int:document_id>/image', methods=['GET'])
def get_document_image(document_id):
    """Get the image file for a specific document"""
    try:
        document = DocumentSample.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404

        # Check if file exists
        if not os.path.exists(document.file_path):
            return jsonify({'error': 'Document file not found'}), 404

        # Get the directory and filename
        file_dir = os.path.dirname(document.file_path)
        filename = os.path.basename(document.file_path)

        print(f"🖼️ Serving document image: {document.file_path}")

        # Create response with proper headers
        response = send_from_directory(file_dir, filename)

        # Enhanced CORS headers for image loading
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Length, Content-Type'
        response.headers['Cache-Control'] = 'public, max-age=3600'  # Cache for 1 hour

        return response

    except Exception as e:
        print(f"❌ Error serving document image {document_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error serving document image'}), 500

@training_bp.route('/documents/<int:category_id>', methods=['GET'])
def get_documents_by_category(category_id):
    """Get all documents for a specific category with annotations"""
    try:
        documents = DocumentSample.query.filter_by(category_id=category_id).all()
        documents_data = []
        
        for document in documents:
            doc_dict = document.to_dict()
            # Include annotations in the response
            annotations = Annotation.query.filter_by(document_id=document.id).all()
            doc_dict['annotations'] = [annotation.to_dict() for annotation in annotations]
            documents_data.append(doc_dict)
        
        return jsonify({
            'documents': documents_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@training_bp.route('/delete-document/<int:document_id>', methods=['DELETE'])
def delete_document(document_id):
    """Delete a document and its annotations"""
    try:
        document = DocumentSample.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Delete file from disk
        try:
            if os.path.exists(document.file_path):
                os.remove(document.file_path)
        except Exception as file_err:
            print(f"Error deleting file: {file_err}")
        
        # Delete annotations first (due to foreign key constraint)
        Annotation.query.filter_by(document_id=document_id).delete()
        
        # Delete document
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'message': 'Document deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500