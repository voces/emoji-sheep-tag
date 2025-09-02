## Convert from one format to another

ffmpeg -i sheep1.wav -ac 1 -map 0:a -filter:a loudnorm sheep1_format.mp3

## Analyze peak/mean audio

ffmpeg -i sheep1_format.mp3 -filter:a volumedetect -f null -

## Adjust loudness (target -10 to -15 db)

ffmpeg -i sheep1_format.mp3 -filter:a "volume=-0dB" sheep1.mp3

## Cut part

ffmpeg -ss 00:00:00 -i sheep1.mp3 -to 00:00:01 -c:a libmp3lame -q:a 2
sheep1_cut.mp3

ffmpeg -i treefall1.wav -ss 00:00:02.070 -to 00:00:04.000 -c:a pcm_s16le
treefall1_cut.wav
