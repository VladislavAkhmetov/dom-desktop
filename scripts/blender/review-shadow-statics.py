"""Render two static lighting studies. Never starts animation rendering.

Open the v2 blend file in background Blender and execute this script.
Each variant is saved separately, preserving the v2 scene and its frames.
"""
import bpy
import math
import json
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache' / 'shadow-overlay' / 'static-v3'
OUT.mkdir(parents=True, exist_ok=True)
status_path = OUT/'status.json'
state = {'state':'starting','kind':'static_review','animation_authorized':False}
def status(**fields):
    state.update(fields)
    status_path.write_text(json.dumps(state,indent=2),encoding='utf-8')

try:
    s = bpy.context.scene
    assert s.name.startswith('Dombro_Shadow'), s.name
    s.frame_set(1)
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices_for_type('CUDA')
    for d in prefs.devices:
        d.use = d.type == 'CUDA'
    devices = [d.name for d in prefs.devices if d.use]
    assert devices, 'CUDA GPU required for this render'
    s.cycles.device = 'GPU'
    s.cycles.samples = 128
    s.cycles.use_animated_seed = False
    s.cycles.use_denoising = True
    s.render.use_persistent_data = True
    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    sun = s.objects['Sun']
    branch = s.objects['Branch_wind']
    slats = sorted([o for o in s.objects if o.name.startswith('Blind_')],key=lambda o:o.name)
    assert len(slats)==12
    assert all(len(o.data.vertices)==225 for o in slats)
    # Copy original mesh coordinates once, so variants do not accumulate edits.
    base_meshes = {o.name:[v.co.copy() for v in o.data.vertices] for o in slats}
    leaves = [o for o in s.objects if o.name.startswith('Ficus_leaf_')]
    base_leaf_z = {o.name:o.location.z for o in leaves}
    variants = [
        {'id':'A','name':'Progressive','sun_angle_degrees':8.5,'depth_slope':0.88,'depth_intercept':3.5,'branch_depth':1.03},
        {'id':'B','name':'Diffuse','sun_angle_degrees':12.0,'depth_slope':1.02,'depth_intercept':3.8,'branch_depth':1.30},
    ]
    status(state='rendering',devices=devices,completed=0,total=2)
    for index,v in enumerate(variants):
        folder = OUT/v['id']
        (folder/'probe').mkdir(parents=True,exist_ok=True)
        sun.data.angle = math.radians(v['sun_angle_degrees'])
        branch.location.z = v['branch_depth']
        # The slats recede along their long axis. At the right edge they are
        # near the receiver; towards the left they are several metres away.
        # This physically broadens the penumbra until the individual bars dissolve.
        for ob in slats:
            for vertex,co in zip(ob.data.vertices,base_meshes[ob.name]):
                profile_bulge = co.z-(1.8-0.23*co.x)
                # Smooth minimum avoids a kink in the editable slat profile.
                depth = v['depth_intercept']-v['depth_slope']*co.x
                z = 0.12 + 0.12*math.log1p(math.exp((depth-0.12)/0.12))
                vertex.co.z = z+profile_bulge
            ob.data.update()
        # Variation in leaf depth gives different softness within the branch.
        for i,leaf in enumerate(sorted(leaves,key=lambda o:o.name)):
            leaf.location.z = base_leaf_z[leaf.name]+0.10*math.sin(i*1.7)
        s['review_variant'] = v['id']
        s['animation_status'] = 'PAUSED: static approval required'
        s.render.filepath = str(folder/'probe'/'frame_0001.png')
        bpy.context.view_layer.update()
        bpy.data.libraries.write(str(folder/'shadow-static.blend'),{s},fake_user=True)
        (folder/'settings.json').write_text(json.dumps(v,indent=2),encoding='utf-8')
        status(current_variant=v['id'])
        start = time.perf_counter()
        result = bpy.ops.render.render(write_still=True)
        assert 'FINISHED' in result
        status(completed=index+1,last_render_seconds=time.perf_counter()-start)
    status(state='complete',finished_epoch=time.time())
except Exception:
    status(state='failed',error=traceback.format_exc())
    raise
