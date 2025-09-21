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
    const weekday = ts.toLocaleDateString(undefined, { weekday: "long" });
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
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Back camera for mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: currentStep === CAPTURE_STEPS.length - 1 // Audio only for video
            });

            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            console.error('Camera initialization failed:', error);
            alert('Camera access is required. Please enable camera permissions.');
        }
    };

    const getCurrentLocation = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCoords({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Location access is required for claim verification.');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current || !coords) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Add timestamp and coordinates overlay
        const ts = new Date();
        const overlayText = formatOverlay(ts, coords.lat, coords.lon);

        const pad = 12;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        const fontSize = Math.max(18, canvas.width * 0.018);
        ctx.font = `${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(overlayText).width;
        const stripW = textWidth + pad * 2;
        const stripH = fontSize + pad * 2;
        const x = 16, y = canvas.height - stripH - 16;
        ctx.fillRect(x, y, stripW, stripH);
        ctx.fillStyle = "#000";
        ctx.fillText(overlayText, x + pad, y + fontSize + 2);

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', 0.9)
        );

        await uploadMedia(blob, CAPTURE_STEPS[currentStep], ts);
    };

    const startVideoRecording = async () => {
        if (!stream) return;

        try {
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                await uploadMedia(blob, CAPTURE_STEPS[currentStep], new Date());
            };

            setIsRecording(true);
            setRecordingTime(0);
            mediaRecorder.start();

            // Auto-stop after 10 seconds
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
            console.error('Recording failed:', error);
            alert('Video recording failed. Please try again.');
        }
    };

    const stopVideoRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const uploadMedia = async (blob, step, timestamp) => {
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('image', blob, `${step.id}.${step.type === 'photo' ? 'jpg' : 'webm'}`);
            formData.append('lat', coords.lat.toString());
            formData.append('lon', coords.lon.toString());
            formData.append('client_ts', timestamp.getTime().toString());
            formData.append('overlay_text', formatOverlay(timestamp, coords.lat, coords.lon));
            formData.append('parcel_id', documentId);

            // Use the backend upload endpoint
            const response = await fetch('http://localhost:5000/api/claims/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setCapturedMedia(prev => ({
                ...prev,
                [step.id]: {
                    ...data,
                    stepInfo: step,
                    timestamp: timestamp.toISOString()
                }
            }));

            // Store processing result if this was the damaged crop photo
            if (step.id === 'damaged-crop' && data.final) {
                setFinalResult(data);
            }

            // Move to next step or complete
            if (currentStep < CAPTURE_STEPS.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                await completeClaim();
            }

        } catch (error) {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.message}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    const completeClaim = async () => {
        try {
            // Mock completion - replace with actual API call
            alert(`Claim submitted successfully! Document ID: ${documentId}`);
            navigate('/claims');
        } catch (error) {
            console.error('Claim completion failed:', error);
            alert('Failed to complete claim. Please contact support.');
        }
    };

    const downloadPDF = () => {
        if (!finalResult) return;

        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(18);
        doc.text("PBI Agriculture Insurance Claim Report", 105, y, { align: "center" });
        y += 15;

        doc.setFontSize(12);
        doc.text(`Document ID: ${documentId}`, 14, y); y += 8;
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y); y += 8;
        doc.text(`Coordinates: ${coords?.lat.toFixed(6)}, ${coords?.lon.toFixed(6)}`, 14, y); y += 12;

        doc.setFontSize(14);
        doc.text("Assessment Results:", 14, y); y += 8;

        doc.setFontSize(12);
        doc.text(`Risk Level: ${finalResult?.final?.risk ?? "N/A"}`, 14, y); y += 6;
        doc.text(`Verification: ${finalResult?.final?.verification_level ?? "N/A"}`, 14, y); y += 6;
        doc.text(`Physical Check: ${finalResult?.final?.need_physical_check ? "Required" : "Not Required"}`, 14, y); y += 6;
        doc.text(`Damage: ${((finalResult?.phases?.damage_pct ?? 0) * 100).toFixed(2)}%`, 14, y); y += 12;

        doc.text("Captured Evidence:", 14, y); y += 8;
        Object.keys(capturedMedia).forEach(stepId => {
            const step = CAPTURE_STEPS.find(s => s.id === stepId);
            if (step) {
                doc.text(`✓ ${step.label}`, 20, y); y += 6;
            }
        });

        doc.save(`claim_report_${documentId}.pdf`);
    };

    const currentStepData = CAPTURE_STEPS[currentStep];
    const progress = ((currentStep + (Object.keys(capturedMedia).length > currentStep ? 1 : 0)) / CAPTURE_STEPS.length) * 100;

    return (
        <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2>📸 Capture Evidence</h2>
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
                <p>Step {currentStep + 1} of {CAPTURE_STEPS.length}</p>
            </div>

            <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                marginBottom: '2rem'
            }}>
                <h3 style={{ marginBottom: '0.5rem' }}>{currentStepData.icon} {currentStepData.label}</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                    {currentStepData.type === 'video'
                        ? 'Record a 10-second video showing overall farm condition'
                        : `Take a clear photo of the ${currentStepData.label.toLowerCase()}`
                    }
                </p>

                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            borderRadius: '12px',
                            backgroundColor: '#f0f0f0'
                        }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

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

                <div style={{ textAlign: 'center' }}>
                    {currentStepData.type === 'photo' ? (
                        <button
                            onClick={capturePhoto}
                            disabled={loading || !coords}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                background: loading || !coords ? '#ccc' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading || !coords ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            {loading ? 'Processing...' : '📸 Capture Photo'}
                        </button>
                    ) : (
                        <button
                            onClick={isRecording ? stopVideoRecording : startVideoRecording}
                            disabled={loading || !coords}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                background: isRecording ? '#f44336' : (loading || !coords ? '#ccc' : '#4CAF50'),
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading || !coords ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            {isRecording ? `🔴 Stop Recording (${recordingTime}s)` : '🎥 Start Recording'}
                        </button>
                    )}
                </div>
            </div>

            {Object.keys(capturedMedia).length > 0 && (
                <div style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    marginBottom: '2rem'
                }}>
                    <h4 style={{ marginBottom: '1rem' }}>📋 Captured Evidence:</h4>
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

            {finalResult && (
                <div style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                    <h4 style={{ marginBottom: '1rem', color: '#4CAF50' }}>✅ Processing Complete!</h4>

                    <div style={{ marginBottom: '1rem' }}>
                        <p><strong>Risk Level:</strong> {finalResult?.final?.risk}</p>
                        <p><strong>Verification:</strong> {finalResult?.final?.verification_level}</p>
                        <p><strong>Estimated Damage:</strong> {((finalResult?.phases?.damage_pct ?? 0) * 100).toFixed(2)}%</p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={downloadPDF}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            📄 Download Report
                        </button>

                        <button
                            onClick={() => navigate('/claims')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            📋 View Claims
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
