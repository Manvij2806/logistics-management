import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="placeholder-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:70vh; color:#555; text-align:center;">
      <i class="pi pi-cog pi-spin" style="font-size: 3rem; margin-bottom: 20px; color:#3b4fd8;"></i>
      <h2 style="font-size:1.8rem; margin:0 0 10px; color:#1e2130;">{{pageTitle}}</h2>
      <p style="font-size:1rem; margin-bottom: 20px; color:#666;">This module is under development and will be available soon.</p>
      <button pButton label="Go to Deliveries" icon="pi pi-box" (click)="goHome()"></button>
    </div>
  `
})
export class PlaceholderPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  pageTitle = 'Page Under Development';

  ngOnInit() {
    this.route.data.subscribe(data => {
      if (data && data['title']) {
        this.pageTitle = data['title'];
      }
    });
  }

  goHome() {
    this.router.navigate(['/deliveries']);
  }
}
