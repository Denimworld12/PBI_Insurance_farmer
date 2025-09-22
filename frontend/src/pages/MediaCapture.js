import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import api from '../utils/api';

const CAPTURE_STEPS = [
    { id: 'corner-ne', label: 'Northeast Corner', icon: '📍', type: 'photo' },
    { id: 'corner-nw', label: 'Northwest Corner', icon: '📍', type: 'photo' },
    { id: 'corner-se', label: 'Southeast Corner', icon: '📍', type: 'photo' },
    { id: 'corner-sw', label: 'Southwest Corner', icon: '📍', type: 'photo' },
    { id: 'damaged-crop', label: 'Damaged Crop', icon: '🌾', type: 'photo' },
    { id: 'farm-video', label: 'Farm Video (10s)', icon: '🎥', type: 'video' }
];

function formatOverlay(ts, lat, lon) {
    const weekday = ts.toLocaleDateString('en-US', { weekday: "long" });
    const dd = String(ts.getDate()).padStart(2, "0");
    const mm = String(ts.getMonth() + 1).padStart(2, "0");
    const yyyy = ts.getFullYear();
    return `${dd}/${mm}/${yyyy} (${weekday}), ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export default function MediaCapture() {
    const { documentId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);

    const [currentStep, setCurrentStep] = useState(0);
    const [coords, setCoords] = useState(null);
    const [stream, setStream] = useState(null);
    const [capturedMedia, setCapturedMedia] = useState({});
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [finalResult, setFinalResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        initializeCamera();
        getCurrentLocation();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const initializeCamera = async () => {
        try {
            console.log('🎥 Initializing camera...');

            // Request camera permissions
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Back camera for mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: currentStep === CAPTURE_STEPS.length - 1 // Audio only for video
            });

            console.log('✅ Camera initialized successfully');
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play();
            }

        } catch (error) {
            console.error('❌ Camera initialization failed:', error);
            let errorMessage = 'Camera access failed. ';

            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera permissions.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found.';
            } else {
                errorMessage += error.message;
            }

            setError(errorMessage);
        }
    };

    const getCurrentLocation = () => {
        if ('geolocation' in navigator) {
            console.log('🌍 Getting current location...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    };
                    console.log('✅ Location obtained:', location);
                    setCoords(location);
                },
                (error) => {
                    console.error('❌ Geolocation error:', error);
                    let errorMessage = 'Location access failed. ';

                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage += 'Please allow location permissions.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMessage += 'Location unavailable.';
                    } else {
                        errorMessage += error.message;
                    }

                    setError(errorMessage);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        } else {
            setError('Geolocation not supported by this browser.');
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current || !coords) {
            console.error('❌ Missing required elements for photo capture');
            return;
        }

        try {
            console.log('📸 Capturing photo...');
            setLoading(true);

            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;

            const ctx = canvas.getContext('2d');

            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Add timestamp and coordinates overlay
            const timestamp = new Date();
            const overlayText = formatOverlay(timestamp, coords.lat, coords.lon);

            // Style the overlay
            const fontSize = Math.max(16, canvas.width * 0.02);
            ctx.font = `${fontSize}px Arial, sans-serif`;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';

            const textMetrics = ctx.measureText(overlayText);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            const padding = 10;

            // Draw background rectangle
            const rectX = 10;
            const rectY = canvas.height - textHeight - padding * 2 - 10;
            ctx.fillRect(rectX, rectY, textWidth + padding * 2, textHeight + padding * 2);

            // Draw text
            ctx.fillStyle = 'white';
            ctx.fillText(overlayText, rectX + padding, rectY + textHeight + padding);

            // Convert canvas to blob
            const blob = await new Promise(resolve =>
                canvas.toBlob(resolve, 'image/jpeg', 0.9)
            );

            console.log('✅ Photo captured, uploading...');
            await uploadMedia(blob, CAPTURE_STEPS[currentStep], timestamp);

        } catch (error) {
            console.error('❌ Photo capture failed:', error);
            setError('Photo capture failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const startVideoRecording = async () => {
        if (!stream) {
            setError('Camera not available for recording');
            return;
        }

        try {
            console.log('🎥 Starting video recording...');

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });

            mediaRecorderRef.current = mediaRecorder;
            const chunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('🎥 Video recording stopped, processing...');
                const blob = new Blob(chunks, { type: 'video/webm' });
                await uploadMedia(blob, CAPTURE_STEPS[currentStep], new Date());
            };

            setIsRecording(true);
            setRecordingTime(0);
            mediaRecorder.start();

            // Auto-stop after 10 seconds with countdown
            const timer = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 9) {
                        clearInterval(timer);
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
            console.log('⏹️ Stopping video recording...');
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };
    const uploadMedia = async (blob, step, timestamp) => {
        try {
            console.log(`📤 Uploading ${step.type} for step: ${step.label}`);

            const formData = new FormData();
            const filename = `${step.id}.${step.type === 'photo' ? 'jpg' : 'webm'}`;
            formData.append('image', blob, filename);
            formData.append('lat', coords.lat.toString());
            formData.append('lon', coords.lon.toString());
            formData.append('client_ts', timestamp.getTime().toString());
            formData.append('overlay_text', formatOverlay(timestamp, coords.lat, coords.lon));
            formData.append('parcel_id', documentId);
            formData.append('media_type', step.type);
            formData.append('step_id', step.id); // Add step ID for backend

            console.log('📤 Sending upload request...');
            const response = await fetch('http://localhost:5000/api/claims/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log('📤 Upload response:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // Store the result - THIS IS CRITICAL
            setCapturedMedia(prev => {
                const updated = {
                    ...prev,
                    [step.id]: {
                        ...data,
                        stepInfo: step,
                        timestamp: timestamp.toISOString(),
                        uploadSuccessful: true
                    }
                };

                console.log('📋 Updated captured media:', Object.keys(updated));
                return updated;
            });

            // Store processing result for damaged crop photo (final analysis)
            if (step.id === 'damaged-crop' && data.final) {
                console.log('💾 Storing final result from damaged crop analysis');
                setFinalResult(data);
            }

            // FIXED: Move to next step or complete - Check current step properly
            console.log(`📊 Current step: ${currentStep}, Total steps: ${CAPTURE_STEPS.length}`);
            console.log(`🎯 Current step ID: ${CAPTURE_STEPS[currentStep].id}, Uploaded step ID: ${step.id}`);

            // Make sure we're processing the current step
            if (CAPTURE_STEPS[currentStep].id === step.id) {
                if (currentStep < CAPTURE_STEPS.length - 1) {
                    console.log(`➡️ Moving from step ${currentStep} to ${currentStep + 1}`);
                    setCurrentStep(prevStep => prevStep + 1);
                } else {
                    console.log('✅ All steps completed, completing claim...');
                    await completeClaim();
                }
            } else {
                console.warn(`⚠️ Step mismatch! Current: ${CAPTURE_STEPS[currentStep].id}, Uploaded: ${step.id}`);
            }

        } catch (error) {
            console.error('❌ Upload failed:', error);
            setError(`Upload failed: ${error.message}`);
        }
    };



const completeClaim = async () => {
  try {
    console.log('🎯 Completing claim with all data...');
    console.log('📊 Final result:', finalResult);
    console.log('📁 Captured media:', capturedMedia);
    console.log('📋 Media keys:', Object.keys(capturedMedia));
    
    // Prepare the completion data
    const completionData = {
      documentId,
      media: capturedMedia,
      processingResult: finalResult,
      totalSteps: CAPTURE_STEPS.length,
      completedSteps: Object.keys(capturedMedia).length
    };
    
    console.log('📤 Sending completion request...');
    
    const response = await fetch('http://localhost:5000/api/claims/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(completionData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Completion response:', data);

    if (data.success) {
      console.log('✅ Claim completed successfully');
      console.log('🎯 Navigating to results page...');
      
      // Navigate to results page
      navigate(`/claim-results/${documentId}`);
    } else {
      throw new Error(data.message || 'Claim completion failed');
    }
  } catch (error) {
    console.error('❌ Claim completion failed:', error);
    
    // Check if it's a network error
    if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
      console.log('🔄 Endpoint not found, navigating to results anyway...');
      // Navigate to results even if completion API fails
      navigate(`/claim-results/${documentId}`);
    } else {
      setError('Failed to complete claim: ' + error.message);
    }
  }
};




    const currentStepData = CAPTURE_STEPS[currentStep];
    const progress = ((currentStep + (Object.keys(capturedMedia).length > currentStep ? 1 : 0)) / CAPTURE_STEPS.length) * 100;

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>❌ Error</h2>
                <p style={{ color: 'red', marginBottom: '2rem' }}>{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '1rem 2rem',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    🔄 Retry
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2>📸 Capture Evidence - Step {currentStep + 1} of {CAPTURE_STEPS.length}</h2>

                {/* Progress Bar */}
                <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    margin: '1rem 0',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        backgroundColor: '#4CAF50',
                        transition: 'width 0.3s ease'
                    }}></div>
                </div>
            </div>

            {/* Current Step */}
            <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                marginBottom: '2rem'
            }}>
                <h3 style={{ marginBottom: '0.5rem' }}>
                    {currentStepData.icon} {currentStepData.label}
                </h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                    {currentStepData.type === 'video'
                        ? 'Record a 10-second video showing overall farm condition'
                        : `Take a clear photo of the ${currentStepData.label.toLowerCase()}`
                    }
                </p>

                {/* Video Preview */}
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            borderRadius: '12px',
                            backgroundColor: '#f0f0f0'
                        }}
                        onLoadedMetadata={() => console.log('📹 Video loaded')}
                    />

                    {/* Hidden canvas for photo capture */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Location overlay */}
                    {coords && (
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            background: 'rgba(255,255,255,0.9)',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem'
                        }}>
                            📍 {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
                        </div>
                    )}

                    {/* Recording indicator */}
                    {isRecording && (
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: '#f44336',
                            color: 'white',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 'bold'
                        }}>
                            🔴 Recording... {recordingTime}s
                        </div>
                    )}
                </div>

                {/* Capture Button */}
                <div style={{ textAlign: 'center' }}>
                    {currentStepData.type === 'photo' ? (
                        <button
                            onClick={capturePhoto}
                            disabled={loading || !coords || !stream}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                background: loading || !coords || !stream ? '#ccc' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading || !coords || !stream ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            {loading ? 'Processing...' : '📸 Capture Photo'}
                        </button>
                    ) : (
                        <button
                            onClick={isRecording ? stopVideoRecording : startVideoRecording}
                            disabled={loading || !coords || !stream}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                background: isRecording ? '#f44336' : (loading || !coords || !stream ? '#ccc' : '#4CAF50'),
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading || !coords || !stream ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            {isRecording ? `🔴 Stop (${10 - recordingTime}s)` : '🎥 Start Recording'}
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Summary */}
            {Object.keys(capturedMedia).length > 0 && (
                <div style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                    <h4 style={{ marginBottom: '1rem' }}>📋 Completed Steps:</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {Object.keys(capturedMedia).map(stepId => {
                            const step = CAPTURE_STEPS.find(s => s.id === stepId);
                            return (
                                <div key={stepId} style={{
                                    background: '#e8f5e8',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '20px',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    ✅ {step?.label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
