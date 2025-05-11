document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('image-upload');
    const addRectangleBtn = document.getElementById('add-rectangle');
    const processImageBtn = document.getElementById('process-image');
    const imageContainer = document.getElementById('image-container');
    const resultsDiv = document.getElementById('results');
    
    let uploadedImage = null;
    let rectangles = [];
    let currentInteraction = { type: null, element: null, startX: 0, startY: 0 };
    
    // Handle image upload
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageContainer.innerHTML = '';
                const img = new Image();
                img.src = event.target.result;
                img.id = 'uploaded-image';
                imageContainer.appendChild(img);
                uploadedImage = img;
                rectangles = [];
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Add new rectangle
    addRectangleBtn.addEventListener('click', () => {
        if (!uploadedImage) return;
        
        const rect = document.createElement('div');
        rect.className = 'rectangle';
        rect.style.width = '100px';
        rect.style.height = '60px';
        rect.style.left = '50px';
        rect.style.top = '50px';
        rect.dataset.number = `Area ${rectangles.length + 1}`;
        
        // Delete button
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            rect.remove();
            rectangles = rectangles.filter(r => r.element !== rect);
        });
        
        // Resize handles (8 handles for all directions)
        const createHandle = (className) => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${className}`;
            return handle;
        };
        
        rect.appendChild(deleteBtn);
        
        // Add resize handles
        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(dir => {
            const handle = createHandle(dir);
            handle.addEventListener('mousedown', (e) => startResize(e, dir));
            rect.appendChild(handle);
        });
        
        // Drag functionality
        rect.addEventListener('mousedown', startDrag);
        
        imageContainer.appendChild(rect);
        rectangles.push({ element: rect, coords: null });
    });
    
    // Process image with rectangles
    processImageBtn.addEventListener('click', async () => {
        if (!uploadedImage || rectangles.length === 0) return;
        
        // Get coordinates of all rectangles relative to the image
        const imageRect = uploadedImage.getBoundingClientRect();
        const cropAreas = rectangles.map(rect => {
            const rectEl = rect.element.getBoundingClientRect();
            return {
                x1: rectEl.left - imageRect.left,
                y1: rectEl.top - imageRect.top,
                x2: rectEl.right - imageRect.left,
                y2: rectEl.bottom - imageRect.top
            };
        });
        
        try {
            // Convert image to blob
            const blob = await fetch(uploadedImage.src).then(r => r.blob());
            
            // Create FormData to send
            const formData = new FormData();
            formData.append('image', blob);
            formData.append('crop_areas', JSON.stringify(cropAreas));
            
            // Send to backend
            const response = await fetch('/process', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            // Display results on rectangles
            if (data.results && data.results.length === rectangles.length) {
                rectangles.forEach((rect, i) => {
                    rect.element.dataset.number = `Detected: ${data.results[i]}`;
                });
            }
            
            // Show full results
            resultsDiv.innerHTML = `<h3>Detection Results:</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (error) {
            console.error('Error:', error);
            resultsDiv.innerHTML = 'Error processing image';
        }
    });
    
    // Interaction functions
    function startDrag(e) {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('delete-btn')) return;
        
        const rect = e.target.getBoundingClientRect();
        currentInteraction = {
            type: 'drag',
            element: e.target,
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top,
            originalLeft: parseInt(e.target.style.left) || 0,
            originalTop: parseInt(e.target.style.top) || 0
        };
        
        document.addEventListener('mousemove', handleInteraction);
        document.addEventListener('mouseup', stopInteraction);
    }
    
    function startResize(e, direction) {
        e.stopPropagation();
        
        const rect = e.target.parentElement.getBoundingClientRect();
        currentInteraction = {
            type: 'resize',
            element: e.target.parentElement,
            direction: direction,
            startX: e.clientX,
            startY: e.clientY,
            originalWidth: parseInt(e.target.parentElement.style.width) || 100,
            originalHeight: parseInt(e.target.parentElement.style.height) || 60,
            originalLeft: parseInt(e.target.parentElement.style.left) || 0,
            originalTop: parseInt(e.target.parentElement.style.top) || 0
        };
        
        document.addEventListener('mousemove', handleInteraction);
        document.addEventListener('mouseup', stopInteraction);
    }
    
    function handleInteraction(e) {
        if (!currentInteraction.element) return;
        
        const containerRect = imageContainer.getBoundingClientRect();
        const containerLeft = containerRect.left;
        const containerTop = containerRect.top;
        
        if (currentInteraction.type === 'drag') {
            // Handle dragging
            const newLeft = e.clientX - containerLeft - currentInteraction.startX;
            const newTop = e.clientY - containerTop - currentInteraction.startY;
            
            // Constrain to container
            const maxLeft = containerRect.width - parseInt(currentInteraction.element.style.width);
            const maxTop = containerRect.height - parseInt(currentInteraction.element.style.height);
            
            currentInteraction.element.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
            currentInteraction.element.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
        } 
        else if (currentInteraction.type === 'resize') {
            // Handle resizing
            const dx = e.clientX - currentInteraction.startX;
            const dy = e.clientY - currentInteraction.startY;
            
            let newWidth = currentInteraction.originalWidth;
            let newHeight = currentInteraction.originalHeight;
            let newLeft = currentInteraction.originalLeft;
            let newTop = currentInteraction.originalTop;
            
            // Handle different resize directions
            switch (currentInteraction.direction) {
                case 'e':
                    newWidth = Math.max(20, currentInteraction.originalWidth + dx);
                    break;
                case 's':
                    newHeight = Math.max(20, currentInteraction.originalHeight + dy);
                    break;
                case 'se':
                    newWidth = Math.max(20, currentInteraction.originalWidth + dx);
                    newHeight = Math.max(20, currentInteraction.originalHeight + dy);
                    break;
                case 'n':
                    newHeight = Math.max(20, currentInteraction.originalHeight - dy);
                    newTop = currentInteraction.originalTop + dy;
                    break;
                case 'w':
                    newWidth = Math.max(20, currentInteraction.originalWidth - dx);
                    newLeft = currentInteraction.originalLeft + dx;
                    break;
                case 'nw':
                    newWidth = Math.max(20, currentInteraction.originalWidth - dx);
                    newHeight = Math.max(20, currentInteraction.originalHeight - dy);
                    newLeft = currentInteraction.originalLeft + dx;
                    newTop = currentInteraction.originalTop + dy;
                    break;
                case 'ne':
                    newWidth = Math.max(20, currentInteraction.originalWidth + dx);
                    newHeight = Math.max(20, currentInteraction.originalHeight - dy);
                    newTop = currentInteraction.originalTop + dy;
                    break;
                case 'sw':
                    newWidth = Math.max(20, currentInteraction.originalWidth - dx);
                    newHeight = Math.max(20, currentInteraction.originalHeight + dy);
                    newLeft = currentInteraction.originalLeft + dx;
                    break;
            }
            
            // Constrain to container
            const maxWidth = containerRect.width - newLeft;
            const maxHeight = containerRect.height - newTop;
            newWidth = Math.min(newWidth, maxWidth);
            newHeight = Math.min(newHeight, maxHeight);
            
            currentInteraction.element.style.width = `${newWidth}px`;
            currentInteraction.element.style.height = `${newHeight}px`;
            currentInteraction.element.style.left = `${newLeft}px`;
            currentInteraction.element.style.top = `${newTop}px`;
        }
    }
    
    function stopInteraction() {
        document.removeEventListener('mousemove', handleInteraction);
        document.removeEventListener('mouseup', stopInteraction);
        currentInteraction = { type: null, element: null };
    }
});