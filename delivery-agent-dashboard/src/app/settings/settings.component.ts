export interface AgentSettings {
  fullName: string;
  email: string;
  phone: string;
  vehicleType: string;
  maxDistance: number;
  autoAccept: boolean;
  soundNotifications: boolean;
}

import { Component, OnInit } from '@angular/core';

const SETTINGS_STORAGE_KEY = 'deliveryAgentSettings';

@Component({
  selector: 'app-settings-view',
  standalone: false,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsViewComponent implements OnInit {
  savedMessage = '';

  settings: AgentSettings = {
    fullName: 'John Driver',
    email: 'john.driver@deliverse.com',
    phone: '+1 (555) 019-2834',
    vehicleType: 'Car',
    maxDistance: 25,
    autoAccept: true,
    soundNotifications: true
  };

  ngOnInit(): void {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!savedSettings) {
      return;
    }

    try {
      this.settings = {
        ...this.settings,
        ...JSON.parse(savedSettings)
      };
    } catch {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }

  saveSettings(): void {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    this.savedMessage = 'Settings saved';

    window.setTimeout(() => {
      this.savedMessage = '';
    }, 2500);
  }
}
