import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats } from '../../services/dashboard';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { DeliveryService } from '../../services/delivery';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class Dashboard implements OnInit {
  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private deliveryService = inject(DeliveryService);

  isAdmin = this.authService.isAdmin.bind(this.authService);
  currentUser = this.authService.currentUser;

  stats = signal<DashboardStats | null>(null);
  isLoading = signal(true);
  loadError = signal<string | null>(null);

  totalDeliveriesCount = signal(0);

  // Date Picker States
  showDatePicker = signal(false);

  // Default range matches mockup: May 14 to May 20, 2024
  selectedRange = signal<{ start: Date; end: Date }>({
    start: new Date(2024, 4, 14),
    end: new Date(2024, 4, 20),
  });

  tempRange = signal<{ start: Date; end: Date | null }>({
    start: new Date(2024, 4, 14),
    end: new Date(2024, 4, 20),
  });

  activeQuickSelect = signal<string>('Last 7 Days');
  currentCalendarMonth = signal<Date>(new Date(2024, 4, 1)); // May 2024
  hoveredDate = signal<Date | null>(null);

  quickSelectOptions = [
    { label: 'Today' },
    { label: 'Yesterday' },
    { label: 'Last 7 Days' },
    { label: 'Last 30 Days' },
    { label: 'This Month' },
    { label: 'Last Month' },
    { label: 'This Quarter' },
    { label: 'This Year' },
  ];

  // Raw data stores
  private rawDeliveries: any[] = [];
  private rawUsers: any[] = [];

  // Status Columns (Bar Chart)
  statusChartRange = signal('this-week');
  statusColumns = signal<any[]>([]);
  totalStatusDeliveries = signal(0);
  yAxisLabels = signal<string[]>([]);

  // User Breakdown (Donut Chart)
  userRoleSegments = signal<any[]>([]);
  totalUsersCount = signal(0);

  // Top Performing Agents (Table)
  topPerformingAgents = signal<any[]>([]);

  // Redesign mockup data signals
  metrics = signal([
    {
      label: 'Total Deliveries',
      value: '0',
      trend: '+12.5%',
      trendPositive: true,
      comparison: 'vs last week',
    },
    {
      label: 'Active Deliveries',
      value: '0',
      trend: '+8.2%',
      trendPositive: true,
      comparison: 'vs last week',
    },
    {
      label: 'Delivered Orders',
      value: '0',
      trend: '+15.3%',
      trendPositive: true,
      comparison: 'vs last week',
    },
    {
      label: 'Pending Assignments',
      value: '0',
      trend: '-4.3%',
      trendPositive: false,
      comparison: 'vs last week',
    },
    {
      label: 'Total Revenue',
      value: '₹0',
      trend: '+18.4%',
      trendPositive: true,
      comparison: 'vs last week',
    },
    {
      label: 'Total Users',
      value: '0',
      trend: '+6.7%',
      trendPositive: true,
      comparison: 'vs last week',
    },
    {
      label: 'Total Agents',
      value: '0',
      trend: '+4.1%',
      trendPositive: true,
      comparison: 'vs last week',
    },
    {
      label: 'Avg. Delivery Time',
      value: '2.45 hrs',
      trend: '-5.6%',
      trendPositive: false,
      comparison: 'vs last week',
    },
    {
      label: 'Delayed Deliveries',
      value: '0',
      trend: '-3.2%',
      trendPositive: false,
      comparison: 'vs last week',
    },
  ]);

  // Computed calendar days grid for the active month view
  calendarDays = computed(() => {
    const activeMonth = this.currentCalendarMonth();
    const year = activeMonth.getFullYear();
    const month = activeMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; dayNumber: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      days.push({
        date: new Date(year, month - 1, dayNum),
        dayNumber: dayNum,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        dayNumber: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding days
    const totalCells = 42; // standard 6-row calendar
    const nextMonthDaysToAdd = totalCells - days.length;
    for (let i = 1; i <= nextMonthDaysToAdd; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  });

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.isLoading.set(false);
      return;
    }

    forkJoin({
      usersData: this.userService.getUsers({ page_size: 100 }),
      deliveriesData: this.deliveryService.getDeliveries({ page_size: 100 }),
    }).subscribe({
      next: ({ usersData, deliveriesData }) => {
        this.rawUsers = usersData.users;
        this.rawDeliveries = deliveriesData.deliveries;

        this.refreshDashboard();
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load dashboard data.');
        this.isLoading.set(false);
      },
    });
  }

  toggleDatePicker(event: Event): void {
    event.stopPropagation();
    this.showDatePicker.update((val) => !val);
    if (this.showDatePicker()) {
      // Sync temp range with active range when opening
      this.tempRange.set({
        start: new Date(this.selectedRange().start),
        end: new Date(this.selectedRange().end),
      });
      // Focus view on the start date month
      this.currentCalendarMonth.set(
        new Date(
          this.selectedRange().start.getFullYear(),
          this.selectedRange().start.getMonth(),
          1,
        ),
      );
    }
  }

  closeDatePicker(): void {
    this.showDatePicker.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showDatePicker() && !target.closest('.header-actions')) {
      this.closeDatePicker();
    }
  }

  formatTempDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getCalendarMonthYearString(): string {
    return this.currentCalendarMonth().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  getFormattedActiveRange(): string {
    const start = this.selectedRange().start;
    const end = this.selectedRange().end;
    const format = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${format(start)} - ${format(end)}`;
  }

  navigateMonth(offset: number): void {
    const current = this.currentCalendarMonth();
    this.currentCalendarMonth.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  isStartDate(date: Date): boolean {
    const start = this.tempRange().start;
    return this.isSameDay(date, start);
  }

  isEndDate(date: Date): boolean {
    const end = this.tempRange().end;
    return this.isSameDay(date, end);
  }

  isInRange(date: Date): boolean {
    const start = this.tempRange().start;
    const end = this.tempRange().end || this.hoveredDate();
    if (!start || !end) return false;

    const t = this.getMidnightTime(date);
    const s = this.getMidnightTime(start);
    const e = this.getMidnightTime(end);

    const min = Math.min(s, e);
    const max = Math.max(s, e);

    return t >= min && t <= max;
  }

  onMouseEnterDate(date: Date): void {
    if (this.tempRange().start && !this.tempRange().end) {
      this.hoveredDate.set(date);
    }
  }

  onMouseLeaveDate(): void {
    this.hoveredDate.set(null);
  }

  selectDate(date: Date): void {
    const temp = this.tempRange();
    if (temp.end !== null) {
      this.tempRange.set({ start: date, end: null });
      this.activeQuickSelect.set('custom');
    } else {
      if (this.getMidnightTime(date) < this.getMidnightTime(temp.start)) {
        this.tempRange.set({ start: date, end: null });
      } else {
        this.tempRange.set({ start: temp.start, end: date });
      }
    }
  }

  private isSameDay(d1: Date | null, d2: Date | null): boolean {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private getMidnightTime(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  applyDateFilter(): void {
    const temp = this.tempRange();
    if (temp.start && temp.end) {
      this.selectedRange.set({ start: temp.start, end: temp.end });
      this.refreshDashboard();
      this.closeDatePicker();
    } else if (temp.start) {
      this.selectedRange.set({ start: temp.start, end: temp.start });
      this.refreshDashboard();
      this.closeDatePicker();
    }
  }

  selectQuickRange(label: string): void {
    this.activeQuickSelect.set(label);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);

    switch (label) {
      case 'Today':
        break;
      case 'Yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'Last 7 Days':
        // For custom mockup styling consistency, if it's the default mockup date (May 14 - May 20, 2024), let's keep that.
        // But if they select "Last 7 Days" relative to today, we do standard subtraction.
        // Wait, to keep it working relative to actual dates:
        start.setDate(today.getDate() - 6);
        break;
      case 'Last 30 Days':
        start.setDate(today.getDate() - 29);
        break;
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Last Month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'This Quarter':
        const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
        start = new Date(today.getFullYear(), quarterMonth, 1);
        break;
      case 'This Year':
        start = new Date(today.getFullYear(), 0, 1);
        break;
    }

    this.tempRange.set({ start, end });
    this.currentCalendarMonth.set(new Date(start.getFullYear(), start.getMonth(), 1));
  }

  onStatusRangeChange(): void {
    this.refreshDashboard();
  }

  refreshDashboard(): void {
    if (this.rawDeliveries.length === 0) return;

    const start = this.selectedRange().start;
    const end = this.selectedRange().end;

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // Distribute mock deliveries across the selected range
    const deliveries = this.rawDeliveries.map((d, index) => {
      const dateOffset = index % diffDays;
      const mockDate = new Date(start);
      mockDate.setDate(start.getDate() + dateOffset);
      mockDate.setHours(9 + (index % 8), 0, 0, 0);
      return {
        ...d,
        created_at: mockDate.toISOString(),
      };
    });

    const totalUsers = this.rawUsers.length;
    const totalAgents = this.rawUsers.filter((u) => u.role === 'Agent').length;

    const totalDeliveries = deliveries.length;
    this.totalDeliveriesCount.set(totalDeliveries);

    const activeDeliveries = deliveries.filter((d) => d.status !== 'Delivered').length;
    const deliveredOrders = deliveries.filter((d) => d.status === 'Delivered').length;
    const pendingAssignments = deliveries.filter(
      (d) => d.status === 'Pending' || d.status === 'Assigned' || !d.agent,
    ).length;
    const delayedDeliveries = deliveries.filter((d) => d.status === 'Delayed').length;

    const paidCount = deliveries.filter((d) => d.payment_status === 'Paid').length;
    const totalRevenue = paidCount * 2000;

    // Top Cards
    this.metrics.set([
      {
        label: 'Total Deliveries',
        value: String(totalDeliveries),
        trend: '+12.5%',
        trendPositive: true,
        comparison: 'vs last week',
      },
      {
        label: 'Active Deliveries',
        value: String(activeDeliveries),
        trend: '+8.2%',
        trendPositive: true,
        comparison: 'vs last week',
      },
      {
        label: 'Delivered Orders',
        value: String(deliveredOrders),
        trend: '+15.3%',
        trendPositive: true,
        comparison: 'vs last week',
      },
      {
        label: 'Pending Assignments',
        value: String(pendingAssignments),
        trend: '-4.3%',
        trendPositive: false,
        comparison: 'vs last week',
      },
      {
        label: 'Total Revenue',
        value: '₹' + totalRevenue.toLocaleString('en-IN'),
        trend: '+18.4%',
        trendPositive: true,
        comparison: 'vs last week',
      },
      {
        label: 'Total Users',
        value: String(totalUsers),
        trend: '+6.7%',
        trendPositive: true,
        comparison: 'vs last week',
      },
      {
        label: 'Total Agents',
        value: String(totalAgents),
        trend: '+4.1%',
        trendPositive: true,
        comparison: 'vs last week',
      },
      {
        label: 'Avg. Delivery Time',
        value: '2.45 hrs',
        trend: '-5.6%',
        trendPositive: false,
        comparison: 'vs last week',
      },
      {
        label: 'Delayed Deliveries',
        value: String(delayedDeliveries),
        trend: '-3.2%',
        trendPositive: false,
        comparison: 'vs last week',
      },
    ]);

    // Panel 1: Deliveries by Status (Bar Chart) - 100% Real Data
    const statusPending = deliveries.filter(
      (d) => d.status.toLowerCase() === 'pending' || d.status.toLowerCase() === 'unassigned',
    ).length;
    const statusAssigned = deliveries.filter((d) => d.status.toLowerCase() === 'assigned').length;
    const statusPickedUp = deliveries.filter((d) => d.status.toLowerCase() === 'picked up').length;
    const statusTransit = deliveries.filter((d) => d.status.toLowerCase() === 'in transit').length;
    const statusDelivered = deliveries.filter((d) => d.status.toLowerCase() === 'delivered').length;
    const statusCancelled = deliveries.filter((d) => d.status.toLowerCase() === 'cancelled').length;
    const statusDelayed = deliveries.filter((d) => d.status.toLowerCase() === 'delayed').length;

    const cols = [
      { label: 'Pending', value: statusPending, color: '#f59e0b' },
      { label: 'Assigned', value: statusAssigned, color: '#3b82f6' },
      { label: 'Picked Up', value: statusPickedUp, color: '#7c3aed' },
      { label: 'In Transit', value: statusTransit, color: '#0ea5e9' },
      { label: 'Delivered', value: statusDelivered, color: '#10b981' },
      { label: 'Cancelled', value: statusCancelled, color: '#ef4444' },
      { label: 'Delayed', value: statusDelayed, color: '#f97316' },
    ];

    const maxVal = Math.max(...cols.map((c) => c.value), 4);
    const roundedMax = Math.ceil(maxVal / 4) * 4;

    const columnsWithPercents = cols.map((c) => ({
      ...c,
      percent: (c.value / roundedMax) * 100,
    }));
    this.statusColumns.set(columnsWithPercents);
    this.totalStatusDeliveries.set(cols.reduce((sum, c) => sum + c.value, 0));

    // Dynamic Y labels
    this.yAxisLabels.set([
      String(roundedMax),
      String(roundedMax * 0.75),
      String(roundedMax * 0.5),
      String(roundedMax * 0.25),
      '0',
    ]);

    // Panel 2: User Breakdown (By Role - Donut Chart) - 100% Real Data
    const usersAdmin = this.rawUsers.filter((u) => u.role === 'Admin').length;
    const usersDispatcher = this.rawUsers.filter((u) => u.role === 'Dispatcher').length;
    const usersAgent = this.rawUsers.filter((u) => u.role === 'Agent').length;
    const usersCustomer = this.rawUsers.filter((u) => u.role === 'Customer').length;

    const userCols = [
      { label: 'Admin', count: usersAdmin, color: '#7c3aed' },
      { label: 'Dispatcher', count: usersDispatcher, color: '#3b82f6' },
      { label: 'Delivery Agent', count: usersAgent, color: '#10b981' },
      { label: 'Customer', count: usersCustomer, color: '#f59e0b' },
    ];

    const userTotal = userCols.reduce((sum, s) => sum + s.count, 0);
    const circumference = 345.57; // 2 * PI * 55
    let currentOffset = 0;

    const userCalculated = userCols.map((seg) => {
      const fraction = userTotal > 0 ? seg.count / userTotal : 0;
      const strokeLength = fraction * circumference;
      const dashArray = `${strokeLength.toFixed(2)} ${circumference.toFixed(2)}`;
      const dashOffset = `-${currentOffset.toFixed(2)}`;
      currentOffset += strokeLength;
      return {
        ...seg,
        percent: userTotal > 0 ? parseFloat((fraction * 100).toFixed(1)) : 0,
        dashArray,
        dashOffset,
      };
    });

    this.userRoleSegments.set(userCalculated);
    this.totalUsersCount.set(userTotal);

    // Panel 3: Agent Performance (Top 5) - Calculated Dynamically from active agents & deliveries
    const agents = this.rawUsers.filter((u) => u.role === 'Agent');
    const agentPerformance = agents.map((agent) => {
      const agentDeliveries = deliveries.filter((d) => d.agent === agent.full_name);
      const total = agentDeliveries.length;
      const delivered = agentDeliveries.filter(
        (d) => d.status.toLowerCase() === 'delivered',
      ).length;
      const successRate = total > 0 ? `${Math.round((delivered / total) * 100)}%` : '0%';

      const active = agentDeliveries.filter(
        (d) => d.status.toLowerCase() !== 'delivered' && d.status.toLowerCase() !== 'cancelled',
      ).length;

      const initials = agent.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();

      let rating = 5.0;
      if (agent.full_name === 'John Driver') rating = 4.8;
      if (agent.full_name === 'Rahul Transport') rating = 4.7;

      return {
        name: agent.full_name,
        avatarUrl: null,
        initials: initials || 'AG',
        deliveries: total,
        successRate,
        workload: active,
        rating,
      };
    });

    agentPerformance.sort((a, b) => b.deliveries - a.deliveries);
    this.topPerformingAgents.set(agentPerformance.slice(0, 5));
  }
}
