"""Build Halo's Tesla models in Blender (headless) and export them as glTF.

Usage: python build_car.py -- <model 3|Y> <out.glb> [preview.png]

Blender axes: X = width (right +), Y = length (nose toward +Y), Z = up.
The glTF exporter turns that into three.js axes with the nose toward -Z.
Everything is generated from the profiles below: no imported meshes or textures.
"""
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# ---------------------------------------------------------------- profiles (metres)
# s runs from the nose (0) to the tail (L); y is height. Published dimensions, my curves.
SPECS = {
    "3": dict(
        L=4.694, track=1.58, axleF=0.87, wb=2.875, tR=0.334, tW=0.235, ghFrom=1.28, ghTo=4.12,
        top=[(0, 0.52), (0.04, 0.61), (0.12, 0.68), (0.45, 0.765), (0.95, 0.875), (1.2, 0.93), (1.28, 0.95), (1.6, 1.14), (1.9, 1.31), (2.2, 1.41),
             (2.5, 1.443), (2.85, 1.43), (3.3, 1.34), (3.75, 1.17), (4.12, 1.02), (4.4, 0.997), (4.52, 0.995), (4.6, 0.975), (4.66, 0.95), (4.694, 0.93)],
        bot=[(0, 0.4), (0.04, 0.31), (0.14, 0.24), (0.35, 0.21), (0.9, 0.18), (3.7, 0.18), (4.2, 0.23), (4.5, 0.31), (4.64, 0.35), (4.694, 0.37)],
        belt=[(0, 0.5), (0.08, 0.6), (0.45, 0.745), (0.95, 0.86), (1.28, 0.945), (2.5, 0.99), (3.6, 1.0), (4.12, 1.0), (4.45, 0.975), (4.6, 0.93), (4.694, 0.9)],
        plan=[(0, 0), (0.008, 0.3), (0.03, 0.5), (0.1, 0.7), (0.3, 0.84), (0.7, 0.905), (0.9, 0.915), (1.6, 0.9), (2.6, 0.9), (3.4, 0.918),
              (3.75, 0.925), (4.2, 0.9), (4.4, 0.86), (4.55, 0.78), (4.63, 0.66), (4.67, 0.52), (4.69, 0.28), (4.694, 0)],
        lampY=0.88, doors=(1.55, 2.6, 3.46), hoodS=1.2, deckS=4.16, dlo=(3.86, 3.45), rgw=(0.5, 0.6)),
    "Y": dict(
        L=4.751, track=1.64, axleF=0.9, wb=2.89, tR=0.356, tW=0.255, ghFrom=1.45, ghTo=4.28,
        top=[(0, 0.6), (0.04, 0.7), (0.12, 0.77), (0.45, 0.86), (0.95, 0.97), (1.3, 1.05), (1.45, 1.085), (1.8, 1.33), (2.1, 1.53),
             (2.5, 1.62), (2.95, 1.615), (3.45, 1.55), (3.95, 1.36), (4.28, 1.17), (4.48, 1.14), (4.58, 1.13), (4.67, 1.1), (4.72, 1.06), (4.751, 1.02)],
        bot=[(0, 0.46), (0.04, 0.36), (0.14, 0.27), (0.35, 0.24), (0.9, 0.21), (3.75, 0.21), (4.25, 0.27), (4.55, 0.36), (4.7, 0.42), (4.751, 0.44)],
        belt=[(0, 0.56), (0.08, 0.68), (0.45, 0.83), (0.95, 0.96), (1.45, 1.075), (2.5, 1.1), (3.75, 1.12), (4.28, 1.12), (4.5, 1.1), (4.66, 1.05), (4.751, 1.0)],
        plan=[(0, 0), (0.008, 0.32), (0.03, 0.52), (0.1, 0.73), (0.3, 0.87), (0.7, 0.94), (0.9, 0.952), (1.6, 0.935), (2.6, 0.935), (3.4, 0.955),
              (3.8, 0.962), (4.25, 0.935), (4.45, 0.9), (4.6, 0.82), (4.68, 0.7), (4.725, 0.54), (4.747, 0.28), (4.751, 0)],
        lampY=1.0, doors=(1.66, 2.68, 3.56), hoodS=1.36, deckS=4.3, dlo=(4.0, 3.62), rgw=(0.55, 0.64)),
}


def spline(pts):
    """Monotone cubic (Fritsch-Carlson) through pts: smooth and never overshoots."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; n = len(pts)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [0.0] * n; m[0] = d[0]; m[-1] = d[-1]
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0: m[i] = m[i + 1] = 0.0; continue
        a, b = m[i] / d[i], m[i + 1] / d[i]; h = a * a + b * b
        if h > 9: t = 3 / math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]

    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        k = 0
        while x > xs[k + 1]: k += 1
        hh = xs[k + 1] - xs[k]; t = (x - xs[k]) / hh; t2 = t * t; t3 = t2 * t
        return (2*t3 - 3*t2 + 1) * ys[k] + (t3 - 2*t2 + t) * hh * m[k] + (-2*t3 + 3*t2) * ys[k + 1] + (t3 - t2) * hh * m[k + 1]
    return f


class Car:
    def __init__(self, S):
        self.S = S; self.L = S["L"]
        self.top, self.bot, self._belt, self.plan = (spline(S[k]) for k in ("top", "bot", "belt", "plan"))

    def belt(self, s): return min(max(self._belt(s), self.bot(s)), self.top(s))
    def gh(self, s): return self.S["ghFrom"] < s < self.S["ghTo"]

    def section(self, s):
        """Right half of the cross-section at s, underbody centre to roof centre; index where the greenhouse starts."""
        w, yb, yt, yl = self.plan(s), self.bot(s), self.top(s), self.belt(s)
        gh = self.gh(s); ym = yb + 0.55 * (yl - yb)
        pts = [(0.0, yb), (w * 0.25, yb), (w * 0.5, yb)]

        def quad(ax, ay, bx, by, n, steps, flip):
            for i in range(1, steps + 1):
                t = i / steps * math.pi / 2
                c = math.cos(t) ** (2 / n); sn = math.sin(t) ** (2 / n)
                pts.append((bx + (ax - bx) * c, ay + (by - ay) * sn) if flip else (ax + (bx - ax) * sn, by - (by - ay) * c))
        quad(w * 0.78, yb, w, ym, 2.6, 9, False)
        quad(w, ym, w * 0.95, yl, 2.0, 7, True)
        g0 = len(pts)
        wg = w * (0.885 if gh else 0.94)
        pts.append((wg, yl + 0.008))
        quad(wg, yl + 0.008, 0.0, max(yt, yl + 0.01), 2.7 if gh else 4.5, 18, True)
        pts[2] = (min(pts[2][0], pts[3][0] - 1e-4), yb)
        return pts, g0


# ---------------------------------------------------------------- materials
def mat(name, color, metal=0.0, rough=0.5, emit=None, emit_strength=0.0, coat=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if coat:
        b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = 0.03
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = emit_strength
    return m


def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MATS = {}
def materials():
    MATS.update(
        Paint=mat("Paint", srgb("#EEEDE9"), 0.15, 0.28, coat=1.0),
        Glass=mat("Glass", srgb("#07090c"), 0.3, 0.04, coat=1.0),
        Trim=mat("Trim", srgb("#0e0f11"), 0.1, 0.55),
        Gap=mat("Gap", srgb("#050506"), 0.0, 0.9),
        TailLens=mat("TailLens", srgb("#3a0508"), 0.1, 0.08, emit=srgb("#500000"), emit_strength=0.4, coat=1.0),
        TailLight=mat("TailLight", srgb("#400000"), 0.0, 0.3, emit=srgb("#ff0808"), emit_strength=1.0),
        HeadLens=mat("HeadLens", srgb("#1b1d21"), 0.6, 0.08, coat=1.0),
        HeadLight=mat("HeadLight", srgb("#8a8d92"), 0.4, 0.2, emit=(1, 1, 1), emit_strength=1.1),
        Plate=mat("Plate", srgb("#dedfe0"), 0.0, 0.6),
        Tyre=mat("Tyre", srgb("#0d0d0e"), 0.0, 0.85),
        Rim=mat("Rim", srgb("#2f3237"), 0.9, 0.3, coat=0.6),
        RimAero=mat("RimAero", srgb("#9aa0a6"), 0.8, 0.28, coat=0.5),
        Disc=mat("Disc", srgb("#6b6e73"), 0.9, 0.35),
        Caliper=mat("Caliper", srgb("#24262a"), 0.3, 0.5),
        Camera=mat("Camera", srgb("#050608"), 0.2, 0.05, coat=1.0),
    )


# ---------------------------------------------------------------- body shell
PAINT, GLASS, TRIM = 0, 1, 2

def body_mesh(car, NS=150):
    S, L = car.S, car.L
    bm = bmesh.new(); rings = []
    for k in range(NS + 1):
        s = L * (0.5 - 0.5 * math.cos(math.pi * k / NS))
        pts, g0 = car.section(s)
        half = [Vector((x, L / 2 - s, y)) for x, y in pts]
        ring = half + [Vector((-v.x, v.y, v.z)) for v in reversed(half[1:-1])]
        rings.append(([bm.verts.new(v) for v in ring], g0, len(half), car.gh(s)))
    M = len(rings[0][0])
    for k in range(NS):
        a, g0, J, gh0 = rings[k]; b, _, _, gh1 = rings[k + 1]
        for m in range(M):
            m2 = (m + 1) % M
            try: f = bm.faces.new((a[m], b[m], b[m2], a[m2]))
            except ValueError: continue
            j = min(m if m < J else 2 * J - 2 - m, m2 if m2 < J else 2 * J - 2 - m2)
            if gh0 and gh1 and j >= g0 + 1: f.material_index = GLASS
            elif gh0 and gh1 and j >= g0 - 1: f.material_index = TRIM          # black window surround
            elif j <= 1: f.material_index = TRIM                               # underbody
            else: f.material_index = PAINT
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Body"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("Body", me); bpy.context.scene.collection.objects.link(ob)
    for n in ("Paint", "Glass", "Trim"): me.materials.append(MATS[n])
    for p in me.polygons: p.use_smooth = True
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def boolean(ob, cutter, op="DIFFERENCE"):
    m = ob.modifiers.new("b", "BOOLEAN"); m.operation = op; m.object = cutter; m.solver = "EXACT"
    m.material_mode = "TRANSFER"
    apply_mods(ob); bpy.data.objects.remove(cutter)


def cylinder_cutter(name, r, x0, x1, y, z, segs=72):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=abs(x1 - x0))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    bmesh.ops.translate(bm, verts=bm.verts, vec=((x0 + x1) / 2, y, z))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(MATS["Trim"])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob


# ---------------------------------------------------------------- projecting onto the body
class Projector:
    def __init__(self, body):
        dg = bpy.context.evaluated_depsgraph_get()
        self.bvh = BVHTree.FromObject(body, dg); self.L = None

    def hit(self, origin, direction):
        loc, nor, idx, dist = self.bvh.ray_cast(Vector(origin), Vector(direction), 10.0)
        return (loc, nor) if loc is not None else (None, None)


def ray_for(view, u, v, L):
    """2D view coordinates -> ray. rear/front: (x, height); side: (s from nose, height), right side; top: (x, s)."""
    if view == "rear": return (u, -L / 2 - 1.0, v), (0, 1, 0)
    if view == "front": return (u, L / 2 + 1.0, v), (0, -1, 0)
    if view == "side": return (1.6, L / 2 - u, v), (-1, 0, 0)
    if view == "sideL": return (-1.6, L / 2 - u, v), (1, 0, 0)
    if view == "top": return (u, L / 2 - v, 3.0), (0, 0, -1)
    raise ValueError(view)


def resample(poly, step, closed=True):
    out = []; pts = poly + ([poly[0]] if closed else [])
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(d / step))
        for i in range(n): out.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
    if not closed: out.append(pts[-1])
    return out


def project_patch(proj, name, poly, view, material, offset=0.002, mirror=True, step=0.006, L=4.7, keep=None):
    """A flat 2D outline, filled, subdivided and dropped onto the body along a view ray."""
    bm = bmesh.new()
    ring = [bm.verts.new((u, v, 0)) for u, v in resample(poly, step)]
    bm.faces.new(ring)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(3):
        long_edges = [e for e in bm.edges if e.calc_length() > step * 1.6]
        if not long_edges: break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.beautify_fill(bm, faces=bm.faces[:], edges=bm.edges[:])
    dead = []
    for vtx in bm.verts:
        o, d = ray_for(view, vtx.co.x, vtx.co.y, L)
        loc, nor = proj.hit(o, d)
        if loc is None or (keep and not keep(loc)): dead.append(vtx); continue
        vtx.co = loc + nor * offset
    bmesh.ops.delete(bm, geom=dead, context="VERTS")
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(MATS[material])
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if mirror:
        mm = ob.modifiers.new("m", "MIRROR"); mm.use_axis[0] = True; apply_mods(ob)
    return ob


def groove_cutter(proj, name, line, view, L, width=0.0035, depth=0.006, step=0.01, closed=False):
    """A thin box swept along a line on the body surface; subtracting it leaves a panel gap."""
    pts = []
    for u, v in resample(line, step, closed=closed):
        o, d = ray_for(view, u, v, L); loc, nor = proj.hit(o, d)
        if loc is not None: pts.append((loc, nor))
    if len(pts) < 2: return None
    bm = bmesh.new(); quads = []
    for i, (p, n) in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
        b = n.cross(t).normalized()
        quads.append([bm.verts.new(p + b * sx * width / 2 + n * sy * depth) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for q0, q1 in zip(quads, quads[1:]):
        for i in range(4):
            bm.faces.new((q0[i], q0[(i + 1) % 4], q1[(i + 1) % 4], q1[i]))
    bm.faces.new(quads[0][::-1]); bm.faces.new(quads[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(MATS["Gap"])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob


# ---------------------------------------------------------------- wheels
def curve_disc(name, outer, holes, depth, material, bevel=0.004):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "2D"; cu.fill_mode = "BOTH"
    cu.extrude = depth / 2; cu.bevel_depth = bevel; cu.bevel_resolution = 2; cu.resolution_u = 4
    for poly in [outer] + holes:
        sp = cu.splines.new("POLY"); sp.points.add(len(poly) - 1)
        for p, (x, y) in zip(sp.points, poly): p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target="MESH"); ob = bpy.context.view_layer.objects.active
    ob.data.materials.clear(); ob.data.materials.append(MATS[material])
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def circle(r, n=96, a0=0.0):
    return [(r * math.cos(a0 + 2 * math.pi * i / n), r * math.sin(a0 + 2 * math.pi * i / n)) for i in range(n)]


def wheel(S, style):
    R, W = S["tR"], S["tW"]; rr = R * 0.68; parts = []
    # tyre: rounded section spun around the axle
    bm = bmesh.new(); prof = []; c = 0.05
    prof.append((rr + 0.01, -W / 2 + 0.012))
    for i in range(9): a = -math.pi / 2 + i / 8 * math.pi / 2; prof.append((R - c + math.cos(a) * c, -W / 2 + c + math.sin(a) * c * 1.0))
    for i in range(9): a = i / 8 * math.pi / 2; prof.append((R - c + math.cos(a) * c, W / 2 - c + math.sin(a) * c))
    prof.append((rr + 0.01, W / 2 - 0.012))
    vs = [bm.verts.new((y, 0, r)) for r, y in prof]
    edges = [bm.edges.new((a, b)) for a, b in zip(vs, vs[1:])]
    bmesh.ops.spin(bm, geom=vs + edges, cent=(0, 0, 0), axis=(1, 0, 0), angle=2 * math.pi, steps=72, use_merge=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Tyre"); bm.to_mesh(me); bm.free(); me.materials.append(MATS["Tyre"])
    for p in me.polygons: p.use_smooth = True
    t = bpy.data.objects.new("Tyre", me); bpy.context.scene.collection.objects.link(t); parts.append(t)
    # wheel face
    if style == "aero":       # aero cover: a shallow dish with five curved slots
        holes = []
        for k in range(5):
            a0 = 2 * math.pi * k / 5; arc = []
            for i in range(12): a = a0 + 0.05 + i / 11 * 0.55; arc.append((rr * 0.86 * math.cos(a), rr * 0.86 * math.sin(a)))
            for i in range(12): a = a0 + 0.05 + (11 - i) / 11 * 0.55 + 0.18; arc.append((rr * 0.66 * math.cos(a), rr * 0.66 * math.sin(a)))
            holes.append(arc)
        face = curve_disc("RimFace", circle(rr), holes, 0.02, "RimAero")
        hub = curve_disc("Hub", circle(rr * 0.2, 40), [], 0.03, "Rim")
        hub.location.z = 0.012; parts.append(hub)
    else:                     # twin-spoke: ten spokes in pairs
        holes = []
        for k in range(5):
            a0 = 2 * math.pi * k / 5 + 0.2; a1 = a0 + 2 * math.pi / 5 - 0.4
            arc = [(rr * 0.88 * math.cos(a0 + (a1 - a0) * i / 14), rr * 0.88 * math.sin(a0 + (a1 - a0) * i / 14)) for i in range(15)]
            arc += [(rr * 0.3 * math.cos(a1 - (a1 - a0) * i / 6), rr * 0.3 * math.sin(a1 - (a1 - a0) * i / 6)) for i in range(7)]
            holes.append(arc)
            m0 = a0 - 0.2 - 0.045; m1 = a0 - 0.2 + 0.045     # slot between the twin spokes
            holes.append([(rr * 0.86 * math.cos(m0), rr * 0.86 * math.sin(m0)), (rr * 0.86 * math.cos(m1), rr * 0.86 * math.sin(m1)),
                          (rr * 0.4 * math.cos(m1), rr * 0.4 * math.sin(m1)), (rr * 0.4 * math.cos(m0), rr * 0.4 * math.sin(m0))])
        face = curve_disc("RimFace", circle(rr), holes, 0.03, "Rim")
    parts.append(face)
    for p in parts:
        if p.name.startswith(("RimFace", "Hub")):
            p.rotation_euler = (0, math.pi / 2, 0); p.location.x = W / 2 - 0.05
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=rr, radius2=rr, depth=W * 0.85)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    me = bpy.data.meshes.new("Barrel"); bm.to_mesh(me); bm.free(); me.materials.append(MATS["Trim"])
    parts.append(bpy.data.objects.new("Barrel", me)); bpy.context.scene.collection.objects.link(parts[-1])
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=rr * 0.82, radius2=rr * 0.82, depth=0.028)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    me = bpy.data.meshes.new("Disc"); bm.to_mesh(me); bm.free(); me.materials.append(MATS["Disc"])
    d = bpy.data.objects.new("Disc", me); bpy.context.scene.collection.objects.link(d); d.location.x = -0.02; parts.append(d)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    me = bpy.data.meshes.new("Caliper"); bm.to_mesh(me); bm.free(); me.materials.append(MATS["Caliper"])
    cal = bpy.data.objects.new("Caliper", me); bpy.context.scene.collection.objects.link(cal)
    cal.scale = (0.06, rr * 0.36, rr * 0.5); cal.location = (0.025, -rr * 0.35, rr * 0.55); cal.rotation_euler = (0.6, 0, 0); parts.append(cal)
    # join into one object
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join(); w = bpy.context.view_layer.objects.active; w.name = "Wheel"
    return w


# ---------------------------------------------------------------- the car
def build(model):
    S = SPECS[model]; car = Car(S); L = car.L; Y = model == "Y"
    bpy.ops.wm.read_factory_settings(use_empty=True); materials()
    body = body_mesh(car)

    # wheel arches: round cutouts with black liners, one cutter per side per axle
    inner = S["track"] / 2 - S["tW"] / 2 - 0.07
    for sa in (S["axleF"], S["axleF"] + S["wb"]):
        for side in (1, -1):
            boolean(body, cylinder_cutter("arch", S["tR"] + 0.06, side * inner, side * 1.3, L / 2 - sa, S["tR"]))

    proj = Projector(body)
    belt = car.belt
    # panel gaps: doors, rocker, hood, trunk / liftgate
    d0, d1, d2 = S["doors"]; rock = car.bot(2.0) + 0.1
    lines = [
        ([(d0 + 0.03, belt(d0) - 0.012), (d0, belt(d0) - 0.3), (d0 - 0.02, rock)], "side"),
        ([(d1, belt(d1) - 0.012), (d1, rock)], "side"),
        ([(d2, belt(d2) - 0.012), (d2 - 0.03, belt(d2) - 0.2), (d2 - 0.12, belt(d2) - 0.42), (d2 - 0.17, rock)], "side"),
        ([(d0 - 0.02, rock), (d2 - 0.17, rock)], "side"),
    ]
    hs = S["hoodS"]; hw = 0.78 if not Y else 0.8
    lines.append(([(-hw, hs), (-hw - 0.01, 0.65), (-0.72, 0.25), (-0.5, 0.1), (0, 0.075), (0.5, 0.1), (0.72, 0.25), (hw + 0.01, 0.65), (hw, hs), (-hw, hs)], "top"))
    ds = S["deckS"]; tw = 0.62 if not Y else 0.66; gy = S["lampY"] - (0.14 if Y else 0.105)
    lines.append(([(-tw, ds), (tw, ds)], "top"))
    for sx in (1, -1):
        lines.append(([(sx * tw, ds), (sx * tw * 0.99, L - 0.12)], "top"))
        lines.append(([(sx * tw * 0.99, car.top(L - 0.12) - 0.02), (sx * tw * 0.97, gy)], "rear"))
    lines.append(([(-tw * 0.97, gy), (tw * 0.97, gy)], "rear"))
    cutters = []
    for i, (ln, view) in enumerate(lines):
        views = [view] if view not in ("side",) else ["side", "sideL"]
        for vw in views:
            c = groove_cutter(proj, "gap%d%s" % (i, vw), ln, vw, L)
            if c: cutters.append(c)
    if cutters:
        bpy.ops.object.select_all(action="DESELECT")
        for c in cutters: c.select_set(True)
        bpy.context.view_layer.objects.active = cutters[0]; bpy.ops.object.join()
        boolean(body, bpy.context.view_layer.objects.active)
    proj = Projector(body)

    parts = []
    def patch(name, poly, view, material, off=0.002, mirror=True, step=0.006, keep=None):
        parts.append(project_patch(proj, name, poly, view, material, off, mirror, step, L, keep))

    # ---- body-coloured C-pillars beside the rear window: seen from above, outside the
    # rear-window width; kept only behind the line where the side glass ends
    db, dt = S["dlo"]; gt = S["ghTo"]; r0, r1 = S["rgw"]
    def behind_dlo(p):
        s_ = L / 2 - p.y; yb_, yt_ = belt(s_), car.top(s_)
        f = max(0.0, min(1.0, (p.z - yb_) / max(1e-3, yt_ - yb_)))
        return s_ > db - (db - dt) * f and p.z > yb_ + 0.012
    sail = [(r0, dt - 0.05), (r1, gt + 0.03), (1.2, gt + 0.03), (1.2, dt - 0.05)]
    patch("Sail", sail, "top", "Paint", 0.0025, step=0.008, keep=behind_dlo)

    ly = S["lampY"]
    # ---- tail lamps (rear view outline + side-view wrap), per generation
    def legacy_tail(prefix, dy):
        lens = [(0.42, 0.875), (0.5, 0.905), (0.65, 0.93), (0.8, 0.945), (0.9, 0.95), (0.95, 0.9), (0.94, 0.83), (0.85, 0.8), (0.7, 0.81), (0.55, 0.835), (0.45, 0.855)]
        lens = [(x, y + dy) for x, y in lens]
        patch(prefix + "TailLens", lens, "rear", "TailLens", 0.002)
        wrap = [(L - 0.0, ly + dy + 0.07), (L - 0.13, ly + dy + 0.06), (L - 0.22, ly + dy + 0.04), (L - 0.24, ly + dy + 0.0), (L - 0.15, ly + dy - 0.05), (L - 0.0, ly + dy - 0.08)]
        patch(prefix + "TailLensSide", wrap, "side", "TailLens", 0.002)
        patch(prefix + "TailLensSideL", wrap, "sideL", "TailLens", 0.002, mirror=False)
        strip = [(0.45, 0.88), (0.6, 0.915), (0.8, 0.935), (0.92, 0.935), (0.92, 0.922), (0.8, 0.921), (0.6, 0.9), (0.45, 0.868)]
        patch(prefix + "TailLight", [(x, y + dy) for x, y in strip], "rear", "TailLight", 0.0035, step=0.004)
        hook = [(0.62, 0.84), (0.85, 0.82), (0.93, 0.835), (0.93, 0.848), (0.85, 0.834), (0.62, 0.853)]
        patch(prefix + "TailLightLow", [(x, y + dy) for x, y in hook], "rear", "TailLight", 0.0035, step=0.004)
    def highland_tail(prefix):
        patch(prefix + "TailTop", [(0.5, 0.905), (0.93, 0.92), (0.93, 0.932), (0.5, 0.917)], "rear", "TailLight", 0.003, step=0.004)
        patch(prefix + "TailLow", [(0.64, 0.842), (0.93, 0.842), (0.93, 0.854), (0.64, 0.854)], "rear", "TailLight", 0.003, step=0.004)
        patch(prefix + "TailOut", [(0.915, 0.842), (0.935, 0.842), (0.935, 0.932), (0.915, 0.932)], "rear", "TailLight", 0.003, step=0.004)
        patch(prefix + "TailLens", [(0.5, 0.86), (0.93, 0.86), (0.93, 0.9), (0.5, 0.9)], "rear", "TailLens", 0.0015)
    def juniper_tail(prefix):
        patch(prefix + "TailBar", [(-0.9, ly + 0.055), (0.9, ly + 0.055), (0.9, ly + 0.068), (-0.9, ly + 0.068)], "rear", "TailLight", 0.003, mirror=False, step=0.005)
        patch(prefix + "TailLens", [(0.56, ly - 0.05), (0.95, ly - 0.04), (0.95, ly + 0.02), (0.56, ly + 0.01)], "rear", "TailLens", 0.002)
    if Y:
        legacy_tail("legacy_", ly - 0.88); juniper_tail("refresh_")
    else:
        legacy_tail("legacy_", 0.0); highland_tail("refresh_")

    # ---- headlights (side view, swept along the front fender) and lower front intake
    hb = lambda s: belt(s) - 0.045
    head_leg = [(0.06, hb(0.06) - 0.005), (0.25, hb(0.25) + 0.018), (0.46, hb(0.46) + 0.025), (0.5, hb(0.5) - 0.005), (0.34, hb(0.34) - 0.055), (0.12, hb(0.12) - 0.09), (0.06, hb(0.06) - 0.07)]
    for side in ("side", "sideL"):
        patch("legacy_HeadLens" + side, head_leg, side, "HeadLens", 0.002, mirror=False)
        patch("legacy_HeadDRL" + side, [(0.12, hb(0.12) - 0.003), (0.44, hb(0.44) + 0.012), (0.44, hb(0.44) + 0.004), (0.12, hb(0.12) - 0.012)], side, "HeadLight", 0.0035, mirror=False, step=0.004)
        patch("refresh_HeadDRL" + side, [(0.1, hb(0.1) + 0.0), (0.46, hb(0.46) + 0.016), (0.46, hb(0.46) + 0.004), (0.1, hb(0.1) - 0.012)], side, "HeadLight", 0.003, mirror=False, step=0.004)
    if Y:
        patch("refresh_FrontBar", [(-0.7, car.top(0.02) - 0.03), (0.7, car.top(0.02) - 0.03), (0.7, car.top(0.02) - 0.022), (-0.7, car.top(0.02) - 0.022)], "front", "HeadLight", 0.003, mirror=False, step=0.005)
    yb0 = car.bot(0.0)
    patch("Intake", [(-0.5, yb0 + 0.02), (0.5, yb0 + 0.02), (0.42, yb0 + 0.09), (-0.42, yb0 + 0.09)], "front", "Trim", 0.0015, mirror=False)

    # ---- rear: diffuser, plate; side: handles, repeater cameras
    dy0 = car.bot(L - 0.05) + 0.01
    patch("Diffuser", [(-0.75, dy0), (0.75, dy0), (0.7, dy0 + 0.08), (-0.7, dy0 + 0.08)], "rear", "Trim", 0.0015, mirror=False)
    py = 0.64 if Y else 0.58
    patch("Plate", [(-0.155, py - 0.078), (0.155, py - 0.078), (0.155, py + 0.078), (-0.155, py + 0.078)], "rear", "Plate", 0.004, mirror=False, step=0.01)
    for side in ("side", "sideL"):
        for hs_ in (d0 + 0.62, d1 + 0.6):
            yh = belt(hs_) - 0.075
            patch("Handle" + side, [(hs_ - 0.08, yh - 0.012), (hs_ + 0.08, yh - 0.012), (hs_ + 0.08, yh + 0.012), (hs_ - 0.08, yh + 0.012)], side, "Trim", 0.002, mirror=False, step=0.005)
        cs = S["axleF"] + 0.48; yc = belt(cs) - 0.08
        patch("Repeater" + side, [(cs - 0.03, yc - 0.012), (cs + 0.03, yc - 0.012), (cs + 0.035, yc + 0.012), (cs - 0.025, yc + 0.012)], side, "Camera", 0.002, mirror=False, step=0.004)

    # ---- mirrors: subdivided housings on black arms
    sm = S["ghFrom"] + 0.15; o, dd = ray_for("side", sm, belt(sm) + 0.06, L); loc, nor = proj.hit(o, dd)
    for sx in (1, -1):
        bpy.ops.mesh.primitive_cube_add(size=1); h = bpy.context.object; h.name = "Mirror"
        h.scale = (0.2, 0.09, 0.105); h.location = (sx * (abs(loc.x) + 0.14), loc.y - 0.02, loc.z + 0.05)
        sub = h.modifiers.new("s", "SUBSURF"); sub.levels = 3; sub.render_levels = 3
        h.data.materials.append(MATS["Paint"])
        bpy.ops.object.shade_smooth()
        apply_mods(h); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for v in h.data.vertices:                         # flat back face, tapered toward the door
            if v.co.y < -0.02: v.co.y = -0.02 + (v.co.y + 0.02) * 0.25
            v.co.z *= 0.75 + 0.25 * (0.5 + sx * v.co.x / 0.2)
        parts.append(h)
        bpy.ops.mesh.primitive_cube_add(size=1); a = bpy.context.object; a.name = "MirrorArm"
        a.scale = (0.11, 0.05, 0.03); a.location = (sx * (abs(loc.x) + 0.04), loc.y, loc.z + 0.03)
        a.data.materials.append(MATS["Trim"]); bpy.ops.object.transform_apply(scale=True); parts.append(a)
        bpy.ops.mesh.primitive_plane_add(size=1); g = bpy.context.object; g.name = "MirrorGlass"
        g.scale = (0.17, 0.075, 1); g.rotation_euler = (math.pi / 2, 0, 0); g.location = (sx * (abs(loc.x) + 0.15), loc.y - 0.026, loc.z + 0.05)
        g.data.materials.append(MATS["Glass"]); bpy.ops.object.transform_apply(rotation=True, scale=True); parts.append(g)

    # ---- wheels
    for gen, style in (("legacy_", "aero"), ("refresh_", "twin")):
        proto = wheel(S, style); proto.name = gen + "Wheel"
        for i, (sa, sx) in enumerate([(S["axleF"], 1), (S["axleF"], -1), (S["axleF"] + S["wb"], 1), (S["axleF"] + S["wb"], -1)]):
            w = proto if i == 0 else bpy.data.objects.new(proto.name, proto.data)
            if i: bpy.context.scene.collection.objects.link(w)
            w.location = (sx * S["track"] / 2, L / 2 - sa, S["tR"]); w.rotation_euler = (0, 0, 0 if sx > 0 else math.pi)
            w.name = "%sWheel%d" % (gen, i)

    # tidy: smooth shading by angle so booleans keep crisp edges
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return car


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True,
                              export_materials="EXPORT", export_cameras=False, export_lights=False)


def preview(path, car, gen="legacy"):
    """Four Cycles renders in one strip so the shape can be judged without the app."""
    sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.device = "CPU"
    try: sc.cycles.use_denoising = True
    except Exception: pass
    sc.render.resolution_x = 760; sc.render.resolution_y = 430; sc.render.film_transparent = False
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.55, 0.58, 0.62, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.5; sun.rotation_euler = (0.7, 0.2, 0.9)
    sc.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=40); fl = bpy.context.object; fl.data.materials.append(mat("Floor", (0.35, 0.37, 0.4), 0, 0.8))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    hide = "legacy_" if gen == "refresh" else "refresh_"
    for ob in list(sc.objects):
        if ob.name.startswith(hide): bpy.data.objects.remove(ob)
    L = car.L; shots = [("side", (9.0, 0.0, 0.75), 50), ("rear34", (5.2, -7.6, 2.3), 50), ("front34", (-5.0, 7.6, 1.9), 50), ("chase", (0.0, -9.2, 3.9), 50)]
    import os
    outs = []
    for name, pos, lens in shots:
        cam.location = pos; cam.data.lens = lens
        target = Vector((0, 0, 0.7)); d = (target - Vector(pos)); cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        f = path.replace(".png", "_%s.png" % name); sc.render.filepath = f; bpy.ops.render.render(write_still=True); outs.append(f)
    return outs


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    model, out = args[0], args[1]
    car = build(model)
    export(out)
    if len(args) > 2:
        print("PREVIEWS", preview(args[2], car, args[3] if len(args) > 3 else "legacy"))
    print("BUILT", out)
