"""Static v4: soft broad blinds and a legible, nearer plant. No animation render.

Run against static-v3/B/shadow-static.blend. Saves a new scene and two 16-bit
plates for fixed white calibration, preserving the original B project.
"""
import bpy
import json
import math
import time
import traceback
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/shadow-overlay/static-v4-r3'
OUT.mkdir(parents=True,exist_ok=True)
state={'state':'starting','kind':'static_review','animation_authorized':False}
def status(**fields):
    state.update(fields)
    (OUT/'status.json').write_text(json.dumps(state,indent=2),encoding='utf-8')

try:
    s=bpy.context.scene
    assert s.get('review_variant')=='B'
    s.frame_set(1)
    p=bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type='CUDA'
    p.get_devices_for_type('CUDA')
    for d in p.devices:
        d.use=d.type=='CUDA'
    assert any(d.use for d in p.devices)
    s.cycles.device='GPU'
    s.cycles.samples=128
    s.cycles.use_denoising=True
    s.cycles.use_animated_seed=False
    if hasattr(s.cycles,'denoising_use_gpu'):
        s.cycles.denoising_use_gpu=True
    s.render.use_persistent_data=True
    s.render.resolution_x,s.render.resolution_y=1920,1080
    s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG'
    s.render.image_settings.color_mode='BW'
    s.render.image_settings.color_depth='16'
    s.view_settings.view_transform='Standard'
    s.view_settings.look='None'
    s.view_settings.exposure=-1.0
    # A constant indirect fill keeps the neutral wall stable. Only the sun's
    # shadow is allowed to vary: a huge world dome otherwise lets distant slats
    # darken the entire receiver through ambient occlusion.
    s.world.node_tree.nodes['Background'].inputs[1].default_value=0
    wall_bsdf=s.objects['Wall'].data.materials[0].node_tree.nodes.get('Principled BSDF')
    wall_bsdf.inputs['Emission Color'].default_value=(1,1,1,1)
    wall_bsdf.inputs['Emission Strength'].default_value=0.38

    slats=sorted([o for o in s.objects if o.name.startswith('Blind_')],key=lambda o:o.name)
    assert len(slats)==12 and all(len(o.data.vertices)==225 for o in slats)
    group=bpy.data.objects.new('Blind_composition_v4',None)
    s.collection.objects.link(group)
    for index,ob in enumerate(slats):
        ob.parent=group
        offset=(index-5.5)*0.66*0.25
        ob.location.x-=math.sin(math.radians(38))*offset
        ob.location.y+=math.cos(math.radians(38))*offset
        angle=math.radians(-8)
        ox=math.cos(angle)*ob.location.x-math.sin(angle)*ob.location.y
        oy=math.sin(angle)*ob.location.x+math.cos(angle)*ob.location.y
        def depth_at(x):
            return 0.55+0.12*math.log1p(math.exp((2.2-0.55*x)/0.12))
        # Ends follow a window-edge line on the wall. At this distance the sun
        # makes them dissolve gradually, leaving unshadowed space at the left.
        lo,hi=-7.0,7.0
        for _ in range(40):
            x=(lo+hi)/2
            z=ob.location.z+depth_at(x)
            sx=ox+math.cos(math.radians(30))*x-0.48*z
            sy=oy+math.sin(math.radians(30))*x-0.40*z
            if sx+0.3*sy<0.4: lo=x
            else: hi=x
        start=(lo+hi)/2
        for n,vertex in enumerate(ob.data.vertices):
            x=start+(8-start)*(n//9)/24
            # Broader slats, but much further from the receiving wall.
            t=vertex.co.y/0.24+0.5
            vertex.co.x=x
            vertex.co.y*=1.75
            vertex.co.z=depth_at(x)+0.035*math.sin(t*math.pi)
        ob.data.update()
    # Parent preserves baked local wind curves for a later approved animation.
    group.rotation_euler.z=math.radians(-8)

    branch=s.objects['Branch_wind']
    previous_depth=branch.location.z
    branch.location.z=0.32
    # Compensate sun projection so the plant stays in its existing screen area.
    branch.location.x-=0.48*(previous_depth-branch.location.z)
    branch.location.y-=0.40*(previous_depth-branch.location.z)
    for leaf in [o for o in s.objects if o.name.startswith('Ficus_leaf_')]:
        leaf.scale=(1.10,1.10,1.10)
    s['review_variant']='C_v4'
    s['animation_status']='PAUSED: rebalance static requires review'
    s['mask_calibration']='Divide rendered encoded luminance by the fixed median of white-plate.png; do not normalize each animation frame independently.'
    bpy.context.view_layer.update()
    s.render.filepath=str(OUT/'raw-shadow.png')
    bpy.data.libraries.write(str(OUT/'shadow-static-v4.blend'),{s},fake_user=True)
    settings={'sun_angle_degrees':math.degrees(s.objects['Sun'].data.angle),
              'slat_width_metres':0.42,'slat_minimum_local_depth_metres':0.55,
              'plant_root_depth_metres':0.32,'blind_rotation_degrees':30,
              'constant_indirect_fill':0.38,'window_shadow_edge':'x+0.3*y=0.4',
              'exposure':-1.0,'format':'16-bit grayscale PNG','samples':128,
              'output_intensity':0.4,'background_baked':False}
    (OUT/'settings.json').write_text(json.dumps(settings,indent=2),encoding='utf-8')
    status(state='rendering',pass_name='shadow')
    assert 'FINISHED' in bpy.ops.render.render(write_still=True)
    casters=[o for o in s.objects if o.type in {'MESH','CURVE'} and o.name!='Wall']
    for ob in casters:
        ob.hide_render=True
    status(pass_name='white_calibration')
    s.render.filepath=str(OUT/'white-plate.png')
    assert 'FINISHED' in bpy.ops.render.render(write_still=True)
    for ob in casters:
        ob.hide_render=False
    status(state='complete',finished_epoch=time.time())
except Exception:
    status(state='failed',error=traceback.format_exc())
    raise
