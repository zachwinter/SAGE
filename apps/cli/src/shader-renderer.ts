/**
 * Basic WebGL Shader Renderer
 */

export class ShaderRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null;
  private vertexShader: WebGLShader | null;
  private fragmentShader: WebGLShader | null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.gl = this.canvas.getContext('webgl');
    this.program = null;
    this.vertexShader = null;
    this.fragmentShader = null;

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.initShaders();
  }

  private initShaders() {
    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red color
      }
    `;

    // Create and compile vertex shader
    this.vertexShader = this.compileShader(vertexShaderSource, this.gl!.VERTEX_SHADER);
    
    // Create and compile fragment shader
    this.fragmentShader = this.compileShader(fragmentShaderSource, this.gl!.FRAGMENT_SHADER);

    // Create shader program
    this.program = this.gl!.createProgram();
    
    if (this.program && this.vertexShader && this.fragmentShader) {
      this.gl!.attachShader(this.program, this.vertexShader);
      this.gl!.attachShader(this.program, this.fragmentShader);
      this.gl!.linkProgram(this.program);
      
      if (!this.gl!.getProgramParameter(this.program, this.gl!.LINK_STATUS)) {
        throw new Error('Shader program linking failed');
      }
    }
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    const shader = this.gl!.createShader(type);
    
    if (shader) {
      this.gl!.shaderSource(shader, source);
      this.gl!.compileShader(shader);
      
      if (!this.gl!.getShaderParameter(shader, this.gl!.COMPILE_STATUS)) {
        throw new Error(`Shader compilation error: ${this.gl!.getShaderInfoLog(shader)}`);
      }
      
      return shader;
    }
    
    return null;
  }

  public render() {
    if (this.gl && this.program) {
      // Clear the canvas
      this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      // Set up a simple quad
      const vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0
      ]);

      const positionBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

      const positionLocation = this.gl.getAttribLocation(this.program, 'aPosition');
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

      // Use the shader program
      this.gl.useProgram(this.program);
      
      // Draw the quad
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
  }
}