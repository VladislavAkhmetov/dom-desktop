"""Validate draft frames, encode review MP4 and neutral WebM, write local viewer."""
import argparse
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

p=argparse.ArgumentParser()
p.add_argument('directory',type=Path)
p.add_argument('--ffmpeg',required=True,type=Path)
a=p.parse_args()
root=a.directory.resolve()
frames=root/'frames'
previous=None
differences=[]
for n in range(1,145):
    with Image.open(frames/f'frame_{n:04d}.png') as im:
        assert im.size==(640,360)
        data=np.asarray(im.convert('L')).astype(np.float32)
    if n==1:
        first=data.copy()
        im.convert('RGB').save(root/'poster-mask.webp',lossless=True)
    if previous is not None:
        differences.append(float(np.abs(data-previous).mean()))
    previous=data
endpoint=np.asarray(Image.open(root/'endpoint_0721.png').convert('L')).astype(np.float32)
qa={'frames':576,'rendered_frames':144,'width':640,'height':360,'fps':24,'rendered_fps':6,'seconds':24,
    'interpolation':'linear crossfade between rendered frames, draft only',
    'frame_step_original_timeline':5,'seam_mean_difference_8bit':float(np.abs(first-data).mean()),
    'ordinary_step_median_8bit':float(np.median(differences)),
    'ordinary_step_max_8bit':float(max(differences)),
    'endpoint_mean_difference_8bit':float(np.abs(first-endpoint).mean()),
    'endpoint_max_difference_8bit':float(np.abs(first-endpoint).max()),
    'full_resolution_render_authorized':False}
assert qa['endpoint_mean_difference_8bit']<0.01
def ff(args):
    subprocess.run([str(a.ffmpeg),'-y','-hide_banner']+args,check=True)
inputs=['-framerate','6','-start_number','1','-i',str(frames/'frame_%04d.png'),'-t','24','-an']
# Beige is baked only into this convenient review MP4. The WebM remains neutral.
lut="framerate=fps=24:scene=100,format=rgb24,lutrgb=r='(0.6+0.4*val/255)*244':g='(0.6+0.4*val/255)*239':b='(0.6+0.4*val/255)*233'"
ff(inputs+['-vf',lut,'-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(root/'draft-B.mp4')])
ff(inputs+['-vf','framerate=fps=24:scene=100','-c:v','libvpx-vp9','-b:v','0','-crf','25','-deadline','good','-cpu-used','4','-row-mt','1','-pix_fmt','yuv420p',str(root/'mask-draft.webm')])
decode=subprocess.run([str(a.ffmpeg),'-v','error','-i',str(root/'draft-B.mp4'),'-f','framemd5','-'],check=True,capture_output=True,text=True)
qa['decoded_video_frames']=sum(1 for line in decode.stdout.splitlines() if line and not line.startswith('#'))
assert qa['decoded_video_frames']==576
qa['mp4_bytes']=(root/'draft-B.mp4').stat().st_size
qa['webm_bytes']=(root/'mask-draft.webm').stat().st_size
(root/'qa-report.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
(root/'review.html').write_text('''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Тени B — анимационный драфт</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eeece7;font:16px system-ui;color:#353732;padding:28px}main{max-width:1100px;margin:auto}h1{font-size:23px;font-weight:500}p{color:#666860}.frame{aspect-ratio:16/9;background:#f4efe9;border-radius:16px;overflow:hidden;isolation:isolate}video{width:100%;height:100%;display:block;mix-blend-mode:multiply;opacity:.4}.controls{display:flex;gap:24px;align-items:center;flex-wrap:wrap;padding:20px 0}label{display:flex;gap:10px;align-items:center}button{font:inherit;border:1px solid #d0d0c8;background:white;padding:10px 18px;border-radius:10px;cursor:pointer}input[type=range]{width:160px}small{font-size:14px;color:#65675e}</style>
<main><h1>Вариант B · движение теней</h1><p>Драфт для согласования: 24 секунды · 640 × 360 · 24 кадра/с с интерполяцией.</p>
<div class="frame" id="wall"><video id="video" src="mask-draft.webm" poster="poster-mask.webp" muted loop playsinline autoplay></video></div>
<div class="controls"><button id="play">Пауза</button><label>Стена <input id="color" type="color" value="#f4efe9"></label><label>Интенсивность <input id="intensity" type="range" min="0" max=".8" step=".01" value=".4"></label><button id="restart">С начала</button><span id="time">0 / 24 с</span></div>
<label>Позиция <input id="seek" type="range" min="0" max="24" step=".067" value="0" style="flex:1"></label><p><small>Согласуем темп, амплитуду и стык цикла. Финальный рендер остаётся на паузе.</small></p></main>
<script>const v=document.getElementById('video'),play=document.getElementById('play'),seek=document.getElementById('seek');play.onclick=()=>v.paused?v.play():v.pause();v.onplay=()=>play.textContent='Пауза';v.onpause=()=>play.textContent='Воспроизвести';document.getElementById('restart').onclick=()=>{v.currentTime=0;v.play()};document.getElementById('color').oninput=e=>document.getElementById('wall').style.backgroundColor=e.target.value;document.getElementById('intensity').oninput=e=>v.style.opacity=e.target.value;seek.oninput=()=>v.currentTime=+seek.value;v.ontimeupdate=()=>{seek.value=v.currentTime;document.getElementById('time').textContent=v.currentTime.toFixed(1)+' / 24 с'};document.addEventListener('visibilitychange',()=>{if(document.hidden)v.pause()});</script></html>''',encoding='utf-8')
print(json.dumps(qa))
