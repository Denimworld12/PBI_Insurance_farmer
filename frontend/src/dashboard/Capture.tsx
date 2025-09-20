// frontend/src/components/CaptureAndReport.tsx
import React, { useRef, useState, useEffect } from "react";
import { jsPDF } from "jspdf";

function formatOverlay(ts: Date, lat: number, lon: number) {
    const weekday = ts.toLocaleDateString(undefined, { weekday: "long" });
    const dd = String(ts.getDate()).padStart(2, "0");
    const mm = String(ts.getMonth() + 1).padStart(2, "0");
    const yyyy = ts.getFullYear();
    return `${dd}/${mm}/${yyyy} (${weekday}), ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export default function CaptureAndReport() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await (videoRef.current.play?.() ?? Promise.resolve());
                }
            } catch (e) {
                console.warn("Camera init failed", e);
            }

            navigator.geolocation.getCurrentPosition(
                pos => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                err => console.warn("Geolocation error", err),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        })();
    }, []);

    const Loader = () => (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            display: "flex", justifyContent: "center", alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.8)", zIndex: 9999
        }}>
            <div style={{ width: 200, height: 60, position: "relative" }}>
                <div style={circleStyle(0)} />
                <div style={circleStyle(1)} />
                <div style={circleStyle(2)} />
            </div>
        </div>
    );

    function circleStyle(i: number): React.CSSProperties {
        const left = i === 0 ? "15%" : i === 1 ? "45%" : "75%";
        const delay = `${i * 0.15}s`;
        return {
            width: 20, height: 20, borderRadius: "50%", background: "#000",
            position: "absolute", left, top: 0,
            animation: `bounce .6s ${delay} infinite alternate ease`
        };
    }

    // minimal keyframes injected once
    useEffect(() => {
        const styleId = "capture-bounce-keyframes";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.innerHTML = `
        @keyframes bounce { 0% { transform: translateY(40px) scaleX(1.6); height: 6px; border-radius: 40px 40px 20px 20px; } 40% { transform: translateY(0) scaleX(1); height:20px; border-radius:50%; } 100% { transform: translateY(0);} }
        `;
            document.head.appendChild(style);
        }
    }, []);

    const captureAndSubmit = async () => {
        if (!videoRef.current || !canvasRef.current || !coords) return;

        setLoading(true);
        setResult(null);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

        const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), "image/jpeg", 0.92));

        const form = new FormData();
        form.append("image", blob, "capture.jpg");
        form.append("overlay_text", overlayText);
        form.append("lat", String(coords.lat));
        form.append("lon", String(coords.lon));
        form.append("client_ts", String(ts.getTime()));

        let attempts = 0;
        const maxAttempts = 2;
        let success = false;

        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                // explicit backend URL (backend runs on 5000)
                const response = await fetch("http://localhost:5000/api/claims/upload", { method: "POST", body: form });
                // small delay so loader remains visible briefly
                await new Promise(r => setTimeout(r, 800));
                const data = await response.json();
                if (data && (data.final || data.error)) {
                    setResult(data);
                    success = true;
                } else {
                    throw new Error("Incomplete result");
                }
            } catch (err) {
                console.warn(`Attempt ${attempts} failed:`, err);
                if (attempts >= maxAttempts) setResult({ error: "Upload failed after 2 attempts" });
                else await new Promise(r => setTimeout(r, 800)); // backoff
            }
        }
        setLoading(false);
    };

    const downloadPDF = () => {
        if (!result) return;
        const doc = new jsPDF("p", "mm", "a4");
        let y = 20;

        doc.setFontSize(18);
        doc.text("Claim Report", 105, y, { align: "center" });
        y += 10;
        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y); y += 8;
        doc.text(`Overlay Info: ${result?.phases?.forensics?.overlay_consistent ? "Consistent" : "Check"}`, 14, y); y += 8;
        doc.text(`Coordinates: ${result?.phases?.geo_match ? "Matched parcel" : "Outside parcel"}`, 14, y); y += 12;
        doc.setFontSize(14); doc.text("Final Result:", 14, y); y += 8;
        doc.setFontSize(12); doc.text(`Risk: ${result?.final?.risk ?? "N/A"}`, 14, y); y += 6;
        doc.text(`Verification Level: ${result?.final?.verification_level ?? "N/A"}`, 14, y); y += 6;
        doc.text(`Physical Check Needed: ${result?.final?.need_physical_check ? "Yes" : "No"}`, 14, y); y += 12;

        doc.setFontSize(14); doc.text("Phase Details:", 14, y); y += 8;
        const phasesText = JSON.stringify(result?.phases ?? {}, null, 2);
        const split = doc.splitTextToSize(phasesText, 180);
        doc.setFontSize(10); doc.text(split, 14, y);
        y += split.length * 5 + 10;
        doc.setFontSize(12); doc.text("Authorized Signature: ___________________", 14, y);

        doc.save(`claim_report_${Date.now()}.pdf`);
    };

    return (
        <div style={{ padding: 12 }}>
            <h2>Field Capture & Claim Report</h2>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxHeight: 400 }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div style={{ marginTop: 12 }}>
                <button onClick={captureAndSubmit} disabled={loading || !coords}>
                    {loading ? "Processing..." : "Capture & Submit"}
                </button>
            </div>

            {loading && <Loader />}

            {result && !loading && (
                <div style={{ marginTop: 20 }}>
                    {result.error ? (
                        <p style={{ color: "red" }}>{String(result.error)}</p>
                    ) : (
                        <>
                            <h3>Final Result</h3>
                            <p>Risk: {result?.final?.risk ?? "N/A"}</p>
                            <p>Verification Level: {result?.final?.verification_level ?? "N/A"}</p>
                            <p>Physical Check Needed: {result?.final?.need_physical_check ? "Yes" : "No"}</p>
                            <p>Damage Percentage: {((result?.phases?.damage_pct ?? 0) * 100).toFixed(2)}%</p>

                            <h4>Phase Details:</h4>
                            <pre style={{ background: "#f0f0f0", padding: 10, maxHeight: 300, overflowY: "auto" }}>
                                {JSON.stringify(result?.phases ?? {}, null, 2)}
                            </pre>

                            <button onClick={downloadPDF}>Download PDF Report</button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
