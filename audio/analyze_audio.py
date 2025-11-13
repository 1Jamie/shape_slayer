
import os
import glob
import json
import librosa
import numpy as np
import warnings

# Suppress UserWarning from librosa about audioread
warnings.filterwarnings('ignore', category=UserWarning, module='librosa')

def estimate_feel(features):
    """
    Estimates the feel of a track based on its audio features.
    This is a heuristic model and may not always be accurate.
    """
    bpm = features['tempo_bpm']
    energy = features['avg_rms_energy']
    brightness = features['avg_spectral_centroid_hz']

    # --- Heuristic Rules ---
    if bpm > 140 and brightness > 2500:
        return "Energetic / Intense"
    elif bpm > 120 and energy > 0.1:
        return "Upbeat / Driving"
    elif bpm < 100 and brightness < 1800:
        return "Calm / Ambient"
    elif energy < 0.08 and bpm < 120:
        return "Mysterious / Tense"
    
    # Default categories
    if bpm > 120:
        return "Standard Action"
    else:
        return "Mid-tempo / Neutral"


def analyze_audio_files():
    """
    Analyzes all MP3 files in the 'normalized' directory and extracts
    musical features, including an estimated "feel".
    """
    current_dir = os.getcwd()
    normalized_dir = os.path.join(current_dir, "normalized")
    analysis_output_file = os.path.join(current_dir, "audio_analysis.json")

    if not os.path.exists(normalized_dir):
        print("The 'normalized' directory does not exist. Please run the normalization script first.")
        return

    audio_files = glob.glob(os.path.join(normalized_dir, "*.mp3"))

    if not audio_files:
        print("No MP3 files found in the 'normalized' directory.")
        return

    print(f"Found {len(audio_files)} MP3 files to analyze in '{normalized_dir}'.")

    analysis_results = {}

    for audio_file in audio_files:
        try:
            print(f"Analyzing {os.path.basename(audio_file)}...")
            
            # Load audio file
            y, sr = librosa.load(audio_file, sr=None)

            # --- Feature Extraction ---
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            rms = librosa.feature.rms(y=y)[0]
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
            zcr = librosa.feature.zero_crossing_rate(y)[0]

            # Store results
            file_basename = os.path.basename(audio_file)
            features = {
                "tempo_bpm": float(round(tempo, 2)),
                "avg_rms_energy": float(round(np.mean(rms), 4)),
                "avg_spectral_centroid_hz": float(round(np.mean(spectral_centroid), 2)),
                "avg_spectral_bandwidth_hz": float(round(np.mean(spectral_bandwidth), 2)),
                "avg_zero_crossing_rate": float(round(np.mean(zcr), 4))
            }
            
            # Estimate the feel
            features["estimated_feel"] = estimate_feel(features)
            
            analysis_results[file_basename] = features

        except Exception as e:
            print(f"Error analyzing {os.path.basename(audio_file)}: {e}")

    # Save results to JSON file
    with open(analysis_output_file, 'w') as f:
        json.dump(analysis_results, f, indent=4)

    print(f"\nAnalysis complete. Results saved to {analysis_output_file}")

    # Print a summary table
    print("\n--- Audio Analysis Summary ---")
    print(f"{'Filename':<45} | {'Est. Feel':<20} | {'BPM':<8} | {'Energy':<8} | {'Brightness (Hz)':<18}")
    print("-" * 120)

    # Sort by BPM for a start
    sorted_results = sorted(analysis_results.items(), key=lambda item: item[1]['tempo_bpm'], reverse=True)

    for filename, features in sorted_results:
        print(
            f"{filename:<45} | "
            f"{features['estimated_feel']:<20} | "
            f"{features['tempo_bpm']:<8.2f} | "
            f"{features['avg_rms_energy']:<8.4f} | "
            f"{features['avg_spectral_centroid_hz']:<18.2f}"
        )

if __name__ == "__main__":
    analyze_audio_files()
