"""
Pre-downloads and prunes buffalo_s for InsightFace during build step.
Keeps only det_500m.onnx (2.5MB) and w600k_mbf.onnx (13.6MB) to ensure
the runtime memory footprint is strictly under 50MB on Render's 512MB RAM tier.
"""
import os
import sys

def main():
    print("[AI] Pre-downloading InsightFace buffalo_s models...")
    root_dir = os.environ.get("INSIGHTFACE_ROOT", os.path.expanduser("~/.insightface"))
    os.makedirs(root_dir, exist_ok=True)
    try:
        from insightface.utils.storage import download
        model_dir = download('models', 'buffalo_s', force=False, root=root_dir)
        print(f"[AI] Downloaded buffalo_s to: {model_dir}")

        unneeded = ['1k3d68.onnx', '2d106det.onnx', 'genderage.onnx']
        for fname in unneeded:
            fpath = os.path.join(model_dir, fname)
            if os.path.exists(fpath):
                os.remove(fpath)
                print(f"[AI] Removed heavy unneeded model {fname} to conserve RAM.")

        remaining = os.listdir(model_dir)
        print(f"[AI] Prepared lightweight models for Render: {remaining}")
    except Exception as e:
        print(f"[AI] Pre-download warning: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
