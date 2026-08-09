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

  defaultPincodes: Record<string, string> = {
    'agra': '282001',
    'ahmedabad': '380001',
    'ajmer': '305001',
    'ambala': '133001',
    'amritsar': '143001',
    'anantnag': '192101',
    'asansol': '713301',
    'aurangabad': '431001',
    'bangalore': '560001',
    'banglore': '560001',
    'baramulla': '193101',
    'bathinda': '151001',
    'belagavi': '590001',
    'bengaluru': '560001',
    'bhagalpur': '812001',
    'bhavnagar': '364001',
    'bhilai': '490001',
    'bhopal': '462001',
    'bhubaneswar': '751001',
    'bikaner': '334001',
    'bilaspur': '495001',
    'bokaro steel city': '827001',
    'chennai': '600001',
    'coimbatore': '641001',
    'cuttack': '753001',
    'darbhanga': '846001',
    'delhi': '110001',
    'deoghar': '814112',
    'dharamsala': '176215',
    'dharamshala': '176215',
    'dhanbad': '826001',
    'dibrugarh': '786001',
    'durgapur': '713201',
    'dwarka': '110075',
    'faridabad': '121001',
    'gaya': '823001',
    'ghaziabad': '201001',
    'goa': '403001',
    'guntur': '522001',
    'gurugram': '122001',
    'guwahati': '781001',
    'gwalior': '474001',
    'howrah': '711101',
    'hubballi': '580020',
    'hyderabad': '500001',
    'indore': '452001',
    'jabalpur': '482001',
    'jaipur': '302001',
    'jalandhar': '144001',
    'jammu': '180001',
    'jamshedpur': '831001',
    'jodhpur': '342001',
    'jorhat': '785001',
    'kamla nagar': '282005',
    'kanpur': '208001',
    'karimnagar': '505001',
    'kathua': '184101',
    'khammam': '507001',
    'kochi': '682001',
    'kolkata': '700001',
    'kollam': '691001',
    'korba': '495677',
    'kota': '324001',
    'kozhikode': '673001',
    'lucknow': '226001',
    'ludhiana': '141001',
    'madurai': '625001',
    'mangaluru': '575001',
    'mapusa': '403507',
    'margao': '403601',
    'medical college': '282002',
    'meerut': '250001',
    'mumbai': '400001',
    'mysuru': '570001',
    'nagaon': '782001',
    'nagpur': '440001',
    'nashik': '422001',
    'nellore': '524001',
    'new delhi': '110001',
    'nizamabad': '503001',
    'noida': '201301',
    'panaji': '403001',
    'panipat': '132103',
    'patiala': '147001',
    'patna': '800001',
    'ponda': '403401',
    'pratap nagar': '282010',
    'prayagraj': '211001',
    'pune': '411001',
    'puri': '752001',
    'raipur': '492001',
    'rajkot': '360001',
    'rajnandgaon': '491441',
    'ranchi': '834001',
    'rohini': '110085',
    'rourkela': '769001',
    'salem': '636001',
    'hybrid': '122001',
    'sambalpur': '768001',
    'shimla': '171001',
    'silchar': '788001',
    'siliguri': '734001',
    'solan': '173212',
    'srinagar': '190001',
    'surat': '395003',
    'thane': '400601',
    'thiruvananthapuram': '695001',
    'thrissur': '680001',
    'tiruchirappalli': '620001',
    'tirupati': '517501',
    'udaipur': '313001',
    'ujjain': '456001',
    'una': '174303',
    'vadodara': '390001',
    'varanasi': '221001',
    'vasant kunj': '110070',
    'vasco da gama': '403802',
    'vijayawada': '520001',
    'visakhapatnam': '530001',
    'warangal': '506001',
    'yamunanagar': '135001'
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
  previousDeclaredValue: number | null = null;
  
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
    paymentMethod: 'Prepaid',
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
  selectedCheckoutMethod = signal<'Card' | 'QR Code' | 'Cash'>('Card');

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

  onPickupCityChange(): void {
    const city = (this.pickup.city || '').trim().toLowerCase();
    if (city && this.defaultPincodes[city]) {
      this.pickup.pincode = this.defaultPincodes[city];
    }
    this.updatePickupAddress();
  }

  onDeliveryCityChange(): void {
    const city = (this.delivery.city || '').trim().toLowerCase();
    if (city && this.defaultPincodes[city]) {
      this.delivery.pincode = this.defaultPincodes[city];
    }
    this.updateDeliveryAddress();
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
    if (this.form.paymentMethod === 'COD') {
      if (this.codAmount === null || this.codAmount === 0 || this.codAmount === this.previousDeclaredValue) {
        this.codAmount = this.declaredValue;
      }
    }
    this.previousDeclaredValue = this.declaredValue;

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
    const method = this.selectedCheckoutMethod();
    this.showCheckoutModal = false;
    if (method === 'Cash') {
      this.submitBooking('Unpaid');
    } else {
      this.submitBooking('Paid');
    }
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
      payment_method: this.form.paymentMethod === 'Prepaid' ? this.selectedCheckoutMethod() : this.form.paymentMethod,
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
