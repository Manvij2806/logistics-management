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

  // Calculation variables
  pkgLength: number | null = null;
  pkgWidth: number | null = null;
  pkgHeight: number | null = null;
  deliveryDistance: number | null = null;
  deliveryType: string = 'Standard'; // Standard / Express / Next Day / Same Day
  paymentResponsibility: string = 'Sender'; // Sender / Receiver
  isFragile: boolean = false;
  declaredValue: number | null = null;
  insuranceOptIn: boolean = false;
  codAmount: number | null = null; // Order value if COD
  
  // Real-time pricing results
  calculatedVolumetricWeight = 0;
  calculatedBillableWeight = 0;
  baseWeightCharge = 0;
  distanceCharge = 0;
  serviceCharge = 0;
  codCharge = 0;
  fragileCharge = 0;
  insuranceCharge = 0;
  totalCharge = 0;

  // Checkout modal
  showCheckoutModal = false;

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

    // Length, width, height, distance validations
    if (this.pkgLength === null || this.pkgLength <= 0) {
      this.errors['pkgLength'] = 'Length must be greater than 0';
    }
    if (this.pkgWidth === null || this.pkgWidth <= 0) {
      this.errors['pkgWidth'] = 'Width must be greater than 0';
    }
    if (this.pkgHeight === null || this.pkgHeight <= 0) {
      this.errors['pkgHeight'] = 'Height must be greater than 0';
    }
    if (this.deliveryDistance === null || this.deliveryDistance <= 0) {
      this.errors['deliveryDistance'] = 'Distance must be greater than 0';
    }
    if (this.form.paymentMethod === 'COD' && (this.codAmount === null || this.codAmount <= 0)) {
      this.errors['codAmount'] = 'COD order value is required';
    }
    if (this.insuranceOptIn && (this.declaredValue === null || this.declaredValue <= 0)) {
      this.errors['declaredValue'] = 'Declared value is required';
    }
    if (!this.form.packageWeight || parseFloat(this.form.packageWeight) <= 0) {
      this.errors['packageWeight'] = 'Weight is required';
    }

    return Object.keys(this.errors).length === 0;
  }

  recalculatePrice(): void {
    const weight = parseFloat(this.form.packageWeight) || 0;
    const length = this.pkgLength || 0;
    const width = this.pkgWidth || 0;
    const height = this.pkgHeight || 0;
    const distance = this.deliveryDistance || 0;
    const declared = this.declaredValue || 0;
    const orderValue = this.codAmount || 0;

    // Step 2: Volumetric Weight
    const volWeight = (length * width * height) / 5000;
    this.calculatedVolumetricWeight = Math.round(volWeight * 100) / 100;

    // Step 3: Billable Weight
    let billWeight = Math.max(weight, volWeight);
    billWeight = Math.ceil(billWeight * 2) / 2;
    this.calculatedBillableWeight = billWeight;

    // Step 4: Base weight charge
    let base = 0;
    if (billWeight <= 0.5) base = 50;
    else if (billWeight <= 1.0) base = 60;
    else if (billWeight <= 2.0) base = 75;
    else if (billWeight <= 3.0) base = 90;
    else if (billWeight <= 5.0) base = 120;
    else if (billWeight <= 10.0) base = 180;
    else if (billWeight <= 15.0) base = 240;
    else if (billWeight <= 20.0) base = 300;
    else if (billWeight <= 25.0) base = 360;
    else base = 420;
    this.baseWeightCharge = base;

    // Step 5: Distance charge
    let distChg = 0;
    if (distance <= 5) distChg = 20;
    else if (distance <= 10) distChg = 30;
    else if (distance <= 20) distChg = 50;
    else if (distance <= 50) distChg = 80;
    else if (distance <= 100) distChg = 120;
    else if (distance <= 250) distChg = 180;
    else if (distance <= 500) distChg = 250;
    else if (distance <= 1000) distChg = 350;
    else distChg = 500;
    this.distanceCharge = distChg;

    // Step 6: Service charge
    let svc = 0;
    if (this.deliveryType === 'Next Day') svc = 75;
    else if (this.deliveryType === 'Express') svc = 100;
    else if (this.deliveryType === 'Same Day') svc = 150;
    this.serviceCharge = svc;

    // Step 7: COD charge
    let cod = 0;
    if (this.form.paymentMethod === 'COD') {
      cod = Math.max(30, 0.02 * orderValue);
    }
    this.codCharge = cod;

    // Step 8: Fragile charge
    this.fragileCharge = this.isFragile ? 50 : 0;

    // Step 9: Insurance charge
    this.insuranceCharge = this.insuranceOptIn ? Math.round(0.01 * declared * 100) / 100 : 0;

    // Step 10: Final Price
    this.totalCharge = this.baseWeightCharge + this.distanceCharge + this.serviceCharge + this.codCharge + this.fragileCharge + this.insuranceCharge;
  }

  onSubmit(): void {
    if (!this.validate()) {
      return;
    }

    if (this.paymentResponsibility === 'Sender' && this.form.paymentMethod === 'Prepaid') {
      this.showCheckoutModal = true;
    } else {
      this.submitBooking('Unpaid');
    }
  }

  payAndBook(): void {
    this.showCheckoutModal = false;
    this.submitBooking('Paid');
  }

  submitBooking(paymentStatus: string): void {
    this.isSubmitting.set(true);
    this.submitError.set(null);

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
      package_dimensions: `${this.pkgLength}x${this.pkgWidth}x${this.pkgHeight}`,
      priority: this.deliveryType,
      payment_method: this.form.paymentMethod,
      notes: this.form.notes.trim() || null,
      status: 'Created',
      payment_status: paymentStatus,
      payment_responsibility: this.paymentResponsibility,
      delivery_charge: this.totalCharge,
      cod_amount: this.form.paymentMethod === 'COD' ? (this.codAmount || 0) : 0,
      pkg_length: this.pkgLength || 0,
      pkg_width: this.pkgWidth || 0,
      pkg_height: this.pkgHeight || 0,
      delivery_distance: this.deliveryDistance || 0,
      is_fragile: this.isFragile,
      declared_value: this.declaredValue || 0,
      insurance_opt_in: this.insuranceOptIn
    };

    this.deliveryService.createDelivery(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
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
