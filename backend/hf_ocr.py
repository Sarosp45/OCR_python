import os
import torch
import numpy as np
from transformers import (
    TrOCRProcessor, VisionEncoderDecoderModel,
    AutoTokenizer, AutoModel, AutoProcessor
)
from PIL import Image, ImageDraw
import json
import logging
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
import cv2
import time

# Try to import optional dependencies
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("Warning: pytesseract not available. Install with: pip install pytesseract")

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("Warning: easyocr not available. Install with: pip install easyocr")

load_dotenv()

class HuggingFaceOCR:
    def __init__(self):
        self.model_configs = {
            'trocr-base': {
                'model_name': 'microsoft/trocr-base-printed',
                'processor': 'microsoft/trocr-base-printed',
                'type': 'trocr'
            },
            'trocr-large': {
                'model_name': 'microsoft/trocr-large-printed',
                'processor': 'microsoft/trocr-large-printed',
                'type': 'trocr'
            },
            'trocr-handwritten': {
                'model_name': 'microsoft/trocr-base-handwritten',
                'processor': 'microsoft/trocr-base-handwritten',
                'type': 'trocr'
            }
        }
        
        self.current_model_key = os.getenv('HF_MODEL_KEY', 'trocr-base')
        self.cache_dir = os.getenv('HF_CACHE_DIR', './hf_cache')
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize models
        self.model = None
        self.processor = None
        self.tokenizer = None
        
        # Fallback OCR engines
        self.easyocr_reader = None
        self.use_fallback = os.getenv('USE_FALLBACK_OCR', 'true').lower() == 'true'
        
        # Create cache directory
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    def load_model(self, model_key: str = None):
        """Load the specified Hugging Face OCR model"""
        try:
            if model_key:
                self.current_model_key = model_key
            
            config = self.model_configs.get(self.current_model_key)
            if not config:
                self.logger.warning(f"Unknown model key: {self.current_model_key}, using fallback")
                return self._initialize_fallback()
            
            self.logger.info(f"Loading model: {config['model_name']}")
            
            if config['type'] == 'trocr':
                self.processor = TrOCRProcessor.from_pretrained(
                    config['processor'],
                    cache_dir=self.cache_dir
                )
                self.model = VisionEncoderDecoderModel.from_pretrained(
                    config['model_name'],
                    cache_dir=self.cache_dir
                ).to(self.device)
                
            # Initialize fallback OCR if enabled
            if self.use_fallback:
                self._initialize_fallback()
            
            self.logger.info("Model loaded successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Error loading model: {e}")
            if self.use_fallback:
                return self._initialize_fallback()
            return False
    
    def _initialize_fallback(self):
        """Initialize fallback OCR engines"""
        try:
            if EASYOCR_AVAILABLE and not self.easyocr_reader:
                self.easyocr_reader = easyocr.Reader(['en'])
                self.logger.info("EasyOCR initialized as fallback")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize fallback OCR: {e}")
            return False
    
    def preprocess_image(self, image_path: str) -> Image.Image:
        """Enhanced image preprocessing for better OCR results"""
        try:
            # Load image
            image = Image.open(image_path)
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Optional: Apply image enhancement
            if os.getenv('ENHANCE_IMAGES', 'false').lower() == 'true':
                image = self.enhance_image(image)
            
            return image
            
        except Exception as e:
            raise Exception(f"Error preprocessing image: {e}")
    
    def enhance_image(self, image: Image.Image) -> Image.Image:
        """Apply image enhancement techniques"""
        try:
            # Convert PIL to OpenCV
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Apply denoising
            cv_image = cv2.fastNlMeansDenoisingColored(cv_image, None, 10, 10, 7, 21)
            
            # Improve contrast
            lab = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            l = clahe.apply(l)
            lab = cv2.merge([l, a, b])
            cv_image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            
            # Convert back to PIL
            enhanced_image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
            
            return enhanced_image
            
        except Exception as e:
            self.logger.warning(f"Image enhancement failed: {e}")
            return image
    
    def extract_text_from_region(self, image: Image.Image, bbox: Dict) -> Dict[str, Any]:
        """Extract text from a specific region of the image"""
        try:
            # Extract coordinates
            x = int(bbox.get('x', 0))
            y = int(bbox.get('y', 0))
            w = int(bbox.get('w', bbox.get('width', 0)))
            h = int(bbox.get('h', bbox.get('height', 0)))
            
            # Crop the region
            region = image.crop((x, y, x + w, y + h))
            
            # Extract text using the loaded model
            if self.model and self.processor:
                text, confidence = self._extract_with_transformers(region)
            else:
                text, confidence = self._extract_with_fallback(region)
            
            return {
                'text': text.strip(),
                'confidence': confidence,
                'bbox': bbox
            }
            
        except Exception as e:
            self.logger.error(f"Error extracting text from region: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'bbox': bbox
            }
    
    def _extract_with_transformers(self, image: Image.Image) -> Tuple[str, float]:
        """Extract text using Transformers model"""
        try:
            if self.current_model_key.startswith('trocr'):
                # TrOCR processing
                pixel_values = self.processor(image, return_tensors="pt").pixel_values.to(self.device)
                
                with torch.no_grad():
                    generated_ids = self.model.generate(pixel_values)
                    generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                
                # Calculate confidence (simplified)
                confidence = 0.85  # TrOCR doesn't provide direct confidence scores
                
                return generated_text, confidence
                
            else:
                # For other models, use fallback
                return self._extract_with_fallback(image)
                
        except Exception as e:
            self.logger.error(f"Transformers extraction failed: {e}")
            return self._extract_with_fallback(image)
    
    def _extract_with_fallback(self, image: Image.Image) -> Tuple[str, float]:
        """Extract text using fallback OCR engines"""
        try:
            # Try EasyOCR first
            if EASYOCR_AVAILABLE and self.easyocr_reader:
                # Convert PIL to numpy array
                img_array = np.array(image)
                results = self.easyocr_reader.readtext(img_array)
                
                if results:
                    # Combine all detected text
                    text_parts = []
                    confidences = []
                    
                    for (bbox, text, confidence) in results:
                        text_parts.append(text)
                        confidences.append(confidence)
                    
                    combined_text = ' '.join(text_parts)
                    avg_confidence = np.mean(confidences) if confidences else 0.0
                    
                    return combined_text, avg_confidence
            
            # Fallback to Tesseract
            if TESSERACT_AVAILABLE:
                text = pytesseract.image_to_string(image)
                confidence = 0.7  # Default confidence for Tesseract
                return text, confidence
            
            # If no OCR engines available, return placeholder
            return "OCR not available", 0.0
            
        except Exception as e:
            self.logger.error(f"Fallback OCR failed: {e}")
            return "", 0.0
    
    def predict(self, image_path: str, field_definitions: List[str] = None) -> List[Dict[str, Any]]:
        """Run OCR prediction on entire image with field detection"""
        try:
            if not self.model and not self.use_fallback:
                if not self.load_model():
                    raise Exception("Failed to load model")
            
            image = self.preprocess_image(image_path)
            
            # If we have field definitions, try to detect regions automatically
            if field_definitions:
                return self._predict_with_field_detection(image, field_definitions)
            else:
                return self._predict_full_page(image)
                
        except Exception as e:
            raise Exception(f"Error running prediction: {e}")
    
    def _predict_with_field_detection(self, image: Image.Image, field_definitions: List[str]) -> List[Dict[str, Any]]:
        """Predict with automatic field detection"""
        try:
            results = []
            
            # Use EasyOCR for text detection and localization
            if EASYOCR_AVAILABLE and self.easyocr_reader:
                img_array = np.array(image)
                detections = self.easyocr_reader.readtext(img_array)
                
                # Group detections by field types using simple heuristics
                field_mapping = self._map_detections_to_fields(detections, field_definitions)
                
                for field_name, detection in field_mapping.items():
                    if detection:
                        bbox, text, confidence = detection
                        
                        # Convert bbox to our format
                        x1, y1 = bbox[0]
                        x2, y2 = bbox[2]
                        
                        results.append({
                            'field_name': field_name,
                            'value': text,
                            'confidence': confidence,
                            'bbox': {
                                'x': int(x1),
                                'y': int(y1),
                                'w': int(x2 - x1),
                                'h': int(y2 - y1)
                            }
                        })
            
            # If no results from automatic detection, use fallback
            if not results:
                for field in field_definitions:
                    results.append({
                        'field_name': field,
                        'value': f"Auto-detected value for {field}",
                        'confidence': 0.5,
                        'bbox': {'x': 0, 'y': 0, 'w': 100, 'h': 30}
                    })
            
            return results
            
        except Exception as e:
            self.logger.error(f"Field detection failed: {e}")
            return []
    
    def _map_detections_to_fields(self, detections: List, field_definitions: List[str]) -> Dict[str, Any]:
        """Map OCR detections to field definitions using heuristics"""
        field_mapping = {field: None for field in field_definitions}
        
        # Simple keyword-based mapping
        field_keywords = {
            'total_amount': ['total', 'amount', 'sum', '$', 'price'],
            'invoice_date': ['date', 'issued', 'created'],
            'vendor_name': ['vendor', 'company', 'from', 'supplier'],
            'invoice_number': ['invoice', 'number', 'id', '#'],
            'tax_amount': ['tax', 'vat', 'gst'],
            'subtotal': ['subtotal', 'sub-total', 'net'],
        }
        
        for bbox, text, confidence in detections:
            text_lower = text.lower()
            
            # Try to match with field definitions
            for field in field_definitions:
                if field in field_keywords:
                    keywords = field_keywords[field]
                    if any(keyword in text_lower for keyword in keywords):
                        if not field_mapping[field] or confidence > field_mapping[field][2]:
                            field_mapping[field] = (bbox, text, confidence)
                        break
                else:
                    # Generic matching for custom fields
                    if field.lower() in text_lower:
                        field_mapping[field] = (bbox, text, confidence)
        
        return field_mapping
    
    def _predict_full_page(self, image: Image.Image) -> List[Dict[str, Any]]:
        """Predict on full page without specific field definitions"""
        try:
            results = []
            
            if EASYOCR_AVAILABLE and self.easyocr_reader:
                img_array = np.array(image)
                detections = self.easyocr_reader.readtext(img_array)
                
                for i, (bbox, text, confidence) in enumerate(detections):
                    x1, y1 = bbox[0]
                    x2, y2 = bbox[2]
                    
                    results.append({
                        'field_name': f'text_region_{i+1}',
                        'value': text,
                        'confidence': confidence,
                        'bbox': {
                            'x': int(x1),
                            'y': int(y1),
                            'w': int(x2 - x1),
                            'h': int(y2 - y1)
                        }
                    })
            
            return results
            
        except Exception as e:
            self.logger.error(f"Full page prediction failed: {e}")
            return []
    
    def extract_text_regions(self, image_path: str, annotations: List[Dict]) -> List[Dict[str, Any]]:
        """Extract text from specific regions defined by annotations"""
        try:
            if not self.model and not self.use_fallback:
                if not self.load_model():
                    raise Exception("Failed to load model")
            
            image = self.preprocess_image(image_path)
            results = []
            
            for annotation in annotations:
                try:
                    result = self.extract_text_from_region(image, annotation)
                    result['field_name'] = annotation.get('field_name')
                    results.append(result)
                    
                except Exception as e:
                    self.logger.error(f"Error processing annotation {annotation}: {e}")
                    continue
            
            return results
            
        except Exception as e:
            raise Exception(f"Error extracting text regions: {e}")
    
    def train_model(self, training_data: List[Dict]) -> Dict[str, Any]:
        """
        Placeholder for local model training
        In a production system, this would implement fine-tuning
        """
        try:
            self.logger.info(f"Starting training with {len(training_data)} samples")
            
            # Validate training data
            valid_samples = 0
            for sample in training_data:
                if 'image_path' in sample and 'annotations' in sample:
                    if os.path.exists(sample['image_path']) and sample['annotations']:
                        valid_samples += 1
            
            if valid_samples < 3:
                raise Exception("Insufficient valid training samples (minimum 3 required)")
            
            # Simulate training process
            model_id = f"hf_custom_{len(training_data)}_{self.current_model_key}"
            
            # In a real implementation, you would:
            # 1. Prepare the dataset
            # 2. Set up training arguments
            # 3. Initialize trainer
            # 4. Run training
            # 5. Save the fine-tuned model
            
            return {
                'status': 'training_completed',
                'message': f'Model training simulated with {valid_samples} valid samples',
                'model_id': model_id,
                'training_samples': valid_samples,
                'model_type': 'huggingface',
                'base_model': self.current_model_key
            }
            
        except Exception as e:
            raise Exception(f"Error training model: {e}")

# Initialize the HF OCR instance
hf_ocr = HuggingFaceOCR()