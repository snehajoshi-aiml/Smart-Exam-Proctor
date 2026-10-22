# Smart Proctoring System - Project Rules & Requirements

## Database
- **Database:** MongoDB
- **Schema Integrity:** Never remove existing MongoDB schemas.

## Face Verification
- **Enrollment Frames:** Store 30 enrollment frames.
- **Verification Rule:** Minimum 20 out of 30 matching frames.
- **Threshold Policy:** Do not use distance thresholds.
- **Camera Distance:** Allow verification from longer camera distances.

## Cheating Detection
- **eye movement >10 sec**
- **Multiple Faces Detection**
- **Phone Detection**
- **Tab Switching Detection**
- **Audio Anomaly Detection**
