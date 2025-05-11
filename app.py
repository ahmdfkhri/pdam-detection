from flask import Flask, request, jsonify
import cv2
import numpy as np
from PIL import Image
import io
import pytesseract  # or use easyocr

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return app.send_static_file('static', path)

@app.route('/process', methods=['POST'])
def process_image():
    try:
        # Get image and crop areas
        image_file = request.files['image']
        crop_areas = request.form.getlist('crop_areas')[0]  # Get first item
        crop_areas = eval(crop_areas)  # Convert string to list
        
        # Convert image to OpenCV format
        img_bytes = image_file.read()
        img = Image.open(io.BytesIO(img_bytes))
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        
        results = []
        
        # Process each crop area
        for area in crop_areas:
            x1, y1, x2, y2 = int(area['x1']), int(area['y1']), int(area['x2']), int(area['y2'])
            
            # Crop and preprocess
            cropped = img_cv[y1:y2, x1:x2]
            gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # Use OCR (Tesseract)
            text = pytesseract.image_to_string(thresh, config='--psm 6 digits')
            text = ''.join(c for c in text if c.isdigit())  # Keep only digits
            
            results.append(text.strip() or "No detection")
        
        return jsonify({"status": "success", "results": results})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(debug=True)