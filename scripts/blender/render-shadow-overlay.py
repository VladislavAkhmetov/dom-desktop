"""Resumable renderer for the saved shadow scene.

blender --background shadow-overlay-v1.blend --python render-shadow-overlay.py
Pass -- --full to render all 720 frames after reviewing the probes.
"""
import bpy
import json
import sys
import time
import traceback
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(bpy.data.filepath).parent
FULL = '--full' in sys.argv
DEST = OUT / ('frames' if FULL else 'probe')
DEST.mkdir(parents=True, exist_ok=True)
STATUS = OUT / ('render-status.json' if FULL else 'probe-status.json')
s = bpy.context.scene
state = {'state':'starting','mode':'full' if FULL else 'probe','completed':0,'started_epoch':time.time()}
def status(**fields):
    state.update(fields)
    STATUS.write_text(json.dumps(state,indent=2),encoding='utf-8')
try:
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'CUDA'
    p.get_devices_for_type('CUDA')
    for d in p.devices:
        d.use = d.type == 'CUDA'
    devices = [d.name for d in p.devices if d.use]
    if not devices:
        raise RuntimeError('No CUDA GPU found; refusing an unplanned CPU render')
    s.cycles.device = 'GPU'
    s.render.use_persistent_data = True
    frames = list(range(1,721)) if FULL else [1,2,360,720,721]
    times = []
    status(state='rendering',devices=devices,total=len(frames),samples=s.cycles.samples)
    for index,frame in enumerate(frames):
        dest = DEST / ('frame_%04d.png' % frame)
        if not dest.exists():
            s.frame_set(frame)
            s.render.filepath = str(dest)
            status(current_frame=frame)
            start = time.perf_counter()
            outcome = bpy.ops.render.render(write_still=True)
            if 'FINISHED' not in outcome or not dest.exists():
                raise RuntimeError('Render failed: ' + str(outcome))
            times.append(time.perf_counter()-start)
        status(completed=index+1,last_frame_seconds=times[-1] if times else None,
               estimated_remaining_seconds=(len(frames)-index-1)*sum(times)/len(times) if times else None)
    if FULL:
        python = os.environ.get('SHADOW_PACKAGE_PYTHON')
        ffmpeg = os.environ.get('SHADOW_FFMPEG')
        if python and ffmpeg:
            status(state='encoding',render_seconds=sum(times))
            with (OUT/'encode.log').open('w',encoding='utf-8') as log:
                subprocess.run([python,str(ROOT/'scripts/blender/package-shadow-overlay.py'),
                                str(OUT),'--full','--ffmpeg',ffmpeg],check=True,
                               stdout=log,stderr=subprocess.STDOUT,
                               creationflags=0x08000000 if sys.platform=='win32' else 0)
            status(video=str(OUT/'shadow-overlay.webm'))
        else:
            status(packaging='manual: SHADOW_PACKAGE_PYTHON and SHADOW_FFMPEG were not provided')
    status(state='complete',finished_epoch=time.time(),render_seconds=sum(times))
except Exception:
    status(state='failed',error=traceback.format_exc())
    raise
