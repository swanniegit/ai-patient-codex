export const registerMultiModalInput = ({ store, client }) => {
  // Get UI elements
  const methodButtons = document.querySelectorAll('.method-option');
  const inputPanels = document.querySelectorAll('.input-panel');
  const fileInput = document.getElementById('file-input');
  const uploadArea = document.getElementById('upload-area');
  const filePreview = document.getElementById('file-preview');
  const uploadStatus = document.getElementById('upload-status');
  const processingResults = document.getElementById('processing-results');
  const extractedDataDiv = document.getElementById('extracted-data');

  // Audio recording elements
  const startRecordBtn = document.getElementById('start-recording');
  const stopRecordBtn = document.getElementById('stop-recording');
  const audioPlayback = document.getElementById('audio-playback');
  const uploadAudioBtn = document.getElementById('upload-audio');
  const recordingStatus = document.getElementById('recording-status');

  let currentMethod = 'text';
  let mediaRecorder = null;
  let audioChunks = [];

  // Method switching
  methodButtons.forEach(button => {
    button.addEventListener('click', () => {
      const method = button.dataset.method;
      switchToMethod(method);
    });
  });

  const switchToMethod = (method) => {
    currentMethod = method;

    // Update active button
    methodButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.method === method);
    });

    // Update active panel
    inputPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${method === 'text' ? 'bio-form' : method + '-panel'}`);
    });

    // Hide processing results when switching methods
    processingResults.style.display = 'none';
  };

  // File upload handling
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      updateUploadStatus('File too large. Maximum size is 10MB.', 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      updateUploadStatus('Invalid file type. Please upload JPG, PNG, GIF, or PDF.', 'error');
      return;
    }

    // Show preview
    showFilePreview(file);

    // Upload and process
    await uploadAndProcessFile(file);
  };

  const showFilePreview = (file) => {
    filePreview.innerHTML = '';
    const previewItem = document.createElement('div');
    previewItem.className = 'file-preview-item';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      previewItem.appendChild(img);
    }

    const info = document.createElement('div');
    info.innerHTML = `
      <div><strong>${file.name}</strong></div>
      <div>${(file.size / 1024 / 1024).toFixed(2)} MB</div>
      <div>${file.type}</div>
    `;
    previewItem.appendChild(info);
    filePreview.appendChild(previewItem);
  };

  const uploadAndProcessFile = async (file) => {
    try {
      updateUploadStatus('Uploading file...', 'processing');

      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', `${currentMethod} input file`);

      const uploadResponse = await fetch('/api/session/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Case-ID': client.identity.sessionId,
          'X-Clinician-ID': client.identity.clinicianId,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      updateUploadStatus('Processing with OCR...', 'processing');

      // Process with OCR
      const bioResponse = await fetch('/api/session/bio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Case-ID': client.identity.sessionId,
          'X-Clinician-ID': client.identity.clinicianId,
        },
        body: JSON.stringify({
          inputType: 'ocr',
          artifact: uploadResult.artifact,
        }),
      });

      if (!bioResponse.ok) {
        throw new Error(`Processing failed: ${bioResponse.statusText}`);
      }

      const bioResult = await bioResponse.json();
      updateUploadStatus('Processing complete!', 'success');

      // Show extracted data
      showExtractedData(bioResult);

    } catch (error) {
      console.error('File processing error:', error);
      updateUploadStatus(`Error: ${error.message}`, 'error');
    }
  };

  // Audio recording
  if (startRecordBtn && stopRecordBtn) {
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    uploadAudioBtn?.addEventListener('click', uploadAudio);
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayback.src = audioUrl;
        audioPlayback.style.display = 'block';
        uploadAudioBtn.disabled = false;

        // Store for upload
        audioPlayback.audioBlob = audioBlob;
      };

      mediaRecorder.start();
      startRecordBtn.disabled = true;
      startRecordBtn.classList.add('recording');
      stopRecordBtn.disabled = false;
      recordingStatus.textContent = 'Recording... Click stop when finished.';

    } catch (error) {
      console.error('Recording error:', error);
      recordingStatus.textContent = 'Error: Could not access microphone.';
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    startRecordBtn.disabled = false;
    startRecordBtn.classList.remove('recording');
    stopRecordBtn.disabled = true;
    recordingStatus.textContent = 'Recording complete. You can play it back or upload for processing.';
  };

  const uploadAudio = async () => {
    if (!audioPlayback.audioBlob) return;

    try {
      updateRecordingStatus('Uploading audio...', 'processing');

      // Upload audio file
      const formData = new FormData();
      formData.append('file', audioPlayback.audioBlob, 'recording.mp3');
      formData.append('description', 'Audio recording input');

      const uploadResponse = await fetch('/api/session/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Case-ID': client.identity.sessionId,
          'X-Clinician-ID': client.identity.clinicianId,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      updateRecordingStatus('Processing with speech recognition...', 'processing');

      // Process with ASR
      const bioResponse = await fetch('/api/session/bio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Case-ID': client.identity.sessionId,
          'X-Clinician-ID': client.identity.clinicianId,
        },
        body: JSON.stringify({
          inputType: 'audio',
          artifact: uploadResult.artifact,
        }),
      });

      if (!bioResponse.ok) {
        throw new Error(`Processing failed: ${bioResponse.statusText}`);
      }

      const bioResult = await bioResponse.json();
      updateRecordingStatus('Processing complete!', 'success');

      // Show extracted data
      showExtractedData(bioResult);

    } catch (error) {
      console.error('Audio processing error:', error);
      updateRecordingStatus(`Error: ${error.message}`, 'error');
    }
  };

  const showExtractedData = (bioResult) => {
    // Display processing flow
    let content = '<h4>Processing Summary</h4>';
    if (bioResult.processingFlow) {
      content += '<ul>';
      bioResult.processingFlow.forEach(step => {
        content += `<li>${step}</li>`;
      });
      content += '</ul>';
    }

    // Display extracted patient data
    if (bioResult.bio && bioResult.bio.extractedData) {
      content += '<h4>Extracted Information</h4>';
      content += '<div class="extracted-fields">';

      Object.entries(bioResult.bio.extractedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          content += `<div><strong>${key}:</strong> ${value}</div>`;
        }
      });

      content += '</div>';
    }

    extractedDataDiv.innerHTML = content;
    processingResults.style.display = 'block';

    // Update the store with the new data
    store.setState({
      snapshot: bioResult,
      phase: 'ready',
      message: 'Data extracted successfully',
      error: null
    });
  };

  // Accept/Edit extracted data
  document.getElementById('accept-extracted')?.addEventListener('click', () => {
    processingResults.style.display = 'none';
    switchToMethod('text'); // Switch to text form for review/editing
  });

  document.getElementById('edit-extracted')?.addEventListener('click', () => {
    processingResults.style.display = 'none';
    switchToMethod('text'); // Switch to text form for manual editing
  });

  const updateUploadStatus = (message, type) => {
    if (uploadStatus) {
      uploadStatus.textContent = message;
      uploadStatus.className = `status ${type}`;
    }
  };

  const updateRecordingStatus = (message, type) => {
    if (recordingStatus) {
      recordingStatus.textContent = message;
      recordingStatus.className = `status ${type}`;
    }
  };
};