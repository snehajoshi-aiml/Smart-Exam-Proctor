import { useEffect, useRef, useCallback } from 'react';

export function useSecurityControls({
  isActive = true,
  onViolation
}) {
  const violationCountsRef = useRef({
    tabSwitches: 0,
    copyPastes: 0,
    rightClicks: 0,
    devTools: 0
  });

  const triggerViolation = useCallback((type, severity, description) => {
    if (onViolation) {
      onViolation({
        type,
        severity,
        description,
        timestamp: new Date().toISOString()
      });
    }
  }, [onViolation]);

  useEffect(() => {
    if (!isActive) return;

    // 1. Tab Switch / Window Blur Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        violationCountsRef.current.tabSwitches++;
        triggerViolation(
          'tab_switch',
          'medium',
          `Tab switched or window minimized (Count: ${violationCountsRef.current.tabSwitches})`
        );
      }
    };

    // 2. Prevent Copy / Paste / Cut
    const handleCopy = (e) => {
      e.preventDefault();
      violationCountsRef.current.copyPastes++;
      triggerViolation(
        'copy_paste_attempt',
        'high',
        'Copy action attempt blocked during exam'
      );
    };

    const handlePaste = (e) => {
      e.preventDefault();
      violationCountsRef.current.copyPastes++;
      triggerViolation(
        'copy_paste_attempt',
        'high',
        'Paste action attempt blocked during exam'
      );
    };

    const handleCut = (e) => {
      e.preventDefault();
      triggerViolation(
        'copy_paste_attempt',
        'high',
        'Cut action attempt blocked during exam'
      );
    };

    // 3. Prevent Right-Click Context Menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      violationCountsRef.current.rightClicks++;
      triggerViolation(
        'right_click',
        'high',
        'Right-click context menu attempt blocked'
      );
    };

    // 4. Developer Tools Detection (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
    const handleKeyDown = (e) => {
      const isF12 = e.keyCode === 123;
      const isDevToolsCombo = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67);
      const isViewSourceCombo = (e.ctrlKey || e.metaKey) && e.keyCode === 85;

      if (isF12 || isDevToolsCombo || isViewSourceCombo) {
        e.preventDefault();
        violationCountsRef.current.devTools++;
        triggerViolation(
          'dev_tools',
          'high',
          'Developer tools or view-source shortcut attempt blocked'
        );
      }
    };

    // Attach Listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, triggerViolation]);

  return violationCountsRef.current;
}
