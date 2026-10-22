import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl } from '../utils/config';

export function useObjectDetection({
  webcamRef,
  token,
  isActive = true,
  intervalMs = 3500,
  onPhoneDetected
}) {
  const [phoneState, setPhoneState] = useState({
    detected: false,
    confidence: 0,
    model: 'YOLOv8n',
    lastDetectionTime: null
  });

  const isRunningRef = useRef(false);

  const captureFrameBase64 = useCallback(() => {
    if (!webcamRef?.current) return null;
    return webcamRef.current.getScreenshot();
  }, [webcamRef]);

  const detectObjects = useCallback(async () => {
    const imageBase64 = captureFrameBase64();
    if (!imageBase64 || !token) return;

    // 1. Detect Phone via backend proxy to YOLOv8
    try {
      const apiBase = getApiBaseUrl();
      const phoneRes = await fetch(`${apiBase}/api/detect/phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageBase64, confidence_threshold: 0.35 })
      });

      const phoneData = await phoneRes.json();
      if (phoneData.detected) {
        const topDetection = phoneData.detections[0] || {};
        const conf = topDetection.confidence || 0.85;

        setPhoneState({
          detected: true,
          confidence: conf,
          model: phoneData.model || 'YOLOv8n',
          lastDetectionTime: new Date().toISOString()
        });

        if (onPhoneDetected) {
          onPhoneDetected({
            type: 'phone_detected',
            confidence: conf,
            description: `Mobile phone detected with ${(conf * 100).toFixed(1)}% confidence`,
            screenshotBase64: imageBase64
          });
        }
      } else {
        setPhoneState((prev) => ({ ...prev, detected: false, confidence: 0 }));
      }
    } catch (err) {
      console.warn('Phone detection API error:', err);
    }
  }, [captureFrameBase64, token, onPhoneDetected]);

  useEffect(() => {
    if (!isActive) {
      isRunningRef.current = false;
      return;
    }

    isRunningRef.current = true;
    const interval = setInterval(() => {
      if (isRunningRef.current) {
        detectObjects();
      }
    }, intervalMs);

    return () => {
      isRunningRef.current = false;
      clearInterval(interval);
    };
  }, [isActive, intervalMs, detectObjects]);

  return { phoneState };
}
