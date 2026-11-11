---
title: Converter
description: Convert images, audio and video with ffmpeg, on your own Holdall.
---

The converter turns a file into another format. It runs on your Holdall with ffmpeg: your files are never sent anywhere else.

## Convert a file

Either:

- in **Files**, choose **Convert** on a file, then the target format; or
- in **Converter**, **Choose a file to convert**, pick the target in **Convert to**, then **Convert**.

The new file appears next to the original. **Conversions** lists running and finished conversions; **Open in Files** shows the result.

## Formats

| From | To |
|---|---|
| Images | `png`, `jpg`, `webp`, `avif`, `gif`, `bmp`, `tiff` |
| Audio | `mp3`, `m4a`, `opus`, `ogg`, `wav`, `flac` |
| Video | `mp4`, `webm`, `mkv`, `mov`, animated `gif`, or any audio format above to keep only the sound |

Other kinds of files cannot be converted yet.

The conversion logic comes from [VERT](https://github.com/VERT-sh/VERT) (AGPL-3.0).
