"""Inspect shadow probes or package the finished 24s sequence.

Run with the workspace Python (Pillow + numpy), passing the render directory.
Use --full after 720 frames exist. ffmpeg.exe is supplied with --ffmpeg.
"""
import argparse
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('directory',type=Path)
p.add_argument('--full',action='store_true')
p.add_argument('--ffmpeg',type=Path)
a = p.parse_args()
root = a.directory.resolve()
probe = root/'probe'
image = Image.open(probe/'frame_0001.png').convert('L')
data = np.asarray(image).astype(np.float32)
report = {'resolution':list(image.size),'white_max':int(data.max()),
          'white_fraction':float(np.mean(data==255)), 'minimum':int(data.min()),
          'intensity_preview':0.4,'wall_preview':'#f4efe9'}
for n in [2,360,720,721]:
    file = probe/f'frame_{n:04d}.png'
    if file.exists():
        diff = np.abs(np.asarray(Image.open(file).convert('L')).astype(float)-data)
        report[f'frame_1_to_{n}_mean_difference_8bit'] = float(diff.mean())
        report[f'frame_1_to_{n}_max_difference_8bit'] = float(diff.max())
if 'frame_1_to_721_max_difference_8bit' in report:
    report['exact_endpoint_match'] = report['frame_1_to_721_max_difference_8bit']==0
    report['endpoint_within_render_tolerance'] = (
        report['frame_1_to_721_max_difference_8bit']<=1 and
        report['frame_1_to_721_mean_difference_8bit']<0.001)
image.save(root/'shadow-poster.webp',lossless=True)
# Display-only composite. Wall colour and texture are never baked into the mask.
wall = np.array([244,239,233],dtype=np.float32)
rng = np.random.default_rng(41)
texture = rng.normal(0,0.35,data.shape).astype(np.float32)
warm = (0.6+0.4*data[:,:,None]/255)*(wall+texture[:,:,None])
Image.fromarray(np.uint8(np.clip(np.rint(warm),0,255))).save(root/'shadow-preview.png')
(root/'qa-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
if a.full:
    if not a.ffmpeg or not a.ffmpeg.is_file():
        raise RuntimeError('Supply a valid ffmpeg binary')
    frames = root/'frames'
    for n in range(1,721):
        with Image.open(frames/f'frame_{n:04d}.png') as im:
            im.load()
            assert im.size==(1920,1080)
    dest = root/'shadow-overlay.webm'
    subprocess.run([str(a.ffmpeg),'-y','-framerate','30','-start_number','1',
                    '-i',str(frames/'frame_%04d.png'),'-frames:v','720',
                    '-c:v','libvpx-vp9','-b:v','0','-crf','34','-pix_fmt','yuv420p',
                    '-an','-deadline','good','-cpu-used','2','-row-mt','1',str(dest)],check=True)
    report.update(video=str(dest),bytes=dest.stat().st_size,frames=720,fps=30,duration_seconds=24,
                  encoded_video_seam_verified=False,hardware_decode_verified=False)
    (root/'qa-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
