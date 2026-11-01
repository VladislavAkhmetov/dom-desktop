"""Render only the approved B lighting study as a low resolution motion draft.

Run in background Blender with static-v3/B/shadow-static.blend.
24 seconds, 640x360: 6 rendered frames/s, interpolated to 24fps for review.
The approved full resolution blend is never overwritten.
"""
import bpy
import hashlib
import json
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'.cache/shadow-overlay/draft-B-r1'
FRAMES = OUT/'frames'
FRAMES.mkdir(parents=True,exist_ok=True)
STATUS = OUT/'status.json'
state = {'state':'starting','purpose':'motion_approval_only','variant':'B',
         'resolution':[640,360],'fps':24,'rendered_fps':6,'seconds':24,'total':144,
         'samples':16,'completed':0,'started_epoch':time.time()}

def status(**values):
    state.update(values)
    STATUS.write_text(json.dumps(state,indent=2),encoding='utf-8')

try:
    s = bpy.context.scene
    assert s.get('review_variant')=='B', 'Draft must use the approved B scene'
    source = Path(bpy.data.filepath)
    state['source_blend'] = str(source)
    state['source_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'CUDA'
    p.get_devices_for_type('CUDA')
    for d in p.devices:
        d.use = d.type=='CUDA'
    devices = [d.name for d in p.devices if d.use]
    assert devices, 'CUDA GPU required'
    s.cycles.device = 'GPU'
    s.cycles.samples = 16
    s.cycles.use_adaptive_sampling = False
    s.cycles.use_animated_seed = False
    s.cycles.use_denoising = True
    s.cycles.denoiser = 'OPENIMAGEDENOISE'
    if hasattr(s.cycles,'denoising_use_gpu'):
        s.cycles.denoising_use_gpu = True
    s.render.resolution_x,s.render.resolution_y = 640,360
    s.render.resolution_percentage = 100
    s.render.use_persistent_data = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'BW'
    s.render.image_settings.color_depth = '8'
    status(state='rendering',devices=devices)
    durations = []
    def render(frame,path):
        s.frame_set(frame)
        s.render.filepath = str(path)
        start = time.perf_counter()
        assert 'FINISHED' in bpy.ops.render.render(write_still=True)
        assert path.is_file()
        return time.perf_counter()-start
    for index,source_frame in enumerate(range(1,721,5),1):
        path = FRAMES/f'frame_{index:04d}.png'
        if not path.exists():
            status(current_source_frame=source_frame)
            durations.append(render(source_frame,path))
        status(completed=index,last_frame_seconds=durations[-1] if durations else None,
               estimated_remaining_seconds=(144-index)*sum(durations[-20:])/len(durations[-20:]) if durations else None)
    # Duplicate endpoint is diagnostic only, excluded from the delivered movie.
    render(721,OUT/'endpoint_0721.png')
    # Interpolation needs the endpoint as a look-ahead frame at t=24s.
    # The encoder trims it away from the delivered 24-second video.
    (FRAMES/'frame_0145.png').write_bytes((OUT/'endpoint_0721.png').read_bytes())
    assert hashlib.sha256(source.read_bytes()).hexdigest()==state['source_sha256']
    python = os.environ['SHADOW_PACKAGE_PYTHON']
    ffmpeg = os.environ['SHADOW_FFMPEG']
    status(state='encoding')
    with (OUT/'encode.log').open('w',encoding='utf-8') as log:
        subprocess.run([python,str(ROOT/'scripts/blender/package-shadow-draft.py'),
                        str(OUT),'--ffmpeg',ffmpeg],stdout=log,stderr=subprocess.STDOUT,
                       check=True,creationflags=0x08000000 if sys.platform=='win32' else 0)
    status(state='complete',finished_epoch=time.time(),video=str(OUT/'draft-B.mp4'))
except Exception:
    status(state='failed',error=traceback.format_exc())
    raise
