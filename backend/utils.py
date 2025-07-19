import os
from PIL import Image
import uuid
from typing import List, Tuple
from werkzeug.utils import secure_filename

def convert_pdf_to_images(pdf_path: str, output_dir: str) -> List[str]:
    """
    Convert PDF to images
    Returns list of image file paths
    """
    try:
        # Try to import pdf2image
        try:
            from pdf2image import convert_from_path
        except ImportError:
            raise Exception("pdf2image not installed. Please install with: pip install pdf2image")
        
        # Convert PDF to images
        images = convert_from_path(pdf_path)
        image_paths = []
        
        base_filename = os.path.splitext(os.path.basename(pdf_path))[0]
        
        for i, image in enumerate(images):
            # Generate unique filename for each page
            image_filename = f"{base_filename}_page_{i+1}_{uuid.uuid4().hex[:8]}.png"
            image_path = os.path.join(output_dir, image_filename)
            
            # Save image
            image.save(image_path, 'PNG')
            image_paths.append(image_path)
        
        return image_paths
        
    except Exception as e:
        raise Exception(f"Error converting PDF to images: {e}")

def preprocess_image(image_path: str, output_path: str = None) -> str:
    """
    Preprocess image for better OCR results
    """
    try:
        image = Image.open(image_path)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Basic preprocessing
        # You can add more sophisticated preprocessing here
        # such as noise reduction, contrast enhancement, etc.
        
        if output_path is None:
            # Generate output path
            base, ext = os.path.splitext(image_path)
            output_path = f"{base}_processed{ext}"
        
        image.save(output_path)
        return output_path
        
    except Exception as e:
        raise Exception(f"Error preprocessing image: {e}")

def validate_file_type(filename: str, allowed_extensions: set) -> bool:
    """
    Validate if file type is allowed
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def generate_unique_filename(original_filename: str) -> str:
    """
    Generate unique filename while preserving extension
    """
    filename = secure_filename(original_filename)
    name, ext = os.path.splitext(filename)
    unique_name = f"{uuid.uuid4().hex}_{name}{ext}"
    return unique_name

def get_file_info(file_path: str) -> dict:
    """
    Get file information
    """
    try:
        stat = os.stat(file_path)
        return {
            'size': stat.st_size,
            'created': stat.st_ctime,
            'modified': stat.st_mtime,
            'extension': os.path.splitext(file_path)[1].lower()
        }
    except Exception as e:
        return {'error': str(e)}

def cleanup_temp_files(file_paths: List[str]) -> None:
    """
    Clean up temporary files
    """
    for file_path in file_paths:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not delete temp file {file_path}: {e}")

def create_annotation_from_bbox(bbox: dict, field_name: str) -> dict:
    """
    Create annotation dictionary from bounding box
    """
    return {
        'field_name': field_name,
        'x': bbox.get('x', 0),
        'y': bbox.get('y', 0),
        'w': bbox.get('w', 0),
        'h': bbox.get('h', 0)
    }

def normalize_coordinates(x: float, y: float, w: float, h: float, 
                         image_width: int, image_height: int) -> Tuple[float, float, float, float]:
    """
    Normalize coordinates to 0-1 range
    """
    norm_x = x / image_width
    norm_y = y / image_height
    norm_w = w / image_width
    norm_h = h / image_height
    
    return norm_x, norm_y, norm_w, norm_h

def denormalize_coordinates(norm_x: float, norm_y: float, norm_w: float, norm_h: float,
                           image_width: int, image_height: int) -> Tuple[int, int, int, int]:
    """
    Convert normalized coordinates back to pixel coordinates
    """
    x = int(norm_x * image_width)
    y = int(norm_y * image_height)
    w = int(norm_w * image_width)
    h = int(norm_h * image_height)
    
    return x, y, w, h