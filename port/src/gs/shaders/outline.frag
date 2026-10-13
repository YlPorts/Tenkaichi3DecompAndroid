#version 450
// Native version of the game's outline effect (ObjOutline_Draw, src/sys/gfxm_a.c).
// Object IDs live in the alpha-byte copy. The PS2 outlines where adjacent IDs differ.
// Read the copy at the ACTUAL render-target pixel. The viewport intentionally remains
// 1024x1024 GS pixels, but mobile textures are only 512x512; interpolated fullscreen
// vUv therefore covered only half the texture and produced displaced black silhouettes.
// texelFetch also prevents unintended interpolation between distinct 8-bit object IDs.
layout(location = 0) out vec4 outColor;
layout(set = 2, binding = 0) uniform sampler2D aux;
layout(set = 3, binding = 0) uniform Params {
    vec4 step; // xy: one PS2 pixel in UV, z: outline darkness, w: debug
} p;

float tableAt(ivec2 xy, ivec2 size) {
    int id = int(texelFetch(aux, clamp(xy, ivec2(0), size - 1), 0).r * 255.0 + 0.5);
    if (id == 255) return 0.0; // background, as in ObjOutline_BuildClut
    int c = (id << 3) & 0xFF;
    return float(c == 0 ? 0x80 : c);
}

void main() {
    ivec2 size = textureSize(aux, 0);
    // gl_FragCoord also indexes the DATE alpha copy in gs.frag, on GL and Vulkan.
    ivec2 xy = clamp(ivec2(gl_FragCoord.xy), ivec2(0), size - 1);
    // Preserve one-PS2-pixel border width at any internal resolution (1x, 2x, ...).
    ivec2 onePs2 = max(ivec2(vec2(size) * p.step.xy + 0.5), ivec2(1));
    float here = tableAt(xy, size);
    float right = tableAt(xy + ivec2(onePs2.x, 0), size);
    float down  = tableAt(xy + ivec2(0, onePs2.y), size);
    float left  = tableAt(xy - ivec2(onePs2.x, 0), size);
    float up    = tableAt(xy - ivec2(0, onePs2.y), size);
    bool edge = here > right || here > down || here > left || here > up;

    if (p.step.w != 0.0) { // debug: display ID source for diagnosing bad alpha copies
        int id = int(texelFetch(aux, xy, 0).r * 255.0 + 0.5);
        outColor = vec4(id == 255 ? vec3(0.0) : vec3(0.3 + float(id) / 16.0, id == 0 ? 0.6 : 0.0, 0.0), 0.0);
        return;
    }
    outColor = vec4(vec3(edge ? p.step.z : 0.0), 0.0);
}
