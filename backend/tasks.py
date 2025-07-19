from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Celery
celery_app = Celery(
    'ocr_tasks',
    broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0')
)

# Configure Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    result_expires=3600,  # 1 hour
)

@celery_app.task(bind=True)
def train_cloud_model_task(self, category_id, annotated_documents):
    """Background task for training cloud models"""
    try:
        from models import db, Category, DocumentSample
        from nanonets_api import nanonets_api
        from app import app
        
        with app.app_context():
            # Update task status
            self.update_state(state='PROGRESS', meta={'current': 0, 'total': len(annotated_documents)})
            
            category = Category.query.get(category_id)
            if not category:
                raise Exception('Category not found')
            
            # Create or get model
            if not category.model_id:
                model_response = nanonets_api.create_model(f"{category.name}_model")
                category.model_id = model_response['model_id']
                db.session.commit()
            
            model_id = category.model_id
            uploaded_count = 0
            
            # Upload training data
            for i, doc_data in enumerate(annotated_documents):
                try:
                    document = DocumentSample.query.get(doc_data['id'])
                    if document and document.annotations:
                        annotations = [annotation.to_dict() for annotation in document.annotations]
                        nanonets_api.upload_training_data(model_id, document.file_path, annotations)
                        
                        document.is_trained = True
                        uploaded_count += 1
                        
                        # Update progress
                        self.update_state(
                            state='PROGRESS',
                            meta={'current': i + 1, 'total': len(annotated_documents), 'uploaded': uploaded_count}
                        )
                        
                except Exception as e:
                    print(f"Error uploading document {doc_data.get('filename', 'unknown')}: {e}")
                    continue
            
            if uploaded_count == 0:
                raise Exception('Failed to upload any training data')
            
            # Start training
            training_response = nanonets_api.train_model(model_id)
            db.session.commit()
            
            return {
                'status': 'completed',
                'message': f'Training started successfully with {uploaded_count} documents',
                'model_id': model_id,
                'uploaded_count': uploaded_count,
                'training_response': training_response
            }
            
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise

@celery_app.task(bind=True)
def train_hf_model_task(self, category_id, annotated_documents):
    """Background task for training HF models"""
    try:
        from models import db, Category, DocumentSample
        from hf_ocr import hf_ocr
        from app import app
        
        with app.app_context():
            # Update task status
            self.update_state(state='PROGRESS', meta={'current': 0, 'total': len(annotated_documents)})
            
            category = Category.query.get(category_id)
            if not category:
                raise Exception('Category not found')
            
            # Prepare training data
            training_data = []
            for i, doc_data in enumerate(annotated_documents):
                try:
                    document = DocumentSample.query.get(doc_data['id'])
                    if document and document.annotations:
                        annotations = [annotation.to_dict() for annotation in document.annotations]
                        training_data.append({
                            'image_path': document.file_path,
                            'annotations': annotations
                        })
                        document.is_trained = True
                        
                        # Update progress
                        self.update_state(
                            state='PROGRESS',
                            meta={'current': i + 1, 'total': len(annotated_documents), 'prepared': len(training_data)}
                        )
                        
                except Exception as e:
                    print(f"Error preparing document {doc_data.get('filename', 'unknown')}: {e}")
                    continue
            
            if not training_data:
                raise Exception('No training data prepared')
            
            # Start training
            training_response = hf_ocr.train_model(training_data)
            
            # Generate model ID
            if not category.model_id:
                category.model_id = f"hf_{category.name}_{len(training_data)}_samples"
            
            db.session.commit()
            
            return {
                'status': 'completed',
                'message': f'HF training started successfully with {len(training_data)} documents',
                'model_id': category.model_id,
                'training_data_count': len(training_data),
                'training_response': training_response
            }
            
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise

@celery_app.task(bind=True)
def batch_inference_task(self, document_ids, category_id):
    """Background task for batch inference"""
    try:
        from models import db, Category, DocumentSample, ExtractedResult
        from nanonets_api import nanonets_api
        from hf_ocr import hf_ocr
        from app import app
        
        with app.app_context():
            self.update_state(state='PROGRESS', meta={'current': 0, 'total': len(document_ids)})
            
            category = Category.query.get(category_id)
            if not category or not category.model_id:
                raise Exception('Category or model not found')
            
            results = []
            
            for i, document_id in enumerate(document_ids):
                try:
                    document = DocumentSample.query.get(document_id)
                    if not document or not os.path.exists(document.file_path):
                        continue
                    
                    extracted_data = []
                    
                    if category.model_type == 'cloud':
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
                    
                    elif category.model_type == 'hf':
                        # Get field definitions
                        sample_docs = DocumentSample.query.filter_by(category_id=category_id).limit(1).all()
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
                    
                    results.append({
                        'document_id': document_id,
                        'extracted_data': extracted_data
                    })
                    
                    # Update progress
                    self.update_state(
                        state='PROGRESS',
                        meta={'current': i + 1, 'total': len(document_ids), 'processed': len(results)}
                    )
                    
                except Exception as e:
                    print(f"Error processing document {document_id}: {e}")
                    continue
            
            db.session.commit()
            
            return {
                'status': 'completed',
                'message': f'Batch inference completed for {len(results)} documents',
                'results': results,
                'total_processed': len(results)
            }
            
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise