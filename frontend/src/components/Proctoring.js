import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

const Proctoring = () => {
  const videoRef = useRef(null);
  const modelRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const [status, setStatus] = useState("Initializing...");
  const [audioLevel, setAudioLevel] = useState(0);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelError, setModelError] = useState(null);

  // 🔊 Audio Detection
  const startAudioDetection = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mic = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    mic.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    setInterval(() => {
      analyser.getByteFrequencyData(data);
      let volume = data.reduce((a, b) => a + b) / data.length;
      setAudioLevel(volume);
    }, 500);
  };

  // 🧠 Load Models with safety checks
  const loadModels = async () => {
    const MODEL_URL = "/models";

    console.log("🔄 Loading face models...");

    try {
      // Load TinyFaceDetector model
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

      // Verify it actually loaded (catches 0-byte files)
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        throw new Error(
          "TinyFaceDetector model files are corrupt or empty. " +
          "Run: node scripts/download-models.js"
        );
      }

      console.log("✅ TinyFaceDetector loaded");
    } catch (err) {
      console.error("❌ Failed to load TinyFaceDetector:", err);
      throw new Error(`TinyFaceDetector failed: ${err.message}`);
    }

    try {
      // Load COCO-SSD for phone detection (separate from face-api)
      modelRef.current = await cocoSsd.load();
      console.log("✅ COCO-SSD loaded");
    } catch (err) {
      console.warn("⚠️ COCO-SSD failed to load (phone detection disabled):", err);
      // Non-critical, continue without phone detection
    }

    console.log("✅ Face models loaded successfully");
  };

  useEffect(() => {
    let cleanedUp = false;

    const init = async () => {
      try {
        // Step 1: Load AI models FIRST
        await loadModels();

        if (cleanedUp) return;
        setModelsReady(true);

        // Step 2: Start camera + mic
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cleanedUp || !videoRef.current) return;
        videoRef.current.srcObject = stream;

        // Step 3: Start audio detection
        startAudioDetection(stream);

        // Step 4: Wait for video to load before starting detection
        videoRef.current.onloadedmetadata = () => {
          if (cleanedUp || !videoRef.current) return;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              if (err.name !== 'AbortError' && !err.message.includes('interrupted')) {
                console.warn('Video play warning:', err.message);
              }
            });
          }

          console.log("🚀 Starting detection loop...");

          // 🔁 Detection loop - ONLY runs after models are confirmed loaded
          detectionIntervalRef.current = setInterval(async () => {
            // Safety check 1: Video element must exist
            if (!videoRef.current) return;

            // Safety check 2: Video must be fully ready (readyState 4 = HAVE_ENOUGH_DATA)
            if (videoRef.current.readyState !== 4) return;

            // Safety check 3: TinyFaceDetector must be loaded
            if (!faceapi.nets.tinyFaceDetector.isLoaded) {
              console.warn("⚠️ TinyFaceDetector not loaded, skipping detection cycle");
              return;
            }

            if (!videoRef.current || videoRef.current.readyState < 4 || !videoRef.current.videoWidth || !videoRef.current.videoHeight || videoRef.current.paused) {
              return;
            }

            try {
              // 👤 Face Detection
              const rawDets = await faceapi.detectAllFaces(
                videoRef.current,
                new faceapi.TinyFaceDetectorOptions()
              );
              const detections = (rawDets || []).filter(d => d && d.box && typeof d.box.x === 'number' && d.box.x !== null && d.box.width > 0);


              if (detections.length > 1) {
                setStatus("⚠️ Multiple Faces Detected");
              } else if (detections.length === 0) {
                setStatus("⚠️ No Face Detected");
              } else {
                setStatus("✅ Face OK");
              }
            } catch (faceErr) {
              console.error("Face detection error:", faceErr);
              // Don't crash - just log and continue
            }

            // 📱 Phone Detection
            try {
              if (modelRef.current && videoRef.current) {
                const predictions = await modelRef.current.detect(videoRef.current);

                predictions.forEach((p) => {
                  if (p.class === "cell phone") {
                    setStatus("🚨 Phone Detected!");
                  }
                });
              }
            } catch (phoneErr) {
              console.error("Phone detection error:", phoneErr);
              // Don't crash - just log and continue
            }
          }, 2000);
        };
      } catch (error) {
        console.error("❌ Proctoring initialization error:", error);
        setStatus("❌ Error starting proctoring");
        setModelError(error.message);
      }
    };

    init();

    // Cleanup
    return () => {
      cleanedUp = true;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Proctoring Monitor</h2>

      {modelError && (
        <div style={{
          background: "rgba(239,68,68,0.1)",
          border: "1px solid #ef4444",
          borderRadius: "8px",
          padding: "12px 16px",
          margin: "10px auto",
          maxWidth: "400px",
          color: "#ef4444",
          fontSize: "13px"
        }}>
          <strong>⚠️ Model Error:</strong> {modelError}
        </div>
      )}

      {!modelsReady && !modelError && (
        <div style={{ color: "#94a3b8", fontSize: "13px", margin: "8px 0" }}>
          🔄 Loading AI models...
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        muted
        width="300"
        height="200"
        style={{
          borderRadius: "10px",
          background: "black",
        }}
      />

      <h3>Status: {status}</h3>
      <h4>Audio Level: {audioLevel.toFixed(2)}</h4>
    </div>
  );
};

export default Proctoring;