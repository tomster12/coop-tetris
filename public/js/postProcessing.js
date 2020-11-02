
class PostProcessor {

  // #region - Main

  constructor() {
    this.effects = {
      "bloom": { preloaded: false, setup: false }
    };
  }


  preload(effect) {
    // Preload all effect
    if (effect == null) {
      for (let effect in Object.entries(this.effects)) {
        this.preload(effect);
      }
    }

    // Preload bloom effect
    if (effect == "bloom" && !this.effects["bloom"].preloaded) {
      this.effects["bloom"].preloaded = true;

      // Load shaders
      this.blurH = loadShader("./js/base.vert", "./js/blur.frag");
      this.blurV = loadShader("./js/base.vert", "./js/blur.frag");
    }
  }


  setup(effect) {
    // Setup all effects
    if (effect == null) {
      for (let effect in Object.entries(this.effects)) {
        this.setup(effect);
      }
    }

    // Setup bloom effect
    if (effect == "bloom" && !this.effects["bloom"].setup) {
      if (!this.effects["bloom"].preloaded) this.preload("bloom");
      this.effects["bloom"].setup = true;

      // Horizontal blur pass
      this.blurHPass = createGraphics(width, height, WEBGL);
      this.blurHPass.noStroke();
      this.blurHPass.shader(this.blurH);

      // Vertical blur pass
      this.blurVPass = createGraphics(width, height, WEBGL);
      this.blurVPass.noStroke();
      this.blurVPass.shader(this.blurV);
    }
  }


  bloom(input, range, strength) {
    if (!this.effects["bloom"].setup) this.setup("bloom");

    // Horizontal blur pass
    this.blurH.setUniform("tex0", input);
    this.blurH.setUniform("direction", [range, 0.0]);
    this.blurH.setUniform("strength", strength);
    this.blurH.setUniform("texelSize", [1.0 / width, 1.0 / height]);
    this.blurHPass.rect(0, 0, width, height);

    // Vertical blur pass
    this.blurV.setUniform("tex0", this.blurHPass);
    this.blurV.setUniform("direction", [0.0, range]);
    this.blurV.setUniform("strength", strength);
    this.blurV.setUniform("texelSize", [1.0 / width, 1.0 / height]);
    this.blurVPass.rect(0, 0, width, height);

    // Draw blurred blended ADD
    output.push();
    output.blendMode(ADD);
    output.image(this.blurVPass, 0, 0, width, height);
    output.pop();
  }

  // #endregion
}
