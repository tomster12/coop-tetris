
class PostProcessor {

  // #region - Main

  constructor() {}


  preload() {
    // Load shaders
    this.blurH = loadShader("./js/base.vert", "./js/blur.frag");
    this.blurV = loadShader("./js/base.vert", "./js/blur.frag");
  }


  setup() {
    // Pass 1 - Horizontal blur
    this.blurHPass = createGraphics(windowWidth, windowHeight, WEBGL);
    this.blurHPass.noStroke();
    this.blurHPass.shader(this.blurH);
    this.blurH.setUniform("texelSize", [1.0 / width, 1.0 / height]);

    // Pass 2 - Vertical blur
    this.blurVPass = createGraphics(windowWidth, windowHeight, WEBGL);
    this.blurVPass.noStroke();
    this.blurVPass.shader(this.blurV);
    this.blurV.setUniform("texelSize", [1.0 / width, 1.0 / height]);
  }


  bloom(input, range, strength) {
    // Pass 1 - Horizontal blur
    this.blurH.setUniform("tex0", input);
    this.blurH.setUniform("direction", [range, 0.0]);
    this.blurH.setUniform("strength", strength);
    this.blurHPass.rect(0, 0, width, height);

    // Pass 2 - Vertical blur
    this.blurV.setUniform("tex0", this.blurHPass);
    this.blurV.setUniform("direction", [0.0, range]);
    this.blurV.setUniform("strength", strength);
    this.blurVPass.rect(0, 0, width, height);

    // Draw blurred ADD blended
    push();
    blendMode(ADD);
    image(this.blurVPass, 0, 0, width, height);
    pop();
  }

  // #endregion
}
