export class CanvasObject {
  constructor({ type, data, style = {}, layer = 0 }) {
    this.id = crypto.randomUUID();
    this.type = type; 
    this.data = data; 
    this.style = style; 
    this.layer = layer;
  }
}