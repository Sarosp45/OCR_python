import requests
import os
import json
import time
from typing import List, Dict, Any, Optional, Union
from dotenv import load_dotenv
import logging

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NanonetsAPIError(Exception):
    """Custom exception for Nanonets API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data

class NanonetsAPI:
    def __init__(self):
        self.api_key = os.getenv('NANONETS_API_KEY')
        self.base_url = "https://app.nanonets.com/api/v2"
        self.session = requests.Session()

        if not self.api_key:
            raise ValueError("NANONETS_API_KEY not found in environment variables")

        # Set default headers
        self.session.auth = (self.api_key, '')
        self.session.headers.update({
            'User-Agent': 'OCR-Automation-System/1.0'
        })

        logger.info("🔧 Nanonets API initialized successfully")
    
    def _handle_response(self, response: requests.Response, operation: str) -> Dict[str, Any]:
        """Handle API response with proper error handling"""
        try:
            response_data = response.json() if response.content else {}
        except json.JSONDecodeError:
            response_data = {"raw_response": response.text}

        if response.status_code == 200:
            logger.info(f"✅ {operation} successful")
            return response_data
        elif response.status_code == 429:
            logger.warning(f"⚠️ Rate limit exceeded for {operation}")
            raise NanonetsAPIError(
                f"Rate limit exceeded. Please wait before retrying.",
                status_code=response.status_code,
                response_data=response_data
            )
        elif response.status_code == 401:
            logger.error(f"❌ Authentication failed for {operation}")
            raise NanonetsAPIError(
                f"Authentication failed. Please check your API key.",
                status_code=response.status_code,
                response_data=response_data
            )
        else:
            logger.error(f"❌ {operation} failed: {response.status_code} - {response.text}")
            raise NanonetsAPIError(
                f"Failed to {operation}: {response.status_code} - {response.text}",
                status_code=response.status_code,
                response_data=response_data
            )

    def create_model(self, model_name: str, model_type: str = "ocr") -> Dict[str, Any]:
        """Create a new Nanonets model"""
        logger.info(f"🔨 Creating new model: {model_name}")
        url = f"{self.base_url}/OCR/Model/"
        data = {
            'model_name': model_name,
            'model_type': model_type
        }

        try:
            response = self.session.post(url, json=data)
            return self._handle_response(response, f"create model '{model_name}'")
        except requests.RequestException as e:
            logger.error(f"❌ Network error creating model: {e}")
            raise NanonetsAPIError(f"Network error creating model: {e}")
    
    def upload_training_data(self, model_id: str, file_path: str, annotations: List[Dict]) -> Dict[str, Any]:
        """
        Upload training data to Nanonets model with enhanced error handling.
        Each annotation must have: field_name (str), x, y, w, h (coordinates).
        """
        logger.info(f"📤 Uploading training data for model {model_id}: {file_path}")

        if not os.path.exists(file_path):
            raise NanonetsAPIError(f"File not found: {file_path}")

        url = f"{self.base_url}/OCR/Model/{model_id}/UploadFile/"

        try:
            # Validate and convert annotations to Nanonets format
            annotation_data = self._convert_annotations_to_nanonets_format(annotations, model_id)

            if not annotation_data:
                raise NanonetsAPIError("No valid annotations to upload")

            # Prepare form data
            data = {
                'annotation': json.dumps(annotation_data)
            }

            logger.info(f"📋 Uploading {len(annotation_data)} annotations: {[ann['label'] for ann in annotation_data]}")

            # Upload file with annotations
            with open(file_path, 'rb') as file:
                files = {'file': file}
                response = self.session.post(url, files=files, data=data)

            return self._handle_response(response, f"upload training data for model {model_id}")

        except requests.RequestException as e:
            logger.error(f"❌ Network error uploading training data: {e}")
            raise NanonetsAPIError(f"Network error uploading training data: {e}")
        except Exception as e:
            logger.error(f"❌ Error uploading training data: {e}")
            raise NanonetsAPIError(f"Error uploading training data: {e}")

    def _convert_annotations_to_nanonets_format(self, annotations: List[Dict], model_id: str) -> List[Dict]:
        """Convert internal annotation format to Nanonets API format"""
        try:
            # Get allowed fields for validation
            allowed_fields = self.get_model_fields(model_id)
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch model fields for validation: {e}")
            allowed_fields = None

        annotation_data = []

        for i, annotation in enumerate(annotations):
            try:
                label = str(annotation.get('field_name', '')).strip()

                # Validate field name if we have allowed fields
                if allowed_fields and label not in allowed_fields:
                    logger.warning(f"⚠️ Skipping annotation {i}: Invalid label '{label}'. Allowed: {allowed_fields}")
                    continue

                # Extract coordinates - handle both 'w'/'h' and 'width'/'height' formats
                x = float(annotation.get('x', 0))
                y = float(annotation.get('y', 0))
                width = float(annotation.get('w', annotation.get('width', 0)))
                height = float(annotation.get('h', annotation.get('height', 0)))

                # Convert to Nanonets format (xmin, ymin, xmax, ymax)
                xmin = int(round(x))
                ymin = int(round(y))
                xmax = int(round(x + width))
                ymax = int(round(y + height))

                # Validate coordinates
                if xmin >= xmax or ymin >= ymax:
                    logger.warning(f"⚠️ Skipping annotation {i}: Invalid coordinates ({xmin},{ymin},{xmax},{ymax})")
                    continue

                annotation_data.append({
                    "label": label,
                    "xmin": xmin,
                    "ymin": ymin,
                    "xmax": xmax,
                    "ymax": ymax
                })

            except (ValueError, TypeError) as e:
                logger.warning(f"⚠️ Skipping annotation {i}: Invalid data format - {e}")
                continue

        logger.info(f"✅ Converted {len(annotation_data)}/{len(annotations)} annotations successfully")
        return annotation_data
    
    def train_model(self, model_id: str) -> Dict[str, Any]:
        """Start training the Nanonets model with enhanced monitoring"""
        logger.info(f"🚀 Starting training for model {model_id}")
        url = f"{self.base_url}/OCR/Model/{model_id}/Train/"

        try:
            response = self.session.post(url)
            result = self._handle_response(response, f"train model {model_id}")

            # Log training initiation details
            if 'message' in result:
                logger.info(f"📈 Training initiated: {result['message']}")

            return result

        except requests.RequestException as e:
            logger.error(f"❌ Network error training model: {e}")
            raise NanonetsAPIError(f"Network error training model: {e}")

    def get_model_status(self, model_id: str) -> Dict[str, Any]:
        """Get the status of a Nanonets model with detailed information"""
        logger.info(f"📊 Checking status for model {model_id}")
        url = f"{self.base_url}/OCR/Model/{model_id}/"

        try:
            response = self.session.get(url)
            result = self._handle_response(response, f"get model {model_id} status")

            # Log model status details
            if 'result' in result and 'state' in result['result']:
                state = result['result']['state']
                logger.info(f"📈 Model {model_id} state: {state}")

                # Log additional details if available
                if 'accuracy' in result['result']:
                    accuracy = result['result']['accuracy']
                    logger.info(f"🎯 Model accuracy: {accuracy}%")

            return result

        except requests.RequestException as e:
            logger.error(f"❌ Network error getting model status: {e}")
            raise NanonetsAPIError(f"Network error getting model status: {e}")
    
    def predict(self, model_id: str, file_path: str, async_prediction: bool = False) -> Dict[str, Any]:
        """Run inference on a document using trained model"""
        if not os.path.exists(file_path):
            raise NanonetsAPIError(f"File not found: {file_path}")

        # Choose sync or async endpoint based on file size and user preference
        file_size = os.path.getsize(file_path)
        if async_prediction or file_size > 5 * 1024 * 1024:  # 5MB threshold
            endpoint = "LabelFileAsync"
            logger.info(f"🔄 Running async prediction for model {model_id}: {file_path}")
        else:
            endpoint = "LabelFile"
            logger.info(f"⚡ Running sync prediction for model {model_id}: {file_path}")

        url = f"{self.base_url}/OCR/Model/{model_id}/{endpoint}/"

        try:
            with open(file_path, 'rb') as file:
                files = {'file': file}
                response = self.session.post(url, files=files)

            result = self._handle_response(response, f"predict using model {model_id}")

            # Log prediction results summary
            if 'result' in result:
                predictions = result['result']
                if isinstance(predictions, list) and len(predictions) > 0:
                    logger.info(f"✅ Prediction completed: {len(predictions)} fields extracted")
                else:
                    logger.info("✅ Prediction completed: No fields extracted")

            return result

        except requests.RequestException as e:
            logger.error(f"❌ Network error during prediction: {e}")
            raise NanonetsAPIError(f"Network error during prediction: {e}")

    def get_all_models(self) -> List[Dict[str, Any]]:
        """Get all models for the account"""
        logger.info("📋 Fetching all models")
        url = f"{self.base_url}/OCR/Model/"

        try:
            response = self.session.get(url)
            result = self._handle_response(response, "get all models")

            if isinstance(result, list):
                logger.info(f"📊 Found {len(result)} models")

            return result

        except requests.RequestException as e:
            logger.error(f"❌ Network error getting models: {e}")
            raise NanonetsAPIError(f"Network error getting models: {e}")

    def get_model_fields(self, model_id: str) -> List[str]:
        """Get allowed fields/categories for a model"""
        logger.info(f"🏷️ Fetching fields for model {model_id}")
        url = f"{self.base_url}/OCR/Model/{model_id}"

        try:
            response = self.session.get(url)
            result = self._handle_response(response, f"get fields for model {model_id}")

            if 'result' in result and 'categories' in result['result']:
                fields = [cat['name'] for cat in result['result']['categories']]
                logger.info(f"🏷️ Model {model_id} has {len(fields)} fields: {fields}")
                return fields
            else:
                logger.warning(f"⚠️ No categories found for model {model_id}")
                return []

        except requests.RequestException as e:
            logger.error(f"❌ Network error getting model fields: {e}")
            raise NanonetsAPIError(f"Network error getting model fields: {e}")
        except Exception as e:
            logger.warning(f"⚠️ Could not parse model fields: {e}")
            return []

    def wait_for_training_completion(self, model_id: str, max_wait_time: int = 3600, check_interval: int = 60) -> Dict[str, Any]:
        """
        Wait for model training to complete with periodic status checks

        Args:
            model_id: The model ID to monitor
            max_wait_time: Maximum time to wait in seconds (default: 1 hour)
            check_interval: How often to check status in seconds (default: 1 minute)
        """
        logger.info(f"⏳ Waiting for training completion of model {model_id}")
        start_time = time.time()

        while time.time() - start_time < max_wait_time:
            try:
                status = self.get_model_status(model_id)

                if 'result' in status and 'state' in status['result']:
                    state = status['result']['state']

                    if state.lower() in ['trained', 'ready', 'completed']:
                        logger.info(f"🎉 Training completed for model {model_id}")
                        return status
                    elif state.lower() in ['failed', 'error']:
                        logger.error(f"❌ Training failed for model {model_id}")
                        raise NanonetsAPIError(f"Training failed for model {model_id}: {state}")
                    else:
                        elapsed = int(time.time() - start_time)
                        logger.info(f"⏳ Training in progress ({elapsed}s elapsed): {state}")

                time.sleep(check_interval)

            except NanonetsAPIError:
                raise
            except Exception as e:
                logger.warning(f"⚠️ Error checking training status: {e}")
                time.sleep(check_interval)

        logger.warning(f"⏰ Training timeout reached for model {model_id}")
        raise NanonetsAPIError(f"Training timeout reached for model {model_id}")

    def validate_api_connection(self) -> bool:
        """Validate API connection and credentials"""
        try:
            logger.info("🔍 Validating API connection...")
            models = self.get_all_models()
            logger.info("✅ API connection validated successfully")
            return True
        except Exception as e:
            logger.error(f"❌ API connection validation failed: {e}")
            return False

    def get_api_usage_info(self) -> Dict[str, Any]:
        """Get API usage information (if available)"""
        try:
            # This endpoint may not be available in all Nanonets plans
            url = f"{self.base_url}/usage/"
            response = self.session.get(url)
            return self._handle_response(response, "get API usage info")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch API usage info: {e}")
            return {"error": "Usage info not available"}

# Initialize the API instance with error handling
try:
    nanonets_api = NanonetsAPI()
    logger.info("🚀 Nanonets API instance created successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize Nanonets API: {e}")
    nanonets_api = None