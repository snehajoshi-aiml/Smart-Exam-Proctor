/**
 * faceModelLoader.js
 * Centralized face-api.js model loader with safety guards and graceful error handling.
 * All inference components MUST call ensureModelsLoaded() before running detections.
 */

let faceapi = null;
let modelsLoaded = false;
let modelsLoading = false;
let loadPromise = null;
let loadError = null;

const MODEL_URL = '/models';

// Required model files - used for presence verification
const REQUIRED_MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

/**
 * Check which model files are present by fetching their manifests
 * Returns { present: [], missing: [] }
 */
export async function checkModelFiles() {
  const manifestFiles = [
    `${MODEL_URL}/tiny_face_detector_model-weights_manifest.json`,
    `${MODEL_URL}/face_landmark_68_model-weights_manifest.json`,
    `${MODEL_URL}/face_recognition_model-weights_manifest.json`,
  ];

  const results = await Promise.allSettled(
    manifestFiles.map((url) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json().then((j) => ({ url, ok: true, data: j }));
      })
    )
  );

  const present = [];
  const missing = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value.ok) {
      present.push(manifestFiles[i]);
    } else {
      missing.push(manifestFiles[i]);
    }
  });

  return { present, missing };
}

/**
 * Dynamically import face-api.js (avoids import-time errors if package missing)
 */
async function importFaceApi() {
  if (faceapi) return faceapi;
  try {
    const module = await import('@vladmandic/face-api');
    faceapi = module;
    return faceapi;
  } catch (err) {
    throw new Error(`@vladmandic/face-api package not found.\n${err.message}`);
  }
}

/**
 * Main model loader - loads all required face-api.js nets.
 * Safe to call multiple times; only loads once.
 * @returns {Promise<{ success: boolean, faceapi: object|null, error: string|null }>}
 */
export async function loadFaceModels() {
  // Already loaded
  if (modelsLoaded && faceapi) {
    return { success: true, faceapi, error: null };
  }

  // Already loading - wait for existing promise
  if (modelsLoading && loadPromise) {
    return loadPromise;
  }

  // Previous load failed - return cached error
  if (loadError) {
    return { success: false, faceapi: null, error: loadError };
  }

  modelsLoading = true;

  loadPromise = (async () => {
    try {
      console.log('🔄 Loading face models...');

      // Step 1: Import face-api.js package
      const api = await importFaceApi();

      // Step 2: Check if models are reachable before loading
      const { missing } = await checkModelFiles();
      if (missing.length > 0) {
        const warnMsg = `⚠️ Missing model files: ${missing.join(', ')}. Some features will be disabled.`;
        console.warn(warnMsg);
        // Continue anyway - face-api will throw on load if files are missing/empty
      }

      // Step 3: Load all model nets in parallel
      console.log('📦 Loading face model weights from /models...');
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        api.nets.faceExpressionNet.loadFromUri(MODEL_URL).catch((e) => {
          console.warn('⚠️ faceExpressionNet not loaded (optional):', e.message);
        }),
      ]);

      // Step 4: Verify critical models are actually loaded
      if (!api.nets.tinyFaceDetector.isLoaded) {
        throw new Error('TinyFaceDetector failed to load. Check model files in /public/models/');
      }
      if (!api.nets.faceLandmark68Net.isLoaded) {
        throw new Error('FaceLandmark68Net failed to load. Check model files in /public/models/');
      }
      if (!api.nets.faceRecognitionNet.isLoaded) {
        throw new Error('FaceRecognitionNet failed to load. Check model files in /public/models/');
      }

      modelsLoaded = true;
      modelsLoading = false;
      faceapi = api;

      console.log('✅ Face models loaded successfully');
      return { success: true, faceapi: api, error: null };
    } catch (err) {
      const errMsg = `❌ Failed to load face models: ${err.message}`;
      console.error(errMsg, err);
      loadError = errMsg;
      modelsLoading = false;
      modelsLoaded = false;
      return { success: false, faceapi: null, error: errMsg };
    }
  })();

  return loadPromise;
}

/**
 * Ensure models are loaded - same as loadFaceModels() but named for clarity in components
 */
export async function ensureModelsLoaded() {
  return loadFaceModels();
}

/**
 * Returns true if models are currently loaded
 */
export function areModelsLoaded() {
  return modelsLoaded && faceapi !== null;
}

/**
 * Returns the face-api.js instance (null if not loaded)
 */
export function getFaceApi() {
  return faceapi;
}

/**
 * Safety check to run before any inference:
 * - Models must be loaded
 * - TinyFaceDetector must be ready
 * - Video element must be ready
 */
export function canRunInference(videoRef) {
  if (!modelsLoaded || !faceapi) return false;
  if (!faceapi.nets.tinyFaceDetector.isLoaded) return false;
  const video = videoRef?.current;
  if (!video || video.paused || video.ended || video.readyState < 2) return false;
  if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) return false;
  return true;
}


/**
 * Reset state (for testing/dev purposes only)
 */
export function _resetModelsState() {
  modelsLoaded = false;
  modelsLoading = false;
  loadPromise = null;
  loadError = null;
  faceapi = null;
}
