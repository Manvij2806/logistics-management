import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { DeliveryService, DeliveryCreate } from '../../../services/delivery.service';

@Component({
  selector: 'app-create-delivery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    RadioButtonModule,
    CheckboxModule,
    InputNumberModule,
    RouterModule
  ],
  templateUrl: './create-delivery.html',
  styleUrl: './create-delivery.scss'
})
export class CreateDelivery {
  private deliveryService: DeliveryService;
  private router: Router;

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
    'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi'],
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

  constructor(deliveryService: DeliveryService, router: Router) {
    this.deliveryService = deliveryService;
    this.router = router;
    this.statesList = Object.keys(this.indiaStatesCities);
  }

  formErrors: any = {};

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

  // Calculation variables
  pkgLength: number | null = null;
  pkgWidth: number | null = null;
  pkgHeight: number | null = null;
  deliveryDistance: number | null = null;
  deliveryType: string = 'Standard'; // Standard / Express / Next Day / Same Day
  paymentMethod: string = 'Prepaid'; // Prepaid / COD
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

  form = {
    pickupAddress: '',
    deliveryAddress: '',
    priority: 'Normal',
    senderName: '',
    senderPhone: '',
    recipientName: '',
    recipientPhone: '',
    packageType: null as any,
    packageDescription: '',
    weight: null as number | null,
    specialHandling: [] as string[],
    specialInstructions: ''
  };

  priorityOptions = [
    { label: 'Normal', value: 'Normal' },
    { label: 'Express', value: 'Express' },
    { label: 'Same Day', value: 'Same Day' }
  ];

  packageTypeOptions = [
    { label: 'Clothing', value: 'Clothing' },
    { label: 'Consolidated Package', value: 'Consolidated Package' },
    { label: 'Documents', value: 'Documents' },
    { label: 'Electronics', value: 'Electronics' },
    { label: 'Food & Groceries', value: 'Food & Groceries' },
    { label: 'Household Items', value: 'Household Items' },
    { label: 'Medical Equipment', value: 'Medical Equipment' },
    { label: 'Medicines', value: 'Medicines' },
    { label: 'Other', value: 'Other' }
  ];

  specialHandlingOptions = [
    {
      label: 'Fragile',
      value: 'Fragile',
      icon: 'pi pi-exclamation-triangle',
      color: '#e74c3c'
    },
    {
      label: 'Temperature Sensitive',
      value: 'Temperature Sensitive',
      icon: 'pi pi-asterisk',
      color: '#3498db'
    },
    {
      label: 'High Value Item',
      value: 'High Value Item',
      icon: 'pi pi-shield',
      color: '#f39c12'
    },
    {
      label: 'Handle with Care',
      value: 'Handle with Care',
      icon: 'pi pi-heart',
      color: '#2ecc71'
    }
  ];

  isHandlingSelected(value: string): boolean {
    return this.form.specialHandling.includes(value);
  }

  toggleHandling(value: string): void {
    const idx = this.form.specialHandling.indexOf(value);
    if (idx > -1) {
      this.form.specialHandling.splice(idx, 1);
    } else {
      this.form.specialHandling.push(value);
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
    this.formErrors = {};

    if (!this.pickup.line1.trim()) {
      this.formErrors.pickupAddress = 'Pickup address is required';
    }

    if (!this.pickup.pincode.trim()) {
      this.formErrors.pickupPincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.pickup.pincode)) {
      this.formErrors.pickupPincode = 'Enter valid 6-digit pincode';
    }

    if (!this.delivery.line1.trim()) {
      this.formErrors.deliveryAddress = 'Drop address is required';
    } else if (this.normalizeAddress(this.pickup.line1) === this.normalizeAddress(this.delivery.line1)) {
      this.formErrors.deliveryAddress = 'Pickup and Drop addresses cannot be the same.';
    }

    if (!this.delivery.pincode.trim()) {
      this.formErrors.deliveryPincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.delivery.pincode)) {
      this.formErrors.deliveryPincode = 'Enter valid 6-digit pincode';
    } else if (this.pickup.pincode.trim() === this.delivery.pincode.trim()) {
      this.formErrors.deliveryPincode = 'Pickup and Drop pincodes cannot be the same.';
    }

    if (!this.form.senderName.trim()) {
      this.formErrors.senderName = 'Sender name is required';
    }

    if (!this.form.senderPhone.trim()) {
      this.formErrors.senderPhone = 'Sender phone is required';
    } else if (
      !/^\+?\d{10,13}$/.test(this.form.senderPhone.replace(/\s/g, ''))
    ) {
      this.formErrors.senderPhone = 'Enter valid phone number';
    }

    if (!this.form.recipientName.trim()) {
      this.formErrors.recipientName = 'Recipient name is required';
    }

    if (!this.form.recipientPhone.trim()) {
      this.formErrors.recipientPhone = 'Recipient phone is required';
    } else if (
      !/^\+?\d{10,13}$/.test(this.form.recipientPhone.replace(/\s/g, ''))
    ) {
      this.formErrors.recipientPhone = 'Enter valid phone number';
    }

    if (!this.form.packageType) {
      this.formErrors.packageType = 'Package type is required';
    }

    if (!this.form.weight || this.form.weight <= 0) {
      this.formErrors.weight = 'Weight is required';
    }

    if (this.pkgLength === null || this.pkgLength <= 0) {
      this.formErrors.pkgLength = 'Length is required';
    }
    if (this.pkgWidth === null || this.pkgWidth <= 0) {
      this.formErrors.pkgWidth = 'Width is required';
    }
    if (this.pkgHeight === null || this.pkgHeight <= 0) {
      this.formErrors.pkgHeight = 'Height is required';
    }
    if (this.deliveryDistance === null || this.deliveryDistance <= 0) {
      this.formErrors.deliveryDistance = 'Distance is required';
    }
    if (this.paymentMethod === 'COD' && (this.codAmount === null || this.codAmount <= 0)) {
      this.formErrors.codAmount = 'COD amount is required';
    }
    if (this.insuranceOptIn && (this.declaredValue === null || this.declaredValue <= 0)) {
      this.formErrors.declaredValue = 'Declared value is required';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  recalculatePrice(): void {
    const weight = this.form.weight || 0;
    const length = this.pkgLength || 0;
    const width = this.pkgWidth || 0;
    const height = this.pkgHeight || 0;
    const distance = this.deliveryDistance || 0;
    const declared = this.declaredValue || 0;
    const orderValue = this.codAmount || 0;

    // Step 2: Volumetric weight
    const volWeight = (length * width * height) / 5000;
    this.calculatedVolumetricWeight = Math.round(volWeight * 100) / 100;

    // Step 3: Billable weight
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
    if (this.paymentMethod === 'COD') {
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

  createOrder(): void {
    if (!this.validate()) return;

    if (this.paymentResponsibility === 'Sender' && this.paymentMethod === 'Prepaid') {
      this.showCheckoutModal = true;
    } else {
      this.submitOrder('Unpaid');
    }
  }

  payAndSubmit(): void {
    this.showCheckoutModal = false;
    this.submitOrder('Paid');
  }

  submitOrder(paymentStatus: string): void {
    const handlingNotes = this.form.specialHandling.length
      ? `Special Handling: ${this.form.specialHandling.join(', ')}. `
      : '';

    const payload: any = {
      pickup_address: this.form.pickupAddress.trim(),
      drop_address: this.form.deliveryAddress.trim(),
      customer_name: this.form.recipientName.trim(),
      customer_phone: this.form.recipientPhone.trim(),
      package_description: this.form.packageType,
      package_weight: String(this.form.weight),
      package_dimensions: `${this.pkgLength}x${this.pkgWidth}x${this.pkgHeight}`,
      priority: this.deliveryType,
      notes: `${handlingNotes}Instructions: ${this.form.specialInstructions}`.trim(),
      agent: null,
      recipient_name: this.form.recipientName.trim(),
      recipient_address: this.delivery.line1.trim() + (this.delivery.line2 ? ', ' + this.delivery.line2.trim() : ''),
      recipient_pincode: this.delivery.pincode.trim(),
      recipient_phone: this.form.recipientPhone.trim(),
      sender_name: this.form.senderName.trim(),
      sender_address: this.pickup.line1.trim() + (this.pickup.line2 ? ', ' + this.pickup.line2.trim() : ''),
      sender_pincode: this.pickup.pincode.trim(),
      sender_phone: this.form.senderPhone.trim(),
      payment_method: this.paymentMethod,
      payment_responsibility: this.paymentResponsibility,
      payment_status: paymentStatus,
      delivery_charge: this.totalCharge,
      cod_amount: this.paymentMethod === 'COD' ? (this.codAmount || 0) : 0,
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
        this.router.navigate(['/deliveries']);
      },
      error: (err) => {
        console.error('Error creating delivery order', err);
      }
    });
  }

  reset(): void {
    this.formErrors = {};

    this.form = {
      pickupAddress: '',
      deliveryAddress: '',
      priority: 'Normal',
      senderName: '',
      senderPhone: '',
      recipientName: '',
      recipientPhone: '',
      packageType: null,
      packageDescription: '',
      weight: null,
      specialHandling: [],
      specialInstructions: ''
    };

    this.pickup = {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: ''
    };

    this.delivery = {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: ''
    };
  }
}
