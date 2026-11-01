"""Build an independent, editable Cycles shadow scene; run inside Blender.

Output: .cache/shadow-overlay/v2/shadow-overlay-v1.blend.
No external models, textures or handlers are needed to reopen the saved scene.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache' / 'shadow-overlay' / 'v2'
OUT.mkdir(parents=True, exist_ok=True)
PERIOD = 720
rng = random.Random(1047)
scene = bpy.data.scenes.new('Dombro_Shadow_24s_v1')
bpy.context.window.scene = scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.cycles.use_animated_seed = False
scene.cycles.max_bounces = 4
scene.render.use_persistent_data = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = PERIOD
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'BW'
scene.render.image_settings.color_depth = '8'
scene.render.filepath = str(OUT / 'preview.png')
scene['loop_period_frames'] = PERIOD
scene['loop_endpoint'] = 721
scene['note'] = 'Frame 721 matches frame 1; export frames 1..720 only. Shadow casters hidden to camera rays only.'

devices = []
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices_for_type('CUDA')
    for d in prefs.devices:
        d.use = d.type == 'CUDA'
        if d.use:
            devices.append(d.name)
    if devices:
        scene.cycles.device = 'GPU'
except Exception as exc:
    devices = ['CPU: ' + str(exc)]

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

wall_collection = collection('01_Wall_and_camera')
blind_collection = collection('02_Curved_blinds')
plant_collection = collection('03_Ficus_branch')
light_collection = collection('04_Daylight')

def mesh_object(name, vertices, faces, col):
    data = bpy.data.meshes.new(name + '_mesh')
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    col.objects.link(ob)
    return ob

def material(name, value):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (value, value, value, 1)
    p.inputs['Roughness'].default_value = 1
    p.inputs['Specular IOR Level'].default_value = 0
    return m

white = material('Wall_matte_white', 1)
dark = material('Occluder_matte', 0.08)
wall = mesh_object('Wall', [(-10,-10,0),(10,-10,0),(10,10,0),(-10,10,0)], [(0,1,2,3)], wall_collection)
wall.data.materials.append(white)
camera_data = bpy.data.cameras.new('Orthographic_8m')
camera = bpy.data.objects.new('Camera', camera_data)
wall_collection.objects.link(camera)
camera.location = (0,0,10)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 8
scene.camera = camera
sun_data = bpy.data.lights.new('Sun_angular_radius', 'SUN')
sun = bpy.data.objects.new('Sun', sun_data)
light_collection.objects.link(sun)
sun.rotation_euler = Vector((-0.48,-0.4,-1)).to_track_quat('-Z','Y').to_euler()
sun_data.energy = 4.1
sun_data.angle = math.radians(5)
world = bpy.data.worlds.new('Soft_fill')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (1,1,1,1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.38
scene.world = world

def caster(ob):
    ob.visible_camera = False
    ob.data.materials.append(dark)

def loop_noise(frame, seed, rate=1):
    # Sample Perlin noise on a closed circle. Octaves add irregular detail;
    # the circular domain ensures both position and velocity match at wrap.
    a = 2 * math.pi * (frame - 1) / PERIOD
    v = Vector((math.cos(a)*rate, math.sin(a)*rate, seed))
    return noise.noise_vector(v, noise_basis='PERLIN_ORIGINAL') + 0.3 * noise.noise_vector(v*2.17, noise_basis='PERLIN_ORIGINAL')

def animate(ob, seed, amplitude, rate=1):
    base = ob.rotation_euler.copy()
    for frame in range(-5, PERIOD+8, 3):
        n = loop_noise(frame, seed, rate)
        ob.rotation_euler = (base.x+amplitude*n.x, base.y+amplitude*n.y, base.z+amplitude*n.z)
        ob.keyframe_insert(data_path='rotation_euler', frame=frame)

# Slats form a diagonal frame on the right, leaving the left half quieter.
for i in range(12):
    verts, faces = [], []
    for n in range(25):
        x = -7 + n*15/24
        for j in range(9):
            t = j/8
            verts.append((x,(t-0.5)*0.24,1.8-0.23*x+0.035*math.sin(t*math.pi)))
    for n in range(24):
        for j in range(8):
            a = n*9+j
            faces.append((a,a+1,a+10,a+9))
    ob = mesh_object('Blind_%02d' % (i+1),verts,faces,blind_collection)
    ob.location = (0.1+(i-5)*-0.38, -4+(i)*0.54, 0.85+0.035*i)
    ob.rotation_euler = (0,0,math.radians(38))
    caster(ob)
    thickness = ob.modifiers.new('Slat_thickness','SOLIDIFY')
    thickness.thickness = 0.012
    animate(ob, 2+i*0.1, 0.008, 0.45)

root = bpy.data.objects.new('Branch_wind',None)
plant_collection.objects.link(root)
root.location = (4.5,-2.6,0.47)
animate(root, 34, 0.032, 1.25)

def stem(name, points, radius):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 3
    data.resolution_u = 12
    s = data.splines.new('BEZIER')
    s.bezier_points.add(len(points)-1)
    for bp,co in zip(s.bezier_points,points):
        bp.co = co
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name,data)
    plant_collection.objects.link(ob)
    ob.parent = root
    caster(ob)
    return ob

stem('Main_branch',[(0,0,0),(-0.43,0.8,0.04),(-0.74,1.8,0.10),(-1.05,2.8,0.18),(-1.55,3.85,0.15)],0.015)
for k in range(15):
    t = (k+0.7)/15
    y = t*3.8
    x = -0.27*y-0.022*y*y
    side = -1 if k%2 else 1
    length = rng.uniform(0.35,0.65)
    base = Vector((x,y,0.11*t))
    petiole_end = base + Vector((side*0.18,0.13,rng.uniform(-0.09,0.12)))
    stem('Petiole_%02d'%k,[base,(base+petiole_end)*0.5,petiole_end],0.004)
    vertices = []
    for j in range(13):
        u = j/12
        width = math.sin(math.pi*u)**0.9 * length * 0.24
        for q in [-1,0,1]:
            vertices.append((length*u,q*width,0.07*math.sin(math.pi*u)+0.035*abs(q)*math.sin(math.pi*u)))
    faces = [(j*3+q,j*3+q+1,(j+1)*3+q+1,(j+1)*3+q) for j in range(12) for q in range(2)]
    leaf = mesh_object('Ficus_leaf_%02d'%k,vertices,faces,plant_collection)
    leaf.parent = root
    leaf.location = petiole_end
    leaf.rotation_euler = (rng.uniform(-0.4,0.4),rng.uniform(-0.25,0.3),rng.uniform(0.45,1.0) if side>0 else rng.uniform(2.2,2.8))
    caster(leaf)
    animate(leaf, 70+k*2.5, 0.06, 2.4)

scene.frame_set(1)
# Verify the baked animation repeats at frame 721, excluding that duplicate
# endpoint from exported video.
scene.frame_set(1)
start = {o.name: tuple(o.rotation_euler) for o in scene.objects if o.animation_data}
scene.frame_set(721)
error = max(abs(a-b) for o in scene.objects if o.name in start for a,b in zip(o.rotation_euler,start[o.name]))
scene.frame_set(1)
report = {'scene':scene.name,'devices':devices,'frames':PERIOD,'fps':30,'duration_seconds':24,'resolution':[1920,1080],'samples':96,'rotation_seam_error_radians':error,'objects':len(scene.objects),'status':'scene_built'}
(OUT/'scene-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.data.libraries.write(str(OUT/'shadow-overlay-v1.blend'), {scene}, fake_user=True)
print(json.dumps(report))
# Preview render is launched separately to keep the UI/tool responsive.
