# OCR Document Annotation System - Vanilla Frontend

A complete standalone frontend application built with vanilla HTML, CSS, and JavaScript for the OCR Document Annotation System. This frontend provides the same functionality as the React version but without any framework dependencies.

## 🚀 Features

### Core Functionality
- **Document Upload & Management**: Upload and organize training documents by categories
- **Advanced Annotation Tools**: Professional annotation interface with drawing tools
- **Model Training**: Train OCR models using annotated documents
- **Data Extraction**: Extract data from documents using trained models
- **Results Management**: View, export, and manage extraction results

### Annotation Tools
- **Rectangle Tool**: Draw rectangular bounding boxes
- **Polygon Tool**: Create complex polygon annotations (planned)
- **Selection Tool**: Select and manipulate existing annotations
- **Pan & Zoom**: Navigate large documents with smooth pan and zoom
- **Undo/Redo**: Full history management with keyboard shortcuts

### UI Features
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Mode Support**: Automatic dark mode based on system preferences
- **Keyboard Shortcuts**: Professional keyboard shortcuts for power users
- **Toast Notifications**: User-friendly feedback system
- **Modal Dialogs**: Clean modal system for forms and confirmations
- **Drag & Drop**: Intuitive file upload with drag and drop support

## 📁 Project Structure

```
vanilla-frontend/
├── index.html              # Main HTML file
├── css/                    # Stylesheets
│   ├── main.css           # Core styles and variables
│   ├── components.css     # UI component styles
│   ├── annotation.css     # Annotation interface styles
│   └── responsive.css     # Responsive design rules
├── js/                    # JavaScript modules
│   ├── config.js          # Application configuration
│   ├── api.js             # API service layer
│   ├── utils.js           # Utility functions
│   ├── app.js             # Main application controller
│   ├── components/        # Reusable components
│   │   ├── toast.js       # Toast notification system
│   │   ├── modal.js       # Modal dialog system
│   │   ├── canvas.js      # Canvas manipulation utilities
│   │   └── annotation-engine.js # Advanced annotation engine
│   └── pages/             # Page-specific managers
│       ├── upload.js      # Upload & training page
│       ├── annotate.js    # Annotation interface
│       ├── inference.js   # Data extraction page
│       └── results.js     # Results management page
├── assets/                # Static assets
│   └── favicon.ico        # Application icon
└── README.md              # This file
```

## 🛠️ Setup & Installation

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A web server (for local development)
- The OCR backend API running on `http://localhost:5000`

### Quick Start

1. **Clone or download** the vanilla-frontend directory

2. **Serve the files** using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8080
   
   # Using Node.js (http-server)
   npx http-server -p 8080
   
   # Using PHP
   php -S localhost:8080
   ```

3. **Open your browser** and navigate to `http://localhost:8080`

4. **Configure the backend URL** (if different from default):
   - Edit `js/config.js`
   - Update `API_BASE_URL` to match your backend server

### Production Deployment

1. **Upload files** to your web server
2. **Configure the API URL** in `js/config.js`
3. **Set up HTTPS** (recommended for production)
4. **Configure CORS** on your backend to allow your domain

## ⚙️ Configuration

### API Configuration
Edit `js/config.js` to configure the backend connection:

```javascript
const CONFIG = {
    API_BASE_URL: 'https://your-api-server.com/api',
    UPLOADS_BASE_URL: 'https://your-api-server.com/uploads',
    // ... other settings
};
```

### Feature Flags
Enable or disable features in the configuration:

```javascript
FEATURES: {
    AUTO_SAVE: true,
    KEYBOARD_SHORTCUTS: true,
    CONTEXT_MENU: true,
    DRAG_AND_DROP: true,
    // ... other features
}
```

### Customization
- **Colors**: Modify CSS custom properties in `css/main.css`
- **Field Types**: Update `ANNOTATION.FIELD_TYPES` in `js/config.js`
- **Keyboard Shortcuts**: Modify `SHORTCUTS` in `js/config.js`

## 🎯 Usage Guide

### 1. Upload & Training
1. Create a new category for your document type
2. Upload training documents to the category
3. Annotate documents using the annotation tools
4. Train the model when you have enough annotated documents

### 2. Document Annotation
1. Select a document from the training page
2. Use the toolbar to select annotation tools
3. Draw bounding boxes around text fields
4. Assign field types to each annotation
5. Save your annotations

### 3. Data Extraction
1. Go to the Extract page
2. Upload a document for processing
3. Select a trained model
4. Run extraction and review results
5. Export or save the extracted data

### 4. Results Management
1. View all extraction results on the Results page
2. Filter and search through results
3. Export individual results or bulk export
4. View detailed information for each result

## 🔧 API Integration

The frontend communicates with the backend through these main endpoints:

- `GET /health` - Check API health
- `GET /categories` - List document categories
- `POST /create-category` - Create new category
- `POST /upload-training` - Upload training documents
- `POST /save-annotations` - Save annotation data
- `POST /train-model/{category_id}` - Start model training
- `GET /model-status/{model_id}` - Check training status
- `POST /infer` - Run data extraction
- `GET /documents/{category_id}` - Get category documents

## 🎨 Styling & Theming

### CSS Architecture
- **CSS Custom Properties**: Used for consistent theming
- **Mobile-First**: Responsive design starting from mobile
- **Component-Based**: Modular CSS for reusable components
- **Accessibility**: High contrast mode and reduced motion support

### Color Scheme
```css
:root {
    --primary-color: #2563eb;
    --success-color: #059669;
    --warning-color: #d97706;
    --error-color: #dc2626;
    /* ... more colors */
}
```

## 🚀 Performance

### Optimization Features
- **Lazy Loading**: Components loaded on demand
- **Throttled Events**: Scroll and resize events are throttled
- **Debounced Inputs**: Search inputs use debouncing
- **Efficient Rendering**: Canvas rendering is optimized
- **Memory Management**: Proper cleanup of event listeners

### Browser Support
- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile Browsers**: iOS Safari 13+, Chrome Mobile 80+
- **Features Used**: ES6+, Canvas API, File API, Fetch API

## 🔒 Security

### Client-Side Security
- **Input Sanitization**: All user inputs are sanitized
- **XSS Prevention**: HTML content is properly escaped
- **CORS Configuration**: Proper CORS setup required
- **File Validation**: File types and sizes are validated

### Best Practices
- Use HTTPS in production
- Validate all inputs on both client and server
- Implement proper authentication if needed
- Regular security updates

## 🐛 Troubleshooting

### Common Issues

**API Connection Failed**
- Check if backend server is running
- Verify API_BASE_URL in config.js
- Check browser console for CORS errors

**File Upload Not Working**
- Check file size limits
- Verify file type is supported
- Check network connectivity

**Annotations Not Saving**
- Check browser console for errors
- Verify API endpoints are working
- Check if document ID is valid

**Canvas Not Displaying**
- Check if browser supports Canvas API
- Verify image URLs are accessible
- Check for JavaScript errors

### Debug Mode
Enable debug mode by adding `?debug=true` to the URL or setting `DEBUG: true` in config.js.

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Make your changes
3. Test thoroughly across browsers
4. Submit a pull request

### Code Style
- Use consistent indentation (2 spaces)
- Follow ES6+ standards
- Add comments for complex logic
- Use meaningful variable names

## 📄 License

This project is part of the OCR Document Automation System. Please refer to the main project license.

## 🆘 Support

For support and questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Check the main project documentation
4. Open an issue in the project repository

---

**Note**: This vanilla frontend provides the same functionality as the React version but with zero framework dependencies, making it lightweight and easy to deploy anywhere.
