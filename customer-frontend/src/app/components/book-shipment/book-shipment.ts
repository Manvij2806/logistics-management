import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeliveryService } from '../../services/delivery.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-book-shipment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './book-shipment.html',
  styleUrl: './book-shipment.scss'
})
export class BookShipment implements OnInit {
  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  indiaStatesCities: Record<string, string[]> = {
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'],
    'Assam': ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Nagaon'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon'],
    'Delhi': ['Delhi', 'New Delhi', 'Dwarka', 'Rohini', 'Vasant Kunj'],
    'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
    'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar'],
    'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Una'],
    'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar'],
    'Karnataka': ['Banglore', 'Bangalore', 'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi'],
    'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
    'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Navi Mumbai'],
    'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj'],
    'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri']
  };

  statesList: string[] = [];

  // Form Model
  form = {
    senderName: '',
    senderPhone: '',
    pickupAddress: '',
    
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    
    packageDescription: '',
    packageWeight: '',
    packageDimensions: '',
    priority: 'Normal',
    paymentMethod: 'Cash on Delivery',
    notes: ''
  };

  // Individual fields for Pickup Address
  pickup = {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: ''
  };

  // Individual fields for Delivery Address
  delivery = {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: ''
  };

  // Form State
  errors: Record<string, string> = {};
  isSubmitting = signal(false);
  submitSuccess = signal(false);
  submitError = signal<string | null>(null);

  ngOnInit(): void {
    this.statesList = Object.keys(this.indiaStatesCities);
    const user = this.currentUser();
    if (user) {
      this.form.senderName = user.full_name || '';
      this.form.senderPhone = user.phone_number || '';
    }
  }

  // Concatenate input fields to update the single pickup address string
  updatePickupAddress(): void {
    const parts = [
      this.pickup.line1,
      this.pickup.line2,
      this.pickup.city,
      this.pickup.state,
      this.pickup.pincode
    ].map(p => p?.trim()).filter(Boolean);
    this.form.pickupAddress = parts.join(', ');
  }

  // Concatenate input fields to update the single delivery address string
  updateDeliveryAddress(): void {
    const parts = [
      this.delivery.line1,
      this.delivery.line2,
      this.delivery.city,
      this.delivery.state,
      this.delivery.pincode
    ].map(p => p?.trim()).filter(Boolean);
    this.form.deliveryAddress = parts.join(', ');
  }

  getPickupCities(): string[] {
    const state = this.pickup.state.trim();
    const key = Object.keys(this.indiaStatesCities).find(
      k => k.toLowerCase() === state.toLowerCase()
    );
    return key ? this.indiaStatesCities[key] : [];
  }

  getDeliveryCities(): string[] {
    const state = this.delivery.state.trim();
    const key = Object.keys(this.indiaStatesCities).find(
      k => k.toLowerCase() === state.toLowerCase()
    );
    return key ? this.indiaStatesCities[key] : [];
  }

  normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  validate(): boolean {
    this.errors = {};

    if (!this.form.senderName.trim()) {
      this.errors['senderName'] = 'Sender name is required';
    }

    if (!this.form.senderPhone.trim()) {
      this.errors['senderPhone'] = 'Sender phone is required';
    } else if (!/^\d{10}$/.test(this.form.senderPhone.replace(/\s+/g, ''))) {
      this.errors['senderPhone'] = 'Enter a valid 10-digit phone number';
    }

    if (!this.pickup.line1.trim()) {
      this.errors['pickupAddress'] = 'Pickup address line 1 is required';
    }

    if (!this.pickup.city.trim()) {
      this.errors['pickupCity'] = 'Pickup city is required';
    }

    if (!this.pickup.pincode.trim()) {
      this.errors['pickupPincode'] = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.pickup.pincode)) {
      this.errors['pickupPincode'] = 'Enter a valid 6-digit pincode';
    }

    if (!this.form.recipientName.trim()) {
      this.errors['recipientName'] = 'Recipient name is required';
    }

    if (!this.form.recipientPhone.trim()) {
      this.errors['recipientPhone'] = 'Recipient phone is required';
    } else if (!/^\d{10}$/.test(this.form.recipientPhone.replace(/\s+/g, ''))) {
      this.errors['recipientPhone'] = 'Enter a valid 10-digit phone number';
    }

    if (!this.delivery.line1.trim()) {
      this.errors['dropAddress'] = 'Drop address line 1 is required';
    }

    if (!this.delivery.city.trim()) {
      this.errors['dropCity'] = 'Delivery city is required';
    }

    if (!this.delivery.pincode.trim()) {
      this.errors['dropPincode'] = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.delivery.pincode)) {
      this.errors['dropPincode'] = 'Enter a valid 6-digit pincode';
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    if (!this.validate()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    // Build the addresses using standard formatted strings
    const pickup_address = `${this.pickup.line1.trim()}${this.pickup.line2 ? ', ' + this.pickup.line2.trim() : ''}, ${this.pickup.city.trim()}, ${this.pickup.state.trim()}, ${this.pickup.pincode.trim()}`;
    const drop_address = `${this.delivery.line1.trim()}${this.delivery.line2 ? ', ' + this.delivery.line2.trim() : ''}, ${this.delivery.city.trim()}, ${this.delivery.state.trim()}, ${this.delivery.pincode.trim()}`;

    const payload = {
      pickup_address,
      drop_address,
      customer_name: this.form.recipientName.trim(),
      customer_phone: this.form.recipientPhone.replace(/\s+/g, ''),
      
      sender_name: this.form.senderName.trim(),
      sender_address: this.pickup.line1.trim() + (this.pickup.line2 ? ', ' + this.pickup.line2.trim() : ''),
      sender_pincode: this.pickup.pincode.trim(),
      sender_phone: this.form.senderPhone.replace(/\s+/g, ''),
      
      recipient_name: this.form.recipientName.trim(),
      recipient_address: this.delivery.line1.trim() + (this.delivery.line2 ? ', ' + this.delivery.line2.trim() : ''),
      recipient_pincode: this.delivery.pincode.trim(),
      recipient_phone: this.form.recipientPhone.replace(/\s+/g, ''),
      
      package_description: this.form.packageDescription.trim() || null,
      package_weight: this.form.packageWeight.trim() || null,
      package_dimensions: this.form.packageDimensions.trim() || null,
      priority: this.form.priority,
      payment_method: this.form.paymentMethod,
      notes: this.form.notes.trim() || null,
      status: 'Created',
      payment_status: 'Unpaid'
    };

    this.deliveryService.createDelivery(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
        // Refresh view or redirect back to dashboard
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.error?.detail || 'Failed to book shipment. Please try again.');
      }
    });
  }
}
