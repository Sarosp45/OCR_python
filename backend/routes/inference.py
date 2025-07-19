from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from models import db, Category, DocumentSample, ExtractedResult
from nanonets_api import nanonets_api
from utils import convert_pdf_to_images, preprocess_image, generate_unique_filename
import json

inference_bp = Blueprint('inference', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'tiff', 'bmp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@inference_bp.route('/upload-document', methods=['POST'])
def upload_document():
    """Upload a new document for inference"""
    try:
        # Check if category_id is provided
        if 'category_id' not in request.form:
            return jsonify({'error': 'Category ID is required'}), 400
        
        category_id = request.form['category_id']
        
        # Verify category exists and has a trained model
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404
        
        if not category.model_id:
            return jsonify({'error': 'No trained model found for this category'}), 400
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '' or not file:
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
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
            'message': 'Document uploaded successfully',
            'document': document.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@inference_bp.route('/infer', methods=['POST'])
def infer():
    """Run inference on uploaded document with category"""
    try:
        # Check if category_id is provided
        if 'category_id' not in request.form:
            return jsonify({'error': 'Category ID is required'}), 400
        
        category_id = request.form['category_id']
        
        # Verify category exists and has a trained model
        category = Category.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404
        
        if not category.model_id:
            return jsonify({'error': 'No trained model found for this category'}), 400
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '' or not file:
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Generate unique filename
        filename = generate_unique_filename(file.filename)
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        
        # Save file
        file.save(file_path)
        
        # Handle PDF conversion if needed
        image_paths = []
        if file.filename.lower().endswith('.pdf'):
            try:
                image_paths = convert_pdf_to_images(file_path, current_app.config['UPLOAD_FOLDER'])
                # Use first page for inference
                inference_path = image_paths[0] if image_paths else file_path
            except Exception as e:
                inference_path = file_path
                print(f"PDF conversion failed, using original file: {e}")
        else:
            inference_path = file_path
        
        # Create document record
        document = DocumentSample(
            category_id=category_id,
            filename=filename,
            original_filename=file.filename,
            file_path=file_path
        )
        
        db.session.add(document)
        db.session.flush()  # Get document ID
        
        # Run inference based on model type
        extracted_data = []
        
        if category.model_type == 'cloud':
            # Use Nanonets cloud API
            try:
                prediction_response = nanonets_api.predict(category.model_id, inference_path)
                
                if 'result' in prediction_response:
                    for result in prediction_response['result']:
                        if 'prediction' in result:
                            for prediction in result['prediction']:
                                field_name = prediction.get('label', 'unknown')
                                confidence = prediction.get('confidence', 0.0)
                                value = prediction.get('ocr_text', '')
                                
                                extracted_result = ExtractedResult(
                                    document_id=document.id,
                                    field_name=field_name,
                                    value=value,
                                    confidence=confidence
                                )
                                
                                db.session.add(extracted_result)
                                extracted_data.append(extracted_result.to_dict())
                
            except Exception as e:
                return jsonify({'error': f'Cloud inference failed: {str(e)}'}), 500
                
        elif category.model_type == 'hf':
            # Use Hugging Face local model
            try:
                from hf_ocr import hf_ocr
                
                # Get field definitions from training annotations
                sample_docs = DocumentSample.query.filter_by(category_id=category_id).limit(1).all()
                field_definitions = []
                if sample_docs and sample_docs[0].annotations:
                    field_definitions = list(set([ann.field_name for ann in sample_docs[0].annotations]))
                
                hf_results = hf_ocr.predict(inference_path, field_definitions)
                
                for result in hf_results:
                    extracted_result = ExtractedResult(
                        document_id=document.id,
                        field_name=result.get('field_name', 'unknown'),
                        value=result.get('value', ''),
                        confidence=result.get('confidence', 0.0)
                    )
                    
                    db.session.add(extracted_result)
                    extracted_data.append(extracted_result.to_dict())
                    
            except Exception as e:
                return jsonify({'error': f'HF inference failed: {str(e)}'}), 500
        
        db.session.commit()
        
        # Clean up temporary files
        if image_paths:
            from utils import cleanup_temp_files
            cleanup_temp_files(image_paths)
        
        return jsonify({
            'message': 'Inference completed successfully',
            'document': document.to_dict(),
            'extracted_data': extracted_data,
            'model_type': category.model_type
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@inference_bp.route('/extract-data', methods=['POST'])
def extract_data():
    """Extract data from uploaded document using trained model (legacy endpoint)"""
    try:
        data = request.get_json()
        
        if not data or 'document_id' not in data:
            return jsonify({'error': 'Document ID is required'}), 400
        
        document_id = data['document_id']
        
        # Get document
        document = DocumentSample.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Get category and model
        category = document.category
        if not category.model_id:
            return jsonify({'error': 'No trained model found for this category'}), 400
        
        # Check if file exists
        if not os.path.exists(document.file_path):
            return jsonify({'error': 'Document file not found'}), 404
        
        # Run inference based on model type
        extracted_data = []
        
        if category.model_type == 'cloud':
            try:
                prediction_response = nanonets_api.predict(category.model_id, document.file_path)
                
                if 'result' in prediction_response:
                    for result in prediction_response['result']:
                        if 'prediction' in result:
                            for prediction in result['prediction']:
                                field_name = prediction.get('label', 'unknown')
                                confidence = prediction.get('confidence', 0.0)
                                value = prediction.get('ocr_text', '')
                                
                                extracted_result = ExtractedResult(
                                    document_id=document_id,
                                    field_name=field_name,
                                    value=value,
                                    confidence=confidence
                                )
                                
                                db.session.add(extracted_result)
                                extracted_data.append(extracted_result.to_dict())
                
            except Exception as e:
                return jsonify({'error': f'Cloud inference failed: {str(e)}'}), 500
                
        elif category.model_type == 'hf':
            try:
                from hf_ocr import hf_ocr
                
                # Get field definitions from category annotations
                sample_docs = DocumentSample.query.filter_by(category_id=category.category_id).limit(1).all()
                field_definitions = []
                if sample_docs and sample_docs[0].annotations:
                    field_definitions = list(set([ann.field_name for ann in sample_docs[0].annotations]))
                
                hf_results = hf_ocr.predict(document.file_path, field_definitions)
                
                for result in hf_results:
                    extracted_result = ExtractedResult(
                        document_id=document_id,
                        field_name=result.get('field_name', 'unknown'),
                        value=result.get('value', ''),
                        confidence=result.get('confidence', 0.0)
                    )
                    
                    db.session.add(extracted_result)
                    extracted_data.append(extracted_result.to_dict())
                    
            except Exception as e:
                return jsonify({'error': f'HF inference failed: {str(e)}'}), 500
        
        db.session.commit()
        
        return jsonify({
            'message': 'Data extracted successfully',
            'document_id': document_id,
            'extracted_data': extracted_data,
            'model_type': category.model_type
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@inference_bp.route('/results/<int:document_id>', methods=['GET'])
def get_results(document_id):
    """Get extracted results for a specific document"""
    try:
        # Get document
        document = DocumentSample.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Get extracted results
        results = ExtractedResult.query.filter_by(document_id=document_id).all()
        
        return jsonify({
            'document': document.to_dict(),
            'results': [result.to_dict() for result in results]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@inference_bp.route('/update-result', methods=['PUT'])
def update_result():
    """Update/correct an extracted result"""
    try:
        data = request.get_json()
        
        if not data or 'result_id' not in data or 'value' not in data:
            return jsonify({'error': 'Result ID and value are required'}), 400
        
        result_id = data['result_id']
        new_value = data['value']
        
        # Get result
        result = ExtractedResult.query.get(result_id)
        if not result:
            return jsonify({'error': 'Result not found'}), 404
        
        # Update value
        result.value = new_value
        db.session.commit()
        
        return jsonify({
            'message': 'Result updated successfully',
            'result': result.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@inference_bp.route('/delete-result/<int:result_id>', methods=['DELETE'])
def delete_result(result_id):
    """Delete an extracted result"""
    try:
        # Get result
        result = ExtractedResult.query.get(result_id)
        if not result:
            return jsonify({'error': 'Result not found'}), 404
        
        # Delete result
        db.session.delete(result)
        db.session.commit()
        
        return jsonify({'message': 'Result deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@inference_bp.route('/documents/inference', methods=['GET'])
def get_inference_documents():
    """Get all documents used for inference"""
    try:
        # Get documents that have extracted results
        documents = db.session.query(DocumentSample).join(ExtractedResult).distinct().all()
        
        return jsonify({
            'documents': [document.to_dict() for document in documents]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 