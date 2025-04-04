# Analyze peak/mean audio

ffmpeg -i click4.mp3 -filter:a volumedetect -f null -

# Convert from one format to another

ffmpeg -i click4.wav -ac 1 -map 0:a -filter:a loudnorm click4.mp3

# Adjust loudness

ffmpeg -i click4.mp3 -filter:a "volume=-6dB" click4_quieter.mp3
