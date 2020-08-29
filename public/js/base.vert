
// Vertex data
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;


void main() {
  // Pass texture coords info to .frag
  vTexCoord = aTexCoord;

  // copy the position data into a vec4, using 1.0 as the w component
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;

  // Pass position info to output
  gl_Position = positionVec4;
}
