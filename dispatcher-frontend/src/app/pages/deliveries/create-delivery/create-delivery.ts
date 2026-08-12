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
  submitError: string = '';

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

  form = {
    pickupAddress: '',
    deliveryAddress: '',
    priority: 'Normal',
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    recipientName: '',
    recipientPhone: '',
    recipientEmail: '',
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

    if (this.form.senderEmail && this.form.senderEmail.trim()) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(this.form.senderEmail.trim())) {
        this.formErrors.senderEmail = 'Enter valid email address';
      }
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

    if (this.form.recipientEmail && this.form.recipientEmail.trim()) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(this.form.recipientEmail.trim())) {
        this.formErrors.recipientEmail = 'Enter valid email address';
      }
    }

    if (!this.form.packageType) {
      this.formErrors.packageType = 'Package type is required';
    }

    if (!this.form.weight || this.form.weight <= 0) {
      this.formErrors.weight = 'Weight is required';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  createOrder(): void {
    this.submitError = '';
    this.updatePickupAddress();
    this.updateDeliveryAddress();

    if (!this.validate()) {
      this.submitError = 'Please fill in all required fields marked with * (including Package Type & Weight) and fix highlighted errors.';
      return;
    }

    const handlingNotes = this.form.specialHandling.length
      ? `Special Handling: ${this.form.specialHandling.join(', ')}. `
      : '';

    const payload: DeliveryCreate = {
      pickup_address: this.form.pickupAddress.trim(),
      drop_address: this.form.deliveryAddress.trim(),
      customer_name: this.form.recipientName.trim(),
      customer_phone: this.form.recipientPhone.trim(),
      package_details: `${this.form.packageType} | ${this.form.weight}kg | ${this.form.packageDescription}`.trim(),
      notes: `${handlingNotes}Priority: ${this.form.priority}. ${this.form.specialInstructions}`.trim(),
      agent: null,
      recipient_name: this.form.recipientName.trim(),
      recipient_address: this.delivery.line1.trim() + (this.delivery.line2 ? ', ' + this.delivery.line2.trim() : ''),
      recipient_pincode: this.delivery.pincode.trim(),
      recipient_phone: this.form.recipientPhone.trim(),
      sender_name: this.form.senderName.trim(),
      sender_address: this.pickup.line1.trim() + (this.pickup.line2 ? ', ' + this.pickup.line2.trim() : ''),
      sender_pincode: this.pickup.pincode.trim(),
      sender_phone: this.form.senderPhone.trim(),
      sender_email: this.form.senderEmail ? this.form.senderEmail.trim() : null,
      recipient_email: this.form.recipientEmail ? this.form.recipientEmail.trim() : null,
    };


    this.deliveryService.createDelivery(payload).subscribe({
      next: () => {
        this.router.navigate(['/deliveries']);
      },
      error: (err) => {
        console.error('Error creating delivery order', err);
        this.submitError = typeof err?.error?.detail === 'string' 
          ? err.error.detail 
          : (Array.isArray(err?.error?.detail) ? err.error.detail.map((d: any) => d.msg).join(', ') : 'Failed to create delivery order. Please check all fields.');
      }
    });
  }

  reset(): void {
    this.formErrors = {};
    this.submitError = '';

    this.form = {
      pickupAddress: '',
      deliveryAddress: '',
      priority: 'Normal',
      senderName: '',
      senderPhone: '',
      senderEmail: '',
      recipientName: '',
      recipientPhone: '',
      recipientEmail: '',
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
