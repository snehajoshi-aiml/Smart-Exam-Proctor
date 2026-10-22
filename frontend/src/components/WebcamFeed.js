import React, { useRef } from 'react';
import Webcam from 'react-webcam';

export default function WebcamFeed({
  webcamRef,
  isActive = true,
  faceStatus = 'idle',
  onUserMedia,
  onUserMediaError
}) {
  const localWebcamRef = useRef(null);
  const activeRef = webcamRef || localWebcamRef;

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user'
  };

  return (
    <div className="webcam-container">
      <Webcam
        ref={activeRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className="webcam-video"
        mirrored={true}
        onUserMedia={onUserMedia}
        onUserMediaError={onUserMediaError}
      />

      {/* Bounding box scan animation overlay */}
      <div className="webcam-overlay">
        {faceStatus === 'mismatch' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '4px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulseGlow 1s infinite'
          }} />
        )}

        {faceStatus === 'verified' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '2px solid var(--success)',
            borderRadius: 'var(--radius-md)'
          }} />
        )}

        {/* Live indicator badge */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isActive ? 'var(--success)' : 'var(--danger)',
            boxShadow: isActive ? '0 0 8px var(--success)' : 'none'
          }} />
          <span>{isActive ? 'LIVE WEBCAM' : 'OFFLINE'}</span>
        </div>
      </div>
    </div>
  );
}
