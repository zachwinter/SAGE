import { ShaderRenderer } from './shader-renderer';

// Initialize the shader renderer
const renderer = new ShaderRenderer('canvas');

// Render once
renderer.render();

console.log('Shader renderer initialized and rendered');