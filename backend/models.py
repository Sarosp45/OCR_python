from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Category(db.Model):
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
    model_id = db.Column(db.String(100), nullable=True)
    model_type = db.Column(db.Enum('cloud', 'hf', name='model_type_enum'), default='cloud', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    documents = db.relationship('DocumentSample', backref='category', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'model_id': self.model_id,
            'model_type': self.model_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DocumentSample(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    is_trained = db.Column(db.Boolean, default=False, index=True)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    annotations = db.relationship('Annotation', backref='document', lazy=True, cascade='all, delete-orphan')
    extracted_results = db.relationship('ExtractedResult', backref='document', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'category_id': self.category_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_path': self.file_path,
            'is_trained': self.is_trained,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'annotations': [annotation.to_dict() for annotation in self.annotations]
        }

class Annotation(db.Model):
    __tablename__ = 'annotations'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    field_name = db.Column(db.String(100), nullable=False, index=True)
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    w = db.Column(db.Float, nullable=False)  # width renamed to w as per requirements
    h = db.Column(db.Float, nullable=False)  # height renamed to h as per requirements
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'field_name': self.field_name,
            'x': self.x,
            'y': self.y,
            'w': self.w,
            'h': self.h,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ExtractedResult(db.Model):
    __tablename__ = 'results'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    field_name = db.Column(db.String(100), nullable=False, index=True)
    value = db.Column(db.Text, nullable=True)
    confidence = db.Column(db.Float, nullable=True)
    extracted_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'field_name': self.field_name,
            'value': self.value,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None
        } 