# 🚀 OCR Document Automation System

A comprehensive OCR automation system that allows you to train custom models using both **Nanonets Cloud** and **Hugging Face Local** models, then use them to extract structured data from documents at scale.

## ✨ Features

### 🎯 **Core Functionality**
- **Multi-Model Support**: Train and use both Cloud (Nanonets) and Local (Hugging Face) OCR models
- **Document Upload**: Support for multiple file formats (PNG, JPG, PDF, TIFF, BMP)
- **Interactive Annotation**: User-friendly annotation interface with drag-and-drop bounding boxes
- **Batch Processing**: Process multiple documents simultaneously
- **Data Extraction**: Extract structured data with confidence scores
- **Results Management**: View, edit, and export extraction results

### 🛠️ **Enhanced User Experience**
- **Modern UI**: Clean, responsive design with left sidebar navigation
- **Real-time Feedback**: Progress indicators and status updates
- **Annotation Editing**: Edit existing annotations with double-click
- **Training Workflow**: Clear step-by-step training process
- **Error Handling**: Comprehensive error messages and validation

### 📊 **Analytics & Monitoring**
- **Training Statistics**: Track annotation progress and model readiness
- **Confidence Scores**: Monitor extraction accuracy
- **Model Status**: Check training progress and model health
- **Export Options**: JSON export for integration with other systems

## 🏗️ Architecture

```
├── backend/                 # Flask API Server
│   ├── app.py              # Main application
│   ├── models.py           # Database models
│   ├── routes/             # API endpoints
│   │   ├── training.py     # Training workflow
│   │   └── inference.py    # Document processing
│   ├── nanonets_api.py     # Nanonets integration
│   └── hf_ocr.py          # Hugging Face integration
├── frontend/               # React UI
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Main application pages
│   │   └── styles/         # CSS and styling
└─��� uploads/               # Document storage
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **MySQL** (optional, SQLite fallback)
- **Nanonets API Key** (for cloud models)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 2. Environment Configuration

Create `.env` file in the backend directory:

```env
# Database Configuration
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=ocr_automation

# Nanonets Configuration
NANONETS_API_KEY=your_nanonets_api_key

# Hugging Face Configuration (optional)
HF_API_TOKEN=your_huggingface_token
```

### 3. Database Setup

```bash
# Initialize database
python app.py
# Database tables will be created automatically
```

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/health

## 📋 Complete Testing Guide

### Phase 1: Initial Setup Verification

#### ✅ **Step 1: Verify Installation**
1. Open browser to `http://localhost:3000`
2. Confirm the modern UI loads with left sidebar navigation
3. Check all navigation items are clickable
4. Verify no console errors in browser developer tools

#### ✅ **Step 2: API Health Check**
1. Visit `http://localhost:5000/health`
2. Should return: `{"status": "healthy", "timestamp": "..."}`
3. Check `http://localhost:5000/categories` returns empty array initially

### Phase 2: Document Upload & Annotation Workflow

#### ✅ **Step 3: Create Document Category**
1. Navigate to **"Upload Training"** page
2. In "Create New Category" section:
   - Enter category name: `"Invoices"`
   - Select model type: `"Cloud (Nanonets)"` or `"Local (Hugging Face)"`
   - Click **"Create Category"**
3. Verify success message appears
4. Confirm category appears in dropdown

#### ✅ **Step 4: Upload Training Documents**
1. Select the created category from dropdown
2. Drag and drop 5-10 sample documents (invoices, receipts, etc.)
3. Verify upload progress and success messages
4. Check documents appear in the grid below
5. Confirm document previews load correctly

#### ✅ **Step 5: Annotate Documents**
1. Click **"Annotate"** button on any uploaded document
2. **Annotation Interface Testing**:
   - Verify image loads in canvas
   - Draw bounding boxes around text fields (drag to create rectangles)
   - Select field types from dropdown (total_amount, date, vendor_name, etc.)
   - Test **double-click to edit** existing annotations
   - Use zoom controls (Zoom In, Zoom Out, Reset)
   - Verify annotation list shows all created annotations
3. Click **"Save Annotations"**
4. Confirm success message and annotation count updates

#### ✅ **Step 6: Annotation Management**
1. **Edit Existing Annotations**:
   - Double-click any annotation rectangle
   - Change field name in dialog
   - Verify changes are saved
2. **Delete Annotations**:
   - Use delete button in annotations list
   - Confirm annotation is removed from canvas
3. **Clear All Annotations**:
   - Test "Clear All" button
   - Confirm confirmation dialog appears

### Phase 3: Model Training Workflow

#### ✅ **Step 7: Navigate to Train Model Page**
1. Go to **"Train Model"** page
2. Verify training statistics show correct counts
3. Select the category with annotated documents
4. Confirm documents load with annotation status

#### ✅ **Step 8: Training Readiness Check**
1. Verify training status shows:
   - ✅ "Ready to train" if 3+ documents annotated
   - ⏳ "Need more annotations" if less than 3
2. If not ready, click **"Add Annotations"** on documents
3. Complete annotation process until ready

#### ✅ **Step 9: Start Model Training**
1. Click **"Start Training"** button
2. Verify training progress appears:
   - Progress bar animation
   - Status updates (Starting → Training → Completed)
   - Model ID generation
3. Wait for training completion (simulated 5 seconds)
4. Confirm success message and model ID

#### ✅ **Step 10: Model Status Verification**
1. Click **"Check Model Status"** button
2. Verify API call succeeds (may show placeholder data)
3. Confirm model appears as "Trained" in category dropdown

### Phase 4: Document Processing & Inference

#### ✅ **Step 11: Document Inference**
1. Navigate to **"Inference"** page
2. Select trained model from dropdown
3. Verify model information displays correctly
4. Upload a test document (same type as training data)

#### ✅ **Step 12: Results Processing**
1. Verify processing stats appear:
   - Fields extracted count
   - High confidence fields
   - Average confidence percentage
2. Check extracted data grid:
   - Field names match training annotations
   - Confidence scores display
   - Values are editable
3. Test result editing:
   - Modify extracted values
   - Click **"Update"** for individual fields
   - Use **"Save All Changes"** for batch updates

#### ✅ **Step 13: Results Export**
1. Click **"Export JSON"** button
2. Verify file downloads with extracted data
3. Check JSON structure contains all fields and metadata

### Phase 5: Results Management

#### ✅ **Step 14: View Results History**
1. Navigate to **"Results"** page
2. Verify processed documents appear in left panel
3. Click on any document to view extracted data
4. Test filtering by category
5. Verify export functionality for individual and all results

#### ✅ **Step 15: Data Management**
1. **Edit Results**:
   - Click "Edit" on any extracted field
   - Modify value and save
   - Verify changes persist
2. **Delete Results**:
   - Test delete functionality
   - Confirm deletion dialogs
3. **Bulk Export**:
   - Use "Export All" feature
   - Verify comprehensive JSON export

### Phase 6: Advanced Features Testing

#### ✅ **Step 16: Multiple Categories**
1. Create additional categories with different model types
2. Upload different document types (receipts, contracts, etc.)
3. Train multiple models
4. Test switching between models for inference

#### ✅ **Step 17: Error Handling**
1. **Upload Invalid Files**:
   - Try unsupported formats
   - Verify error messages
2. **Training Without Annotations**:
   - Attempt training with no annotations
   - Confirm proper error handling
3. **API Error Simulation**:
   - Test with invalid model IDs
   - Verify graceful error handling

#### ✅ **Step 18: Performance Testing**
1. **Large File Upload**:
   - Upload files near 10MB limit
   - Verify handling and progress indication
2. **Batch Processing**:
   - Upload 20+ documents simultaneously
   - Test annotation workflow efficiency
3. **Multiple Concurrent Users**:
   - Open multiple browser tabs
   - Test simultaneous operations

### Phase 7: Integration Testing

#### ✅ **Step 19: API Integration**
1. **Direct API Testing**:
   ```bash
   # Test category creation
   curl -X POST http://localhost:5000/create-category \
     -H "Content-Type: application/json" \
     -d '{"name": "API_Test", "model_type": "cloud"}'
   
   # Test document upload
   curl -X POST http://localhost:5000/upload-documents \
     -F "category_id=1" \
     -F "files=@sample_document.pdf"
   ```

#### ✅ **Step 20: Database Verification**
1. Check database tables contain expected data:
   - Categories with correct model types
   - Documents with file paths
   - Annotations with coordinates
   - Extracted results with confidence scores

## 🔧 Configuration Options

### Model Types

#### **Cloud Models (Nanonets)**
- **Pros**: High accuracy, no local compute required, enterprise-grade
- **Cons**: Requires API key, usage costs, internet dependency
- **Best for**: Production environments, high-volume processing

#### **Local Models (Hugging Face)**
- **Pros**: No API costs, data privacy, offline capability
- **Cons**: Requires local compute, setup complexity
- **Best for**: Development, sensitive data, cost optimization

### Supported File Formats
- **Images**: PNG, JPG, JPEG, TIFF, BMP, GIF
- **Documents**: PDF (first page extracted)
- **Size Limit**: 10MB per file
- **Batch Upload**: Up to 50 files simultaneously

### Field Types
Pre-configured field types for annotation:
- `total_amount`, `subtotal`, `tax_amount`, `discount`
- `date`, `due_date`, `invoice_number`
- `vendor_name`, `customer_name`, `address`
- `phone`, `email`, `payment_terms`
- `item_description`, `quantity`, `unit_price`

## 🚨 Troubleshooting

### Common Issues

#### **Frontend Won't Start**
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
npm start
```

#### **Backend Database Errors**
```bash
# Reset database
rm backend/database.db  # If using SQLite
python backend/app.py   # Recreate tables
```

#### **Upload Failures**
- Check file size (max 10MB)
- Verify file format is supported
- Ensure upload directory has write permissions

#### **Training Failures**
- Verify at least 3 documents are annotated
- Check Nanonets API key is valid
- Ensure annotations have proper field names

#### **Annotation Interface Issues**
- Refresh page if canvas doesn't load
- Check browser console for JavaScript errors
- Verify image URLs are accessible

### Performance Optimization

#### **Large File Handling**
```python
# Increase upload limits in app.py
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB
```

#### **Database Performance**
```sql
-- Add indexes for better query performance
CREATE INDEX idx_documents_category ON document_samples(category_id);
CREATE INDEX idx_annotations_document ON annotations(document_id);
```

## 🔒 Security Considerations

### Data Protection
- Files stored locally in `uploads/` directory
- Database credentials in environment variables
- API keys secured in `.env` file
- Input validation on all endpoints

### Production Deployment
- Use HTTPS for all communications
- Implement authentication and authorization
- Regular security updates
- Database backup strategy
- File storage encryption

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Standards
- **Python**: Follow PEP 8, use type hints
- **JavaScript**: Use ESLint, Prettier formatting
- **CSS**: Follow BEM methodology
- **Git**: Conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check this README first
- **Issues**: Open GitHub issue with detailed description
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact support team for enterprise inquiries

### Reporting Bugs
Include the following information:
- Operating system and version
- Python and Node.js versions
- Steps to reproduce the issue
- Error messages and logs
- Screenshots if applicable

---

## 🎉 Success Criteria

After completing all testing phases, you should have:

✅ **Functional System**
- Categories created and managed
- Documents uploaded and annotated
- Models trained successfully
- Data extracted with confidence scores
- Results exported and managed

✅ **User Experience**
- Intuitive navigation and workflow
- Clear feedback and error messages
- Responsive design across devices
- Efficient annotation interface

✅ **Technical Integration**
- Backend APIs working correctly
- Database operations successful
- File upload and storage functional
- Model training and inference operational

**🚀 Your OCR automation system is now ready for production use!**