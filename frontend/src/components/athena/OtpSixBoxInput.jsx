import React, { useRef, useEffect } from 'react';

/**
 * 6-Box Separate Digit Input Component for Athena Smart Proctoring
 * Features: Auto-advance, backspace navigation, paste handling, aria support
 */
export default function OtpSixBoxInput({
  value = '',
  onChange,
  onComplete,
  disabled = false
}) {
  const inputsRef = useRef([]);

  // Convert value string to array of 6 digits
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    // Auto-focus first empty box or box 0 on mount
    if (!disabled && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (e, index) => {
    const val = e.target.value;
    // Extract last entered character if multiple
    const digit = val.replace(/[^0-9]/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    const newCombined = newDigits.join('');

    if (onChange) {
      onChange(newCombined);
    }

    // Auto-advance focus to next input if digit entered
    if (digit && index < 5 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1].focus();
    }

    // Trigger onComplete callback if all 6 filled
    if (newCombined.length === 6 && onComplete) {
      onComplete(newCombined);
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputsRef.current[index - 1]) {
        // Move back and clear previous box
        inputsRef.current[index - 1].focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        if (onChange) onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pastedData) return;

    if (onChange) {
      onChange(pastedData);
    }

    // Focus last filled box or box 5
    const targetIdx = Math.min(pastedData.length, 5);
    if (inputsRef.current[targetIdx]) {
      inputsRef.current[targetIdx].focus();
    }

    if (pastedData.length === 6 && onComplete) {
      onComplete(pastedData);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        margin: '20px 0'
      }}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          style={{
            width: '46px',
            height: '56px',
            fontSize: '1.6rem',
            fontWeight: '800',
            textAlign: 'center',
            borderRadius: '12px',
            border: digit ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.15)',
            backgroundColor: digit ? 'rgba(99, 102, 241, 0.12)' : 'rgba(15, 23, 42, 0.8)',
            color: '#34d399',
            outline: 'none',
            boxShadow: digit ? '0 0 12px rgba(99, 102, 241, 0.35)' : 'none',
            transition: 'all 0.2s ease-in-out',
            cursor: disabled ? 'not-allowed' : 'text'
          }}
        />
      ))}
    </div>
  );
}
