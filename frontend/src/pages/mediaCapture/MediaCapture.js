import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import './mediacapture.css';

const MediaCapture = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [stream, setStream] = useState(null);
  const [coords, setCoords] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedBlobs, setCapturedBlobs] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const CAPTURE_STEPS = [
    { id: 'corner-ne', label: 'Northeast Corner', type: 'photo', icon: '📍', required: true, description: 'Capture the northeast corner of your farm' },
    { id: 'corner-nw', label: 'Northwest Corner', type: 'photo', icon: '📍', required: true, description: 'Capture the northwest corner of your farm' },
    { id: 'corner-se', label: 'Southeast Corner', type: 'photo', icon: '📍', required: true, description: 'Capture the southeast corner of your farm' },
    { id: 'corner-sw', label: 'Southwest Corner', type: 'photo', icon: '📍', required: true, description: 'Capture the southwest corner of your farm' },
    { id: 'damaged-crop', label: 'Damaged Crop Evidence', type: 'photo', icon: '🌾', required: true, description: 'Show clear evidence of crop damage' },
    { id: 'farm-video', label: 'Farm Overview Video', type: 'video', icon: '🎥', required: false, description: '10-second overview of your farm' }
  ];

  useEffect(() => {
    initializeCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeCamera = async () => {
    try {
      console.log('🎥 Initializing camera with high-accuracy GPS...');
      setError(null);

      if (navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000
          });
        });

        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        console.log(`✅ GPS Located: ${position.coords.latitude}, ${position.coords.longitude}`);
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        console.log('✅ Camera initialized successfully');
      }

    } catch (error) {
      console.error('❌ Camera/GPS initialization failed:', error);
      
      let errorMessage = 'Failed to access camera or GPS.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/GPS permission denied. Please allow access and refresh.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera device found.';
      } else if (error.code === 1) {
        errorMessage = 'Location permission denied. Please enable GPS.';
      }
      
      setError(errorMessage);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !coords) return;

    try {
      setLoading(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const timestamp = new Date();
      const overlayLines = [
        `📅 ${timestamp.toLocaleDateString('en-GB')}`,
        `🕐 ${timestamp.toLocaleTimeString()}`,
        `📍 ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`,
        `${CAPTURE_STEPS[currentStep].label}`
      ];

      const fontSize = Math.max(14, canvas.width * 0.015);
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.shadowBlur = 4;

      const padding = 10;
      const lineHeight = fontSize + 4;
      const overlayHeight = (overlayLines.length * lineHeight) + (padding * 2);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, canvas.height - overlayHeight - 10, canvas.width - 20, overlayHeight);

      ctx.fillStyle = 'white';
      overlayLines.forEach((line, index) => {
        ctx.fillText(line, 20, canvas.height - overlayHeight - 10 + padding + (index + 1) * lineHeight);
      });

      const blob = await new Promise(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      );

      setCapturedBlobs(prev => ({
        ...prev,
        [CAPTURE_STEPS[currentStep].id]: {
          blob,
          step: CAPTURE_STEPS[currentStep],
          timestamp,
          coords: { ...coords }
        }
      }));

      console.log(`✅ Photo captured for step: ${CAPTURE_STEPS[currentStep].id}`);

      if (currentStep < CAPTURE_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      }

    } catch (error) {
      console.error('❌ Photo capture failed:', error);
      setError('Photo capture failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startVideoRecording = async () => {
    if (!stream) return;

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const timestamp = new Date();

        setCapturedBlobs(prev => ({
          ...prev,
          [CAPTURE_STEPS[currentStep].id]: {
            blob,
            step: CAPTURE_STEPS[currentStep],
            timestamp,
            coords: { ...coords }
          }
        }));

        console.log(`✅ Video captured for step: ${CAPTURE_STEPS[currentStep].id}`);
      };

      setIsRecording(true);
      setRecordingTime(0);
      mediaRecorder.start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 9) {
            clearInterval(recordingTimerRef.current);
            stopVideoRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Video recording failed:', error);
      setError('Video recording failed: ' + error.message);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // ✅ FIXED: Using api utility instead of fetch
  const uploadSingleFile = async (stepId, captureData) => {
    try {
      setUploadProgress(prev => ({ ...prev, [stepId]: 'uploading' }));

      const formData = new FormData();
      const filename = `${stepId}.${captureData.step.type === 'photo' ? 'jpg' : 'webm'}`;
      formData.append('image', captureData.blob, filename);
      formData.append('lat', captureData.coords.lat.toString());
      formData.append('lon', captureData.coords.lon.toString());
      formData.append('client_ts', captureData.timestamp.getTime().toString());
      formData.append('parcel_id', documentId);
      formData.append('media_type', captureData.step.type);
      formData.append('step_id', stepId);

      console.log(`📤 Uploading ${stepId}...`);

      // ✅ FIXED: Using api utility with proper headers
      const response = await api.post('/claims/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = response.data;

      console.log(`✅ Upload successful for ${stepId} (${data.filesUploaded} total)`);
      setUploadProgress(prev => ({ ...prev, [stepId]: 'success' }));

      return {
        stepId,
        success: data.success,
        filesUploaded: data.filesUploaded
      };

    } catch (error) {
      console.error(`❌ Upload failed for ${stepId}:`, error);
      setUploadProgress(prev => ({ ...prev, [stepId]: 'error' }));
      throw error;
    }
  };

  // ✅ FIXED: Using api utility instead of fetch
  const submitAllEvidence = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const capturedSteps = Object.keys(capturedBlobs);
      console.log(`🚀 Starting upload of ${capturedSteps.length} files...`);

      const uploadResults = {};
      for (const stepId of capturedSteps) {
        try {
          const result = await uploadSingleFile(stepId, capturedBlobs[stepId]);
          uploadResults[stepId] = result;
        } catch (uploadError) {
          console.error(`Failed to upload ${stepId}:`, uploadError);
          throw new Error(`Upload failed for ${stepId}: ${uploadError.message}`);
        }
      }

      console.log(`✅ All ${capturedSteps.length} files uploaded successfully`);
      console.log(`🐍 Triggering batch Python processing via /complete...`);

      // ✅ FIXED: Using api utility
      const completionResponse = await api.post('/claims/complete', {
        documentId,
        media: uploadResults,
        totalSteps: CAPTURE_STEPS.length,
        completedSteps: capturedSteps.length
      });

      console.log('✅ Batch processing completed:', completionResponse.data);

      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log(`🎯 Navigating to results page: /claim-results/${documentId}`);
      navigate(`/claim-results/${documentId}`);

    } catch (error) {
      console.error('❌ Submission failed:', error);
      
      const errorMessage = error.response?.data?.message || 
        error.message || 
        'Submission failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepData = CAPTURE_STEPS[currentStep];
  const capturedSteps = Object.keys(capturedBlobs);
  const allCaptured = CAPTURE_STEPS.every(step =>
    !step.required || capturedBlobs[step.id]
  );

  return (
    <div className="media-capture-page">
      <div className="capture-header">
        <div className="header-content">
          <h1>📸 Evidence Collection</h1>
          <div className="document-id">Document: {documentId}</div>
          <div className="progress-text">
            Step {currentStep + 1} of {CAPTURE_STEPS.length}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button className="error-close" onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}

      {!allCaptured && (
        <div className="capture-section mobile-layout">
          <div className="capture-card">
            <div className="camera-container top-camera">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-feed"
              />

              {isRecording && (
                <div className="recording-indicator top-right">
                  <span className="recording-dot">●</span>
                  REC {10 - recordingTime}s
                </div>
              )}

              {loading && (
                <div className="processing-overlay">
                  <div className="spinner"></div>
                  <span>Processing...</span>
                </div>
              )}
            </div>

            <div className="capture-header-text mobile-info">
              <h2>{currentStepData.icon} {currentStepData.label}</h2>
              <p>{currentStepData.description}</p>
            </div>

            <div className="capture-controls mobile-controls">
              {currentStepData.type === 'photo' ? (
                <button
                  onClick={capturePhoto}
                  disabled={loading || !coords || !stream}
                  className="capture-btn primary"
                >
                  {loading ? '🔄 Processing...' : '📸 Capture Photo'}
                </button>
              ) : (
                <button
                  onClick={isRecording ? stopVideoRecording : startVideoRecording}
                  disabled={loading || !coords || !stream}
                  className={`capture-btn ${isRecording ? 'danger' : 'primary'}`}
                >
                  {isRecording ? `⏹️ Stop (${10 - recordingTime}s)` : '🎥 Start Recording'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="steps-progress">
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${(capturedSteps.length / CAPTURE_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="steps-grid">
          {CAPTURE_STEPS.map((step, index) => {
            const isCaptured = capturedBlobs[step.id];
            const isCurrent = index === currentStep;
            const uploadStatus = uploadProgress[step.id];

            return (
              <div
                key={step.id}
                className={`step-indicator ${isCaptured ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <div className="step-icon">
                  {uploadStatus === 'uploading' && '⏳'}
                  {uploadStatus === 'success' && '✅'}
                  {uploadStatus === 'error' && '❌'}
                  {!uploadStatus && (isCaptured ? '📁' : isCurrent ? step.icon : '⭕')}
                </div>
                <div className="step-label">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {allCaptured && (
        <div className="submit-section">
          <div className="submit-card">
            <div className="success-icon">✅</div>
            <h3>All Evidence Captured!</h3>
            <p>{capturedSteps.length} files ready to upload and analyze</p>

            <button
              onClick={submitAllEvidence}
              disabled={isSubmitting}
              className="submit-btn"
            >
              {isSubmitting ? '🔄 Uploading & Processing...' : '🚀 Submit All Evidence'}
            </button>

            {isSubmitting && (
              <div className="submitting-status">
                <div className="status-message">📤 Uploading files to server...</div>
                <div className="status-message">🐍 Running Python batch analysis...</div>
                <div className="status-message">🔍 Processing EXIF, GPS, weather data...</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`gps-status ${coords ? 'active' : 'pending'}`}>
        <span className="gps-icon">{coords ? '📍' : '⏳'}</span>
        <div className="gps-info">
          {coords ? (
            <>
              <strong>GPS Located</strong>
              <div className="gps-coords">
                {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
                <span className="gps-accuracy">(±{Math.round(coords.accuracy)}m)</span>
              </div>
            </>
          ) : (
            <strong>Acquiring GPS signal...</strong>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default MediaCapture;
