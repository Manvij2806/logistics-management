import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Shipment } from '../../services/mock-data.service';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-map.html',
  styleUrl: './live-map.scss'
})
export class LiveMap implements AfterViewInit, OnChanges, OnDestroy {
  @Input() shipments: Shipment[] = [];
  @Input() selectedShipment: Shipment | null = null;
  @Output() shipmentSelect = new EventEmitter<Shipment>();

  @ViewChild('mapCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  ngAfterViewInit() {
    this.initCanvas();
    this.draw();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['shipments'] || changes['selectedShipment']) {
      this.draw();
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();
    
    // Add resize listener
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height || 400; // default height if 0
    this.draw();
  }

  onCanvasClick(event: MouseEvent) {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    // Detect click on vehicle pins
    for (const s of this.shipments) {
      if (s.status === 'Delivered' || s.status === 'Pending') continue;
      
      // Map coordinates to canvas space
      const px = (s.currentCoords.x / 500) * canvas.width;
      const py = (s.currentCoords.y / 500) * canvas.height;
      
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < 15) { // 15px click radius
        this.shipmentSelect.emit(s);
        break;
      }
    }
  }

  private draw() {
    if (!this.ctx) return;
    
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // 1. Draw Map Background (Grid / Light map lines)
    this.drawMapBase(ctx, w, h);
    
    // 2. Draw Routes for all active/delayed shipments
    for (const s of this.shipments) {
      if (s.status === 'Delivered' || s.status === 'Pending') continue;
      const isSelected = this.selectedShipment && this.selectedShipment.id === s.id;
      this.drawRoute(ctx, s, w, h, !!isSelected);
    }
    
    // 3. Draw Pins (Pickup, Destination, Vehicle)
    for (const s of this.shipments) {
      if (s.status === 'Delivered' || s.status === 'Pending') continue;
      const isSelected = this.selectedShipment && this.selectedShipment.id === s.id;
      this.drawPins(ctx, s, w, h, !!isSelected);
    }
  }

  private drawMapBase(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Background color
    ctx.fillStyle = '#f0f2f7';
    ctx.fillRect(0, 0, w, h);
    
    // Grid Lines
    ctx.strokeStyle = '#e1e5f0';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw stylized green parks
    ctx.fillStyle = '#e2f3e5';
    ctx.fillRect(w * 0.1, h * 0.15, w * 0.18, h * 0.25);
    ctx.fillRect(w * 0.7, h * 0.6, w * 0.2, h * 0.3);
    
    // Draw river
    ctx.strokeStyle = '#d0e1fd';
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.8);
    ctx.bezierCurveTo(w * 0.3, h * 0.7, w * 0.5, h * 0.3, w + 10, h * 0.2);
    ctx.stroke();

    // Draw main streets (background paths)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    
    // Major horizontal and vertical roads
    const roads: { x?: number; y?: number }[] = [
      { y: h * 0.2 }, { y: h * 0.5 }, { y: h * 0.85 },
      { x: w * 0.25 }, { x: w * 0.6 }, { x: w * 0.8 }
    ];
    
    roads.forEach(r => {
      ctx.beginPath();
      if (r.y !== undefined) {
        ctx.moveTo(0, r.y);
        ctx.lineTo(w, r.y);
      } else if (r.x !== undefined) {
        ctx.moveTo(r.x, 0);
        ctx.lineTo(r.x, h);
      }
      ctx.stroke();
    });
  }

  private drawRoute(ctx: CanvasRenderingContext2D, s: Shipment, w: number, h: number, isSelected: boolean) {
    const px = (s.pickupCoords.x / 500) * w;
    const py = (s.pickupCoords.y / 500) * h;
    const dx = (s.destCoords.x / 500) * w;
    const dy = (s.destCoords.y / 500) * h;
    
    // Draw route line
    ctx.beginPath();
    ctx.moveTo(px, py);
    
    // Add a slight curve or bend in the road to make it look realistic (like mockup 3)
    const midX = (px + dx) / 2;
    const midY = (py + dy) / 2;
    // Offset the midpoint slightly to create a zig-zag route
    const offset = 30;
    ctx.lineTo(midX - offset, py);
    ctx.lineTo(midX + offset, dy);
    ctx.lineTo(dx, dy);
    
    ctx.strokeStyle = isSelected ? '#0066f2' : 'rgba(0, 102, 242, 0.25)';
    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.stroke();
  }

  private drawPins(ctx: CanvasRenderingContext2D, s: Shipment, w: number, h: number, isSelected: boolean) {
    const px = (s.pickupCoords.x / 500) * w;
    const py = (s.pickupCoords.y / 500) * h;
    const dx = (s.destCoords.x / 500) * w;
    const dy = (s.destCoords.y / 500) * h;
    
    // Vehicle current coords
    const cx = (s.currentCoords.x / 500) * w;
    const cy = (s.currentCoords.y / 500) * h;
    
    // Draw Pickup Marker (Green Dot with border)
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw Destination Marker (Red Drop Pin)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw Vehicle (blue box / circle with shadow)
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.fillStyle = s.status === 'Delayed' ? '#f59e0b' : '#0066f2';
    
    // Draw vehicle circle
    const vRadius = isSelected ? 12 : 9;
    ctx.beginPath();
    ctx.arc(cx, cy, vRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    
    // Draw tiny inner white circle to look like a GPS dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, isSelected ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();

    // If selected, draw a ring indicator
    if (isSelected) {
      ctx.strokeStyle = 'rgba(0, 102, 242, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
