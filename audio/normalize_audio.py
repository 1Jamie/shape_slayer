
import os
import glob
from ffmpeg_normalize import FFmpegNormalize

def normalize_audio_files():
    """
    Normalizes all MP3 files in the current directory and places them
    in a 'normalized' subdirectory.
    """
    current_dir = os.getcwd()
    output_dir = os.path.join(current_dir, "normalized")

    # Create the output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Find all MP3 files in the current directory
    audio_files = glob.glob("*.mp3")

    if not audio_files:
        print("No MP3 files found in the current directory.")
        return

    print(f"Found {len(audio_files)} MP3 files to normalize.")

    # Set up the normalizer
    normalizer = FFmpegNormalize(
        target_level=-14.0,  # Target loudness in LUFS
        progress=True,
        audio_codec='libmp3lame',
        output_format='mp3'
    )

    # Normalize each file
    for audio_file in audio_files:
        print(f"Normalizing {audio_file}...")
        try:
            normalizer.add_media_file(audio_file, os.path.join(output_dir, audio_file))
        except Exception as e:
            print(f"Error adding {audio_file} to the normalization batch: {e}")

    try:
        normalizer.run_normalization()
        print("\nAll audio files have been normalized and saved in the 'normalized' directory.")
    except Exception as e:
        print(f"An error occurred during normalization: {e}")
        print("Please ensure you have a recent version of ffmpeg installed and in your system's PATH.")

if __name__ == "__main__":
    normalize_audio_files()
