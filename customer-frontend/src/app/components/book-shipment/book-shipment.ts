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

  // Form Model
  form = {
    senderName: '',
    senderPhone: '',
    pickupAddress: '',
    pickupCity: '',
    pickupPincode: '',
    
    recipientName: '',
    recipientPhone: '',
    dropAddress: '',
    dropCity: '',
    dropPincode: '',
    
    packageDescription: '',
    packageWeight: '',
    packageDimensions: '',
    priority: 'Normal',
    paymentMethod: 'Cash on Delivery',
    notes: ''
  };

  // Indian Cities Suggestions List
  allCities: string[] = [
    'Agra', 'Ahmedabad', 'Ajmer', 'Ambala', 'Amritsar', 'Anantnag', 'Asansol', 'Aurangabad',
    'Bangalore', 'Baramulla', 'Bathinda', 'Belagavi', 'Bengaluru', 'Bhagalpur', 'Bhilai',
    'Bhopal', 'Bhubaneswar', 'Bikaner', 'Bilaspur', 'Bokaro Steel City', 'Chennai', 'Cuttack',
    'Deoghar', 'Delhi', 'Dharamshala', 'Dhanbad', 'Dibrugarh', 'Durgapur', 'Dwarka',
    'Faridabad', 'Gaya', 'Ghaziabad', 'Goa', 'Guntur', 'Gurgaon', 'Gurugram', 'Guwahati',
    'Gwalior', 'Howrah', 'Hubballi', 'Hyderabad', 'Indore', 'Itanagar', 'Jabalpur', 'Jaipur',
    'Jalandhar', 'Jammu', 'Jamshedpur', 'Jodhpur', 'Jorhat', 'Kanpur', 'Karimnagar', 'Kathua',
    'Khammam', 'Kochi', 'Kolkata', 'Kollam', 'Korba', 'Kota', 'Kozhikode', 'Kurnool',
    'Lucknow', 'Ludhiana', 'Madurai', 'Mangaluru', 'Mapusa', 'Margao', 'Mandi', 'Meerut',
    'Mumbai', 'Muzaffarpur', 'Mysuru', 'Nagaon', 'Nagpur', 'Naharlagun', 'Nashik',
    'Navi Mumbai', 'Nellore', 'New Delhi', 'Nizamabad', 'Noida', 'Panaji', 'Panipat',
    'Pasighat', 'Patiala', 'Patna', 'Ponda', 'Pune', 'Puri', 'Purnia', 'Prayagraj',
    'Raipur', 'Rajkot', 'Rajnandgaon', 'Ranchi', 'Rohini', 'Rourkela', 'Salem', 'Sambalpur',
    'Shimla', 'Silchar', 'Siliguri', 'Solan', 'Srinagar', 'Surat', 'Thane', 'Thiruvananthapuram',
    'Thrissur', 'Tiruchirappalli', 'Udaipur', 'Ujjain', 'Una', 'Vadodara', 'Varanasi',
    'Vasant Kunj', 'Vasco da Gama', 'Vijayawada', 'Visakhapatnam', 'Warangal', 'Yamunanagar'
  ];

  // Form State
  errors: Record<string, string> = {};
  isSubmitting = signal(false);
  submitSuccess = signal(false);
  submitError = signal<string | null>(null);

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.form.senderName = user.full_name || '';
      this.form.senderPhone = user.phone_number || '';
    }
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

    if (!this.form.pickupAddress.trim()) {
      this.errors['pickupAddress'] = 'Pickup address is required';
    }

    if (!this.form.pickupCity.trim()) {
      this.errors['pickupCity'] = 'Pickup city is required';
    }

    if (!this.form.pickupPincode.trim()) {
      this.errors['pickupPincode'] = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.form.pickupPincode)) {
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

    if (!this.form.dropAddress.trim()) {
      this.errors['dropAddress'] = 'Drop address is required';
    }

    if (!this.form.dropCity.trim()) {
      this.errors['dropCity'] = 'Delivery city is required';
    }

    if (!this.form.dropPincode.trim()) {
      this.errors['dropPincode'] = 'Pincode is required';
    } else if (!/^\d{6}$/.test(this.form.dropPincode)) {
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

    // Build the addresses using standard formatted strings (matching the editor format)
    const pickup_address = `${this.form.pickupAddress.trim()}, ${this.form.pickupCity.trim()}, ${this.form.pickupPincode.trim()}`;
    const drop_address = `${this.form.dropAddress.trim()}, ${this.form.dropCity.trim()}, ${this.form.dropPincode.trim()}`;

    const payload = {
      pickup_address,
      drop_address,
      customer_name: this.form.recipientName.trim(), // The customer who receives the delivery updates
      customer_phone: this.form.recipientPhone.replace(/\s+/g, ''),
      
      sender_name: this.form.senderName.trim(),
      sender_address: this.form.pickupAddress.trim(),
      sender_pincode: this.form.pickupPincode.trim(),
      sender_phone: this.form.senderPhone.replace(/\s+/g, ''),
      
      recipient_name: this.form.recipientName.trim(),
      recipient_address: this.form.dropAddress.trim(),
      recipient_pincode: this.form.dropPincode.trim(),
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
          window.location.reload(); // Quick refresh to update the active deliveries list
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.error?.detail || 'Failed to book shipment. Please try again.');
      }
    });
  }
}
